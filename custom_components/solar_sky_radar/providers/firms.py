"""NASA FIRMS Global Active Fire, AU DEA Hotspots, and State Bushfire Incident provider.

Supports:
1. NASA FIRMS Area CSV API (`VIIRS_NOAA20_NRT`, `VIIRS_NOAA21_NRT`, `MODIS_NRT`)
   using the server-held `MAP_KEY` (never exposed to browser clients).
2. Geoscience Australia Digital Earth Australia (DEA) Hotspots WFS (`public:hotspots_three_days`),
   requiring NO API key and providing 10-minute Himawari-9 AHI thermal hotspots
   alongside VIIRS (375 m) and MODIS (1 km) across Australia.
3. Official Australian state fire agency feeds (VicEmergency & NSW RFS, zero API key),
   enriching satellite thermal detections within 6 km with human-readable incident names,
   fire categories (`Bushfire`, `Planned Burn`, `Grass Fire`), alert levels, statuses,
   hectare sizes, and agency/appliance counts, plus surfacing reported ground fires
   not yet seen on a satellite pass.
"""

from __future__ import annotations

import asyncio
import csv
from datetime import datetime, timezone
import html
import io
import logging
import math
import os
import re
from typing import Any, Final

import aiohttp

from .geostationary import BoundingBox
from .radar import is_in_australia

_LOGGER = logging.getLogger(__name__)

FIRMS_AREA_URL_TPL: Final = (
    "https://firms.modaps.eosdis.nasa.gov/api/area/csv/{map_key}/{source}/{west},{south},{east},{north}/2"
)
DEA_HOTSPOTS_WFS_URL: Final = "https://hotspots.dea.ga.gov.au/geoserver/wfs"
VIC_EMERGENCY_GEOJSON_URL: Final = "https://emergency.vic.gov.au/public/events-geojson.json"
NSW_RFS_INCIDENTS_URL: Final = "https://www.rfs.nsw.gov.au/feeds/majorIncidents.json"
USER_AGENT: Final = "HomeAssistant-SolarSkyRadar/0.1"

_COMPASS_16: Final = (
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
)


def _safe_float(val: Any, default: float) -> float:
    try:
        return float(val) if val is not None and val != "" else default
    except (TypeError, ValueError):
        return default


def _optional_float(val: Any) -> float | None:
    try:
        return float(val) if val is not None and val != "" else None
    except (TypeError, ValueError):
        return None


def classify_frp_intensity(frp_mw: float | None) -> str:
    """Classify Fire Radiative Power (MW) into a readable thermal intensity tier."""
    if frp_mw is None or frp_mw <= 0:
        return "Ground Report"
    if frp_mw < 10.0:
        return "Low"
    if frp_mw < 50.0:
        return "Moderate"
    if frp_mw < 150.0:
        return "High"
    return "Extreme"


def distance_and_bearing_km(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
) -> tuple[float, int, str]:
    """Compute great-circle distance (km) and compass bearing from (lat1, lon1) to (lat2, lon2)."""
    r_earth = 6371.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)

    a = math.sin(dp / 2.0) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2.0) ** 2
    dist_km = 2.0 * r_earth * math.asin(min(1.0, math.sqrt(a)))

    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    brng = (math.degrees(math.atan2(y, x)) + 360.0) % 360.0
    idx = int(round(brng / 22.5)) % 16
    return round(dist_km, 1), int(round(brng)) % 360, _COMPASS_16[idx]


