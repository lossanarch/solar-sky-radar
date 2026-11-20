"""NASA FIRMS Global Active Fire + Australian DEA Hotspots provider.

Supports:
1. NASA FIRMS Area CSV API (`VIIRS_NOAA20_NRT`, `VIIRS_NOAA21_NRT`, `MODIS_NRT`)
   using the server-held `MAP_KEY` (never exposed to browser clients).
2. Geoscience Australia Digital Earth Australia (DEA) Hotspots WFS (`public:hotspots_three_days`),
   which requires NO API key and includes 10-minute Himawari-9 AHI thermal hotspots
   alongside VIIRS and MODIS across Australia.
"""

from __future__ import annotations

import asyncio
import csv
from datetime import datetime, timezone
import io
import logging
import os
from typing import Any, Final

import aiohttp

from .geostationary import BoundingBox
from .radar import is_in_australia

_LOGGER = logging.getLogger(__name__)

FIRMS_AREA_URL_TPL: Final = (
    "https://firms.modaps.eosdis.nasa.gov/api/area/csv/{map_key}/{source}/{west},{south},{east},{north}/2"
)
DEA_HOTSPOTS_WFS_URL: Final = "https://hotspots.dea.ga.gov.au/geoserver/wfs"
USER_AGENT: Final = "HomeAssistant-SolarSkyRadar/0.1"


def parse_firms_csv(csv_text: str, source_name: str, now_epoch: int | None = None) -> list[dict[str, Any]]:
    """Parse NASA FIRMS Area CSV text into GeoJSON Point features."""
    now_ts = now_epoch or int(datetime.now(timezone.utc).timestamp())
    features: list[dict[str, Any]] = []
    reader = csv.DictReader(io.StringIO(csv_text.strip()))
    for row in reader:
        try:
            lat = float(row["latitude"])
            lon = float(row["longitude"])
        except (KeyError, TypeError, ValueError):
            continue

        acq_date = (row.get("acq_date") or "").strip()
        acq_time = (row.get("acq_time") or "0000").strip().zfill(4)
        det_epoch = now_ts
        iso_str = acq_date
        if acq_date:
            try:
                dt = datetime.strptime(f"{acq_date}{acq_time}", "%Y-%m-%d%H%M").replace(tzinfo=timezone.utc)
                det_epoch = int(dt.timestamp())
                iso_str = dt.strftime("%Y-%m-%dT%H:%M:%SZ")
            except ValueError:
                pass

        hours_ago = max(0.0, (now_ts - det_epoch) / 3600.0)
        frp = _safe_float(row.get("frp"), 5.0)
        bright_k = _safe_float(row.get("bright_ti4") or row.get("brightness"), 320.0)
        conf_raw = (row.get("confidence") or "n").strip().lower()
        conf_label = {"h": "high", "n": "nominal", "l": "low"}.get(conf_raw, conf_raw)

        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [round(lon, 5), round(lat, 5)]},
                "properties": {
                    "id": f"firms-{source_name}-{lat:.4f}-{lon:.4f}-{det_epoch}",
                    "provider": "NASA FIRMS",
                    "satellite": row.get("satellite") or source_name,
                    "instrument": row.get("instrument") or ("VIIRS" if "VIIRS" in source_name else "MODIS"),
                    "frp_mw": round(frp, 1),
                    "temp_kelvin": round(bright_k, 1),
                    "confidence": conf_label,
                    "detected_iso": iso_str,
                    "epoch": det_epoch,
                    "hours_ago": round(hours_ago, 2),
                },
            }
        )
    return features


def _safe_float(val: Any, default: float) -> float:
    try:
        return float(val) if val is not None and val != "" else default
    except (TypeError, ValueError):
        return default