def _extract_point_coords(geometry: dict[str, Any] | None) -> tuple[float, float] | None:
    """Extract representative (lon, lat) from Point, Polygon, or GeometryCollection."""
    if not geometry:
        return None
    gtype = geometry.get("type")
    if gtype == "Point":
        coords = geometry.get("coordinates") or []
        if len(coords) >= 2:
            return float(coords[0]), float(coords[1])
    elif gtype == "GeometryCollection":
        geoms = geometry.get("geometries") or []
        for sub in geoms:
            if sub.get("type") == "Point":
                pt = _extract_point_coords(sub)
                if pt is not None:
                    return pt
        for sub in geoms:
            pt = _extract_point_coords(sub)
            if pt is not None:
                return pt
    elif gtype == "Polygon":
        rings = geometry.get("coordinates") or []
        if rings and rings[0]:
            lons = [float(c[0]) for c in rings[0] if len(c) >= 2]
            lats = [float(c[1]) for c in rings[0] if len(c) >= 2]
            if lons and lats:
                return sum(lons) / len(lons), sum(lats) / len(lats)
    elif gtype == "MultiPolygon":
        polys = geometry.get("coordinates") or []
        if polys and polys[0] and polys[0][0]:
            lons = [float(c[0]) for c in polys[0][0] if len(c) >= 2]
            lats = [float(c[1]) for c in polys[0][0] if len(c) >= 2]
            if lons and lats:
                return sum(lons) / len(lons), sum(lats) / len(lats)
    return None


def _parse_iso_epoch(iso_str: str | None, fallback_epoch: int) -> int:
    if not iso_str:
        return fallback_epoch
    txt = iso_str.strip()
    try:
        if txt.endswith("Z"):
            txt = txt[:-1] + "+00:00"
        dt = datetime.fromisoformat(txt)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return int(dt.timestamp())
    except ValueError:
        return fallback_epoch


def parse_firms_csv(
    csv_text: str,
    source_name: str,
    now_epoch: int | None = None,
    home_lat: float | None = None,
    home_lon: float | None = None,
) -> list[dict[str, Any]]:
    """Parse NASA FIRMS Area CSV text into enriched GeoJSON Point features."""
    now_ts = now_epoch or int(datetime.now(timezone.utc).timestamp())
    features: list[dict[str, Any]] = []
    reader = csv.DictReader(io.StringIO(csv_text.strip()))
    sat_pretty = {
        "N20": "NOAA-20",
        "N21": "NOAA-21",
        "N": "Suomi NPP",
        "T": "Terra",
        "A": "Aqua",
    }

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
        temp_c = round(bright_k - 273.15, 1)

        conf_raw = (row.get("confidence") or "n").strip().lower()
        if conf_raw.isdigit():
            conf_label = f"{conf_raw}%"
        else:
            conf_label = {"h": "high", "n": "nominal", "l": "low"}.get(conf_raw, conf_raw)

        sat_raw = (row.get("satellite") or source_name).strip()
        sat_name = sat_pretty.get(sat_raw, sat_raw)
        inst_name = (row.get("instrument") or ("VIIRS" if "VIIRS" in source_name else "MODIS")).strip()

        scan_km = _optional_float(row.get("scan"))
        track_km = _optional_float(row.get("track"))
        accuracy_str = (
            f"{scan_km:.2f} × {track_km:.2f} km"
            if scan_km and track_km
            else ("± 0.375 km" if "VIIRS" in inst_name else "± 1.0 km")
        )

        dn_raw = (row.get("daynight") or "").strip().upper()
        daynight = "Daytime pass" if dn_raw == "D" else ("Nighttime pass" if dn_raw == "N" else "")

        props: dict[str, Any] = {
            "id": f"firms-{source_name}-{lat:.4f}-{lon:.4f}-{det_epoch}",
            "kind": "satellite_hotspot",
            "provider": "NASA FIRMS",
            "satellite": sat_name,
            "instrument": inst_name,
            "frp_mw": round(frp, 1),
            "intensity": classify_frp_intensity(frp),
            "temp_kelvin": round(bright_k, 1),
            "temp_celsius": temp_c,
            "confidence": conf_label,
            "accuracy": accuracy_str,
            "detected_iso": iso_str,
            "epoch": det_epoch,
            "hours_ago": round(hours_ago, 2),
        }
        if daynight:
            props["daynight"] = daynight
        if home_lat is not None and home_lon is not None:
            dist_km, brng_deg, compass = distance_and_bearing_km(home_lat, home_lon, lat, lon)
            props["distance_km"] = dist_km
            props["bearing_deg"] = brng_deg
            props["bearing_compass"] = compass

        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [round(lon, 5), round(lat, 5)]},
                "properties": props,
            }
        )
    return features


def parse_vic_emergency_geojson(
    payload: dict[str, Any],
    bbox: BoundingBox,
    now_epoch: int,
    home_lat: float | None = None,
    home_lon: float | None = None,
) -> list[dict[str, Any]]:
    """Parse VicEmergency public GeoJSON events into fire & planned burn incident features."""
    incidents: list[dict[str, Any]] = []
    for feat in payload.get("features") or []:
        props = feat.get("properties") or {}
        cat1 = str(props.get("category1") or "").strip()
        cat2 = str(props.get("category2") or "").strip()
        feed = str(props.get("sourceFeed") or "").strip().lower()
        cat_combo = f"{cat1} {cat2}".lower()

        is_fire_or_burn = (
            cat1 in ("Fire", "Planned Burn")
            or any(k in cat_combo for k in ("fire", "burn", "bushfire", "grassfire", "smoke"))
            or feed == "deeca-burns"
        )
        if not is_fire_or_burn:
            continue

        pt = _extract_point_coords(feat.get("geometry"))
        if pt is None:
            continue
        lon, lat = pt
        if not (bbox.south <= lat <= bbox.north and bbox.west <= lon <= bbox.east):
            continue

        raw_title = str(props.get("sourceTitle") or "").strip()
        if raw_title.lower() in ("undefined", "none", "advice", "watch and act", "emergency warning"):
            raw_title = ""
        loc = str(props.get("location") or "").strip()
        if raw_title and loc and raw_title.lower() not in loc.lower():
            title = f"{raw_title} ({loc})"
        else:
            title = loc or raw_title or cat2 or cat1

        fire_type = cat2 if cat2 and cat2.lower() not in ("other", "undefined") else cat1
        status = str(props.get("status") or "").strip()
        alert_level = cat1 if cat1 in ("Emergency Warning", "Watch and Act", "Advice") else ""
        size_fmt = str(props.get("sizeFmt") or props.get("size") or "").strip()
        if size_fmt.lower() in ("none", "null", "0", "0.0"):
            size_fmt = ""
        agency = str(props.get("sourceOrg") or "VicEmergency").strip()
        resources = int(_safe_float(props.get("resources"), 0.0))
        updated_iso = str(props.get("updated") or props.get("created") or "").strip()
        det_epoch = _parse_iso_epoch(updated_iso, now_epoch)
        hours_ago = max(0.0, min(48.0, (now_epoch - det_epoch) / 3600.0))
        url = str(props.get("url") or "https://emergency.vic.gov.au/").strip()

        inc_props: dict[str, Any] = {
            "id": f"vic-{props.get('id', det_epoch)}",
            "kind": "planned_burn" if "burn" in fire_type.lower() else "bushfire_incident",
            "provider": "VicEmergency",
            "incident_title": title,
            "fire_type": fire_type,
            "incident_status": status or "Active",
            "incident_agency": agency,
            "state": "VIC",
            "detected_iso": updated_iso,
            "epoch": det_epoch,
            "hours_ago": round(hours_ago, 2),
            "incident_url": url,
        }
        if alert_level:
            inc_props["alert_level"] = alert_level
        if size_fmt:
            inc_props["size_text"] = size_fmt
        if resources > 0:
            inc_props["resources"] = resources
        if home_lat is not None and home_lon is not None:
            dist_km, brng_deg, compass = distance_and_bearing_km(home_lat, home_lon, lat, lon)
            inc_props["distance_km"] = dist_km
            inc_props["bearing_deg"] = brng_deg
            inc_props["bearing_compass"] = compass

        incidents.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [round(lon, 5), round(lat, 5)]},
                "properties": inc_props,
            }
        )
    return incidents