class FireHotspotsManager:
    """Queries and caches active thermal/fire hotspots from NASA FIRMS and AU DEA Hotspots."""

    def __init__(
        self,
        lat: float,
        lon: float,
        radius_deg: float = 3.5,
        firms_map_key: str | None = None,
        enable_dea_hotspots: bool = True,
    ) -> None:
        self.lat = lat
        self.lon = lon
        # Slightly wider fire search box (+1.5 deg) to spot upwind smoke-producing bushfires
        self.bbox = BoundingBox.around(lat, lon, min(7.5, radius_deg + 1.5))
        self.firms_map_key = (firms_map_key or os.environ.get("NASA_FIRMS_MAP_KEY") or "").strip()
        self.enable_dea_hotspots = enable_dea_hotspots
        self._cached_geojson: dict[str, Any] = {
            "type": "FeatureCollection",
            "features": [],
            "meta": {"status": "uninitialized", "sources": []},
        }
        self._last_fetch_epoch = 0

    def update_config(
        self,
        lat: float,
        lon: float,
        radius_deg: float = 3.5,
        firms_map_key: str | None = None,
        enable_dea_hotspots: bool = True,
    ) -> None:
        new_bbox = BoundingBox.around(lat, lon, min(7.5, radius_deg + 1.5))
        new_key = (firms_map_key if firms_map_key is not None else self.firms_map_key).strip()
        if new_bbox != self.bbox or new_key != self.firms_map_key or enable_dea_hotspots != self.enable_dea_hotspots:
            self.lat = lat
            self.lon = lon
            self.bbox = new_bbox
            self.firms_map_key = new_key
            self.enable_dea_hotspots = enable_dea_hotspots
            self._last_fetch_epoch = 0

    async def _fetch_firms(self, session: aiohttp.ClientSession, now_epoch: int) -> list[dict[str, Any]]:
        if not self.firms_map_key:
            return []

        sources = ["VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT", "MODIS_NRT"]
        collected: list[dict[str, Any]] = []

        async def _get_src(src: str) -> list[dict[str, Any]]:
            url = FIRMS_AREA_URL_TPL.format(
                map_key=self.firms_map_key,
                source=src,
                west=self.bbox.west,
                south=self.bbox.south,
                east=self.bbox.east,
                north=self.bbox.north,
            )
            try:
                async with session.get(
                    url, headers={"User-Agent": USER_AGENT}, timeout=aiohttp.ClientTimeout(total=14)
                ) as resp:
                    if resp.status != 200:
                        return []
                    text = await resp.text()
                if "Invalid MAP_KEY" in text or "Transaction limit" in text:
                    _LOGGER.warning("NASA FIRMS API returned notice for %s", src)
                    return []
                return parse_firms_csv(text, src, now_epoch=now_epoch)
            except Exception as err:  # noqa: BLE001
                _LOGGER.debug("NASA FIRMS fetch error (%s): %s", src, err)
                return []

        batches = await asyncio.gather(*[_get_src(s) for s in sources])
        for b in batches:
            collected.extend(b)
        return collected

    async def _fetch_dea_australia(self, session: aiohttp.ClientSession, now_epoch: int) -> list[dict[str, Any]]:
        if not self.enable_dea_hotspots or not is_in_australia(self.lat, self.lon):
            return []

        params = {
            "service": "WFS",
            "version": "2.0.0",
            "request": "GetFeature",
            "typeNames": "public:hotspots_three_days",
            "count": "600",
            "outputFormat": "application/json",
            "bbox": f"{self.bbox.south},{self.bbox.west},{self.bbox.north},{self.bbox.east},urn:ogc:def:crs:EPSG::4326",
        }
        try:
            async with session.get(
                DEA_HOTSPOTS_WFS_URL,
                params=params,
                headers={"User-Agent": USER_AGENT},
                timeout=aiohttp.ClientTimeout(total=14),
            ) as resp:
                if resp.status != 200:
                    return []
                payload = await resp.json()
        except Exception as err:  # noqa: BLE001
            _LOGGER.debug("DEA Hotspots WFS fetch error: %s", err)
            return []

        out: list[dict[str, Any]] = []
        for feat in payload.get("features", []):
            props = feat.get("properties") or {}
            hours_ago = _safe_float(props.get("hours_since_hotspot"), 12.0)
            if hours_ago > 48.0:
                continue
            lat = _safe_float(props.get("latitude"), 0.0)
            lon = _safe_float(props.get("longitude"), 0.0)
            if lat == 0.0 and lon == 0.0:
                coords = (feat.get("geometry") or {}).get("coordinates") or [0.0, 0.0]
                lon, lat = float(coords[0]), float(coords[1])

            det_iso = props.get("datetime") or props.get("start_dt") or ""
            det_epoch = int(now_epoch - hours_ago * 3600)
            out.append(
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [round(lon, 5), round(lat, 5)]},
                    "properties": {
                        "id": f"dea-{props.get('id', det_epoch)}",
                        "provider": "DEA Australia (VIIRS/MODIS/Himawari)",
                        "satellite": props.get("satellite") or "HIMAWARI-9",
                        "instrument": props.get("sensor") or "AHI",
                        "frp_mw": round(_safe_float(props.get("power"), 8.0), 1),
                        "temp_kelvin": round(_safe_float(props.get("temp_kelvin"), 315.0), 1),
                        "confidence": str(props.get("confidence") or "nominal"),
                        "detected_iso": det_iso,
                        "epoch": det_epoch,
                        "hours_ago": round(hours_ago, 2),
                    },
                }
            )
        return out

    async def async_refresh(self, session: aiohttp.ClientSession, force: bool = False) -> dict[str, Any]:
        now_epoch = int(datetime.now(timezone.utc).timestamp())
        if not force and self._last_fetch_epoch and (now_epoch - self._last_fetch_epoch) < 900:
            return self._cached_geojson

        firms_feats, dea_feats = await asyncio.gather(
            self._fetch_firms(session, now_epoch),
            self._fetch_dea_australia(session, now_epoch),
        )

        # Deduplicate close detections (< ~1.1 km within 30 min) preferring NASA FIRMS if both present
        merged: list[dict[str, Any]] = []
        seen_grid: set[tuple[int, int, int]] = set()
        for feat in [*firms_feats, *dea_feats]:
            lon, lat = feat["geometry"]["coordinates"]
            ep_bucket = int(feat["properties"]["epoch"]) // 1800
            key = (int(round(lat * 100)), int(round(lon * 100)), ep_bucket)
            if key in seen_grid:
                continue
            seen_grid.add(key)
            merged.append(feat)

        active_sources: list[str] = []
        if self.firms_map_key:
            active_sources.append("NASA FIRMS (VIIRS 375m + MODIS 1km)")
        if self.enable_dea_hotspots and is_in_australia(self.lat, self.lon):
            active_sources.append("Geoscience Australia DEA Hotspots (Himawari-9 + VIIRS + MODIS)")

        status = "ok" if active_sources else "needs_firms_key"
        self._cached_geojson = {
            "type": "FeatureCollection",
            "features": merged,
            "meta": {
                "status": status,
                "count": len(merged),
                "sources": active_sources,
                "firms_configured": bool(self.firms_map_key),
                "updated_epoch": now_epoch,
            },
        }
        self._last_fetch_epoch = now_epoch
        return self._cached_geojson

    @property
    def current_geojson(self) -> dict[str, Any]:
        return self._cached_geojson