def parse_nsw_rfs_geojson(
    payload: dict[str, Any],
    bbox: BoundingBox,
    now_epoch: int,
    home_lat: float | None = None,
    home_lon: float | None = None,
) -> list[dict[str, Any]]:
    """Parse NSW Rural Fire Service GeoJSON feed into structured fire incident features."""
    incidents: list[dict[str, Any]] = []
    for feat in payload.get("features") or []:
        props = feat.get("properties") or {}
        pt = _extract_point_coords(feat.get("geometry"))
        if pt is None:
            continue
        lon, lat = pt
        if not (bbox.south <= lat <= bbox.north and bbox.west <= lon <= bbox.east):
            continue

        desc_raw = html.unescape(str(props.get("description") or ""))
        kv: dict[str, str] = {}
        for part in re.split(r"<br\s*/?>|\n", desc_raw, flags=re.IGNORECASE):
            if ":" in part:
                k, v = part.split(":", 1)
                kv[k.strip().upper()] = re.sub(r"<[^>]+>", "", v).strip()

        fire_flag = kv.get("FIRE", "Yes").lower()
        fire_type = kv.get("TYPE") or "Bush Fire"
        if fire_flag == "no" and "fire" not in fire_type.lower() and "burn" not in fire_type.lower():
            continue

        title = str(props.get("title") or kv.get("LOCATION") or "NSW Fire Incident").strip()
        alert_level = str(props.get("category") or kv.get("ALERT LEVEL") or "").strip()
        status = kv.get("STATUS") or "Active"
        size_txt = kv.get("SIZE") or ""
        if size_txt == "0 ha":
            size_txt = ""
        council = kv.get("COUNCIL AREA") or ""
        agency = kv.get("RESPONSIBLE AGENCY") or "NSW RFS"
        url = str(props.get("link") or "https://www.rfs.nsw.gov.au/fire-information/fires-near-me").strip()

        inc_props: dict[str, Any] = {
            "id": f"nswrfs-{hash((title, round(lat, 3), round(lon, 3))) & 0xFFFFFFFF:08x}",
            "kind": (
                "planned_burn"
                if any(k in fire_type.lower() for k in ("hazard reduction", "burn"))
                else "bushfire_incident"
            ),
            "provider": "NSW Rural Fire Service",
            "incident_title": title,
            "fire_type": fire_type,
            "incident_status": status,
            "incident_agency": agency,
            "state": "NSW",
            "epoch": now_epoch,
            "hours_ago": 1.0,
            "incident_url": url,
        }
        if alert_level:
            inc_props["alert_level"] = alert_level
        if size_txt:
            inc_props["size_text"] = size_txt
        if council:
            inc_props["council_area"] = council
        if home_lat is not None and home_lon is not None:
            dist_km, brng_deg, compass = distance_and_bearing_km(home_lat, home_lon, lat, lon)
            inc_props["distance_km"] = dist_km
            inc_props["bearing_deg"] = brng_deg
            inc_props["bearing_compass"] = compass

        incidents.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [round(lon, 5), round(lat, 5)]},
                "properties": inc_props,
            }
        )
    return incidents


def enrich_hotspots_with_incidents(
    hotspots: list[dict[str, Any]],
    incidents: list[dict[str, Any]],
    match_radius_km: float = 6.0,
) -> list[dict[str, Any]]:
    """Cross-reference satellite thermal hotspots with ground emergency incident reports.

    - Satellite hotspots within `match_radius_km` of an official incident inherit its
      title, fire category, status, alert level, hectare size, agency, resources, and URL.
    - Official incidents with no matching satellite pixel yet (e.g. fast-breaking grassfires
      or low-canopy planned burns) are appended as standalone map features.
    """
    if not incidents:
        return hotspots

    matched_incident_ids: set[str] = set()
    copy_keys = (
        "incident_title",
        "fire_type",
        "incident_status",
        "alert_level",
        "size_text",
        "council_area",
        "incident_agency",
        "resources",
        "incident_url",
    )

    for hs in hotspots:
        hlon, hlat = hs["geometry"]["coordinates"]
        best_inc: dict[str, Any] | None = None
        best_dist = match_radius_km
        for inc in incidents:
            ilon, ilat = inc["geometry"]["coordinates"]
            dist_km, _, _ = distance_and_bearing_km(hlat, hlon, ilat, ilon)
            if dist_km <= best_dist:
                best_dist = dist_km
                best_inc = inc

        if best_inc is not None:
            ip = best_inc["properties"]
            hp = hs["properties"]
            matched_incident_ids.add(str(ip.get("id")))
            for k in copy_keys:
                if k in ip and ip[k] not in (None, ""):
                    hp[k] = ip[k]
            if ip.get("kind") == "planned_burn":
                hp["kind"] = "planned_burn"

    combined = list(hotspots)
    for inc in incidents:
        if str(inc["properties"].get("id")) not in matched_incident_ids:
            combined.append(inc)
    return combined


class FireHotspotsManager:
    """Queries and caches active thermal/fire hotspots from NASA FIRMS, DEA, and AU state feeds."""

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
                return parse_firms_csv(
                    text,
                    src,
                    now_epoch=now_epoch,
                    home_lat=self.lat,
                    home_lon=self.lon,
                )
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

            det_iso = str(props.get("datetime") or props.get("start_dt") or "").strip()
            det_epoch = int(now_epoch - hours_ago * 3600)
            frp_val = _optional_float(props.get("power"))
            frp_mw = round(frp_val, 1) if frp_val is not None else 4.0
            temp_k = _optional_float(props.get("temp_kelvin"))
            conf_raw = props.get("confidence")
            if isinstance(conf_raw, (int, float)):
                conf_str = f"{int(round(conf_raw))}%"
            elif conf_raw:
                conf_str = str(conf_raw).strip()
            else:
                conf_str = "nominal"

            accuracy = str(props.get("accuracy") or "").strip()
            agency = str(props.get("satellite_operating_agency") or "").strip()
            product = str(props.get("product") or props.get("process_algorithm") or "").strip()
            state = str(props.get("australian_state") or "").strip()
            fire_cat = str(props.get("fire_category_name") or "").strip()

            dist_km, brng_deg, compass = distance_and_bearing_km(self.lat, self.lon, lat, lon)

            feat_props: dict[str, Any] = {
                "id": f"dea-{props.get('id', det_epoch)}",
                "kind": "satellite_hotspot",
                "provider": "Geoscience Australia DEA",
                "satellite": str(props.get("satellite") or "HIMAWARI-9").strip(),
                "instrument": str(props.get("sensor") or "AHI").strip(),
                "frp_mw": frp_mw,
                "intensity": classify_frp_intensity(frp_mw),
                "confidence": conf_str,
                "detected_iso": det_iso,
                "epoch": det_epoch,
                "hours_ago": round(hours_ago, 2),
                "distance_km": dist_km,
                "bearing_deg": brng_deg,
                "bearing_compass": compass,
            }
            if temp_k is not None and temp_k > 0:
                feat_props["temp_kelvin"] = round(temp_k, 1)
                feat_props["temp_celsius"] = round(temp_k - 273.15, 1)
            if accuracy:
                feat_props["accuracy"] = accuracy
            if agency:
                feat_props["agency"] = agency
            if product:
                feat_props["product"] = product
            if state:
                feat_props["state"] = state
            if fire_cat and fire_cat.lower() != "none":
                feat_props["fire_type"] = fire_cat

            out.append(
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [round(lon, 5), round(lat, 5)]},
                    "properties": feat_props,
                }
            )
        return out

    async def _fetch_au_state_incidents(
        self,
        session: aiohttp.ClientSession,
        now_epoch: int,
    ) -> tuple[list[dict[str, Any]], list[str]]:
        """Fetch VicEmergency & NSW RFS active bushfire and planned-burn incidents when in bbox."""
        if not self.enable_dea_hotspots or not is_in_australia(self.lat, self.lon):
            return [], []

        tasks: list[asyncio.Task[tuple[list[dict[str, Any]], str | None]]] = []

        # Victoria overlap check
        if self.bbox.south <= -33.9 and self.bbox.north >= -39.3 and self.bbox.east >= 140.8 and self.bbox.west <= 150.2:
            async def _get_vic() -> tuple[list[dict[str, Any]], str | None]:
                try:
                    async with session.get(
                        VIC_EMERGENCY_GEOJSON_URL,
                        headers={"User-Agent": USER_AGENT},
                        timeout=aiohttp.ClientTimeout(total=8),
                    ) as resp:
                        if resp.status != 200:
                            return [], None
                        payload = await resp.json(content_type=None)
                    return (
                        parse_vic_emergency_geojson(payload, self.bbox, now_epoch, self.lat, self.lon),
                        "VicEmergency (CFA / DEECA Fires & Planned Burns)",
                    )
                except Exception as err:  # noqa: BLE001
                    _LOGGER.debug("VicEmergency feed fetch error: %s", err)
                    return [], None

            tasks.append(asyncio.create_task(_get_vic()))

        # NSW / ACT overlap check
        if self.bbox.south <= -28.0 and self.bbox.north >= -37.6 and self.bbox.east >= 140.9 and self.bbox.west <= 154.0:
            async def _get_nsw() -> tuple[list[dict[str, Any]], str | None]:
                try:
                    async with session.get(
                        NSW_RFS_INCIDENTS_URL,
                        headers={"User-Agent": USER_AGENT},
                        timeout=aiohttp.ClientTimeout(total=8),
                    ) as resp:
                        if resp.status != 200:
                            return [], None
                        payload = await resp.json(content_type=None)
                    return (
                        parse_nsw_rfs_geojson(payload, self.bbox, now_epoch, self.lat, self.lon),
                        "NSW Rural Fire Service Incidents",
                    )
                except Exception as err:  # noqa: BLE001
                    _LOGGER.debug("NSW RFS feed fetch error: %s", err)
                    return [], None

            tasks.append(asyncio.create_task(_get_nsw()))

        if not tasks:
            return [], []

        results = await asyncio.gather(*tasks)
        incidents: list[dict[str, Any]] = []
        labels: list[str] = []
        for feats, label in results:
            incidents.extend(feats)
            if label:
                labels.append(label)
        return incidents, labels

    async def async_refresh(self, session: aiohttp.ClientSession, force: bool = False) -> dict[str, Any]:
        now_epoch = int(datetime.now(timezone.utc).timestamp())
        if not force and self._last_fetch_epoch and (now_epoch - self._last_fetch_epoch) < 900:
            return self._cached_geojson

        firms_feats, dea_feats, (state_incidents, state_labels) = await asyncio.gather(
            self._fetch_firms(session, now_epoch),
            self._fetch_dea_australia(session, now_epoch),
            self._fetch_au_state_incidents(session, now_epoch),
        )

        # Deduplicate close satellite detections (< ~1.1 km within 30 min) preferring NASA FIRMS if both present
        deduped_hotspots: list[dict[str, Any]] = []
        seen_grid: set[tuple[int, int, int]] = set()
        for feat in [*firms_feats, *dea_feats]:
            lon, lat = feat["geometry"]["coordinates"]
            ep_bucket = int(feat["properties"]["epoch"]) // 1800
            key = (int(round(lat * 100)), int(round(lon * 100)), ep_bucket)
            if key in seen_grid:
                continue
            seen_grid.add(key)
            deduped_hotspots.append(feat)

        merged = enrich_hotspots_with_incidents(deduped_hotspots, state_incidents, match_radius_km=6.0)

        active_sources: list[str] = []
        if self.firms_map_key:
            active_sources.append("NASA FIRMS (VIIRS 375m + MODIS 1km)")
        if self.enable_dea_hotspots and is_in_australia(self.lat, self.lon):
            active_sources.append("Geoscience Australia DEA Hotspots (Himawari-9 + VIIRS + MODIS)")
        active_sources.extend(state_labels)

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
