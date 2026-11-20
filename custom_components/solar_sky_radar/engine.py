"""Unified async engine orchestrating satellite, cloud, radar, wind, fire, and solar analysis."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import logging
from typing import Any

import aiohttp

from .const import (
    BOM_BASEMAP_DARK_URL,
    BOM_BASEMAP_LIGHT_URL,
    BOM_OVERLAY_BORDERS_URL,
    BOM_OVERLAY_TOWNS_URL,
    DEFAULT_LATITUDE,
    DEFAULT_LONGITUDE,
    DEFAULT_RADIUS_DEG,
    PROVIDER_AUTO,
)
from .providers.firms import FireHotspotsManager
from .providers.geostationary import BoundingBox
from .providers.lightning import LightningStrikeBuffer
from .providers.radar import RainRadarManager, is_in_australia
from .providers.satellite_global import SatelliteCloudManager
from .providers.wind import WindFieldManager
from .solar_analysis import SolarCloudAnalysis, analyze_solar_sky

_LOGGER = logging.getLogger(__name__)


class RadarSkyEngine:
    """Core runtime engine shared by the Home Assistant coordinator and dev preview server."""

    def __init__(
        self,
        lat: float = DEFAULT_LATITUDE,
        lon: float = DEFAULT_LONGITUDE,
        radius_deg: float = DEFAULT_RADIUS_DEG,
        satellite_provider: str = PROVIDER_AUTO,
        radar_provider: str = PROVIDER_AUTO,
        firms_map_key: str | None = None,
        enable_dea_hotspots: bool = True,
        enable_bom_ftp: bool = False,
        poll_public_lightning: bool = False,
    ) -> None:
        self.lat = float(lat)
        self.lon = float(lon)
        self.radius_deg = float(radius_deg)
        self.satellite_provider = satellite_provider
        self.radar_provider = radar_provider
        self.poll_public_lightning = poll_public_lightning

        self.satellite = SatelliteCloudManager(
            lat=self.lat,
            lon=self.lon,
            radius_deg=self.radius_deg,
            provider_override=satellite_provider,
            enable_bom_ftp=enable_bom_ftp,
        )
        self.radar = RainRadarManager(
            lat=self.lat,
            lon=self.lon,
            radius_deg=self.radius_deg,
            provider_override=radar_provider,
        )
        self.wind = WindFieldManager(lat=self.lat, lon=self.lon, radius_deg=self.radius_deg)
        self.firms = FireHotspotsManager(
            lat=self.lat,
            lon=self.lon,
            radius_deg=self.radius_deg,
            firms_map_key=firms_map_key,
            enable_dea_hotspots=enable_dea_hotspots,
        )
        self.lightning = LightningStrikeBuffer(lat=self.lat, lon=self.lon, radius_deg=self.radius_deg)
        self.solar_analysis: SolarCloudAnalysis = analyze_solar_sky(
            self.lat, self.lon, self.bbox, None, None, None
        )
        self._last_refresh_epoch: int = 0
        self._refresh_lock = asyncio.Lock()

    @property
    def bbox(self) -> BoundingBox:
        return self.satellite.bbox

    def update_settings(
        self,
        *,
        lat: float | None = None,
        lon: float | None = None,
        radius_deg: float | None = None,
        satellite_provider: str | None = None,
        radar_provider: str | None = None,
        firms_map_key: str | None = None,
        enable_dea_hotspots: bool | None = None,
    ) -> None:
        """Apply updated center, radius, or provider settings."""
        if lat is not None:
            self.lat = float(lat)
        if lon is not None:
            self.lon = float(lon)
        if radius_deg is not None:
            self.radius_deg = float(radius_deg)
        if satellite_provider is not None:
            self.satellite_provider = satellite_provider
        if radar_provider is not None:
            self.radar_provider = radar_provider

        self.satellite.update_aoi(self.lat, self.lon, self.radius_deg, self.satellite_provider)
        self.radar.update_aoi(self.lat, self.lon, self.radius_deg, self.radar_provider)
        self.wind.update_aoi(self.lat, self.lon, self.radius_deg)
        self.firms.update_config(
            self.lat,
            self.lon,
            self.radius_deg,
            firms_map_key=firms_map_key,
            enable_dea_hotspots=enable_dea_hotspots if enable_dea_hotspots is not None else self.firms.enable_dea_hotspots,
        )
        self.lightning.update_aoi(self.lat, self.lon, self.radius_deg)

    async def async_refresh(
        self,
        session: aiohttp.ClientSession,
        hass_states: list[Any] | None = None,
    ) -> dict[str, Any]:
        """Refresh all providers concurrently and compute updated solar sky analysis."""
        async with self._refresh_lock:
            if hass_states is not None:
                self.lightning.ingest_from_hass_states(hass_states)

            tasks: list[Any] = [
                self.satellite.async_refresh(session, max_frames=13),
                self.radar.async_refresh(session, max_frames=25),
                self.wind.async_refresh(session),
                self.firms.async_refresh(session),
            ]
            if self.poll_public_lightning and hass_states is None:
                tasks.append(self.lightning.async_poll_public_blitzortung(session, listen_seconds=1.6))

            await asyncio.gather(*tasks, return_exceptions=True)

            sat_frames = self.satellite.get_ordered_frames()
            latest_sat = sat_frames[-1] if sat_frames else None
            self.solar_analysis = analyze_solar_sky(
                home_lat=self.lat,
                home_lon=self.lon,
                bbox=self.bbox,
                cloud_optical=latest_sat.cloud_optical if latest_sat else None,
                ir_coldness=latest_sat.ir_coldness if latest_sat else None,
                wind=self.wind.current_snapshot,
            )
            self._last_refresh_epoch = int(datetime.now(timezone.utc).timestamp())
            return self.build_manifest()

    def build_timeline(self) -> list[dict[str, Any]]:
        """Build a unified 2-hour timeline pairing each radar/satellite slot cleanly."""
        sat_frames = self.satellite.get_ordered_frames()
        rad_frames = self.radar.get_ordered_frames()

        if not sat_frames and not rad_frames:
            return []

        # Use radar epochs (5m in AU, 10m globally) as master ticks when >= len(sat_frames),
        # otherwise merge unique 5-minute quantized epochs across both streams.
        master_epochs: set[int] = set()
        for rf in rad_frames:
            master_epochs.add(rf.epoch)
        for sf in sat_frames:
            # Quantize satellite scan seconds (e.g. GOES :21s) to nearest minute for clean matching
            q_ep = (sf.epoch // 60) * 60
            master_epochs.add(q_ep)

        sorted_epochs = sorted(master_epochs)
        # Keep only the most recent 125 minutes
        if sorted_epochs:
            cutoff = sorted_epochs[-1] - 125 * 60
            sorted_epochs = [e for e in sorted_epochs if e >= cutoff]

        # Deduplicate ticks closer than 4 minutes (e.g. when radar & satellite differ by 1 min)
        merged_epochs: list[int] = []
        for ep in sorted_epochs:
            if merged_epochs and (ep - merged_epochs[-1]) < 240:
                merged_epochs[-1] = ep
            else:
                merged_epochs.append(ep)

        def _nearest_key(frames: list[Any], target_ep: int, max_skew_s: int = 1200) -> str | None:
            if not frames:
                return None
            # Prefer most recent frame not significantly newer than target_ep
            prior = [f for f in frames if f.epoch <= target_ep + 120]
            best = prior[-1] if prior else frames[0]
            if abs(best.epoch - target_ep) > max_skew_s:
                best = min(frames, key=lambda f: abs(f.epoch - target_ep))
            return best.timestamp_key

        timeline: list[dict[str, Any]] = []
        latest_ep = merged_epochs[-1] if merged_epochs else 0
        for ep in merged_epochs:
            iso = datetime.fromtimestamp(ep, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            timeline.append(
                {
                    "epoch": ep,
                    "iso_utc": iso,
                    "offset_minutes": round((ep - latest_ep) / 60),
                    "satellite_key": _nearest_key(sat_frames, ep),
                    "radar_key": _nearest_key(rad_frames, ep),
                }
            )
        return timeline

    def build_manifest(self, api_base: str = "/api/solar_sky_radar") -> dict[str, Any]:
        """Return complete metadata manifest consumed by `<solar-sky-radar-card>`."""
        sat_frames = self.satellite.get_ordered_frames()
        rad_frames = self.radar.get_ordered_frames()
        in_au = is_in_australia(self.lat, self.lon)

        return {
            "updated_epoch": self._last_refresh_epoch,
            "location": {
                "latitude": self.lat,
                "longitude": self.lon,
                "radius_deg": self.radius_deg,
                "in_australia": in_au,
            },
            "bbox": {
                "west": self.bbox.west,
                "south": self.bbox.south,
                "east": self.bbox.east,
                "north": self.bbox.north,
                "coordinates": self.bbox.as_maplibre_coordinates(),
            },
            "providers": {
                "satellite": {
                    "id": self.satellite.spec.sat_id,
                    "label": sat_frames[-1].source_label if sat_frames else self.satellite.spec.label,
                    "frame_count": len(sat_frames),
                    "frames": [
                        {
                            "key": f.timestamp_key,
                            "epoch": f.epoch,
                            "iso_utc": f.iso_utc,
                            "true_colour_url": f"{api_base}/frame/true_colour/{f.timestamp_key}.webp",
                            "cloud_mask_url": f"{api_base}/frame/cloud_mask/{f.timestamp_key}.webp",
                            "solar_cloud_url": f"{api_base}/frame/solar_cloud/{f.timestamp_key}.webp",
                        }
                        for f in sat_frames
                    ],
                },
                "radar": {
                    "id": self.radar.select_provider(),
                    "label": "Australian BOM 5-min WMTS" if self.radar.select_provider() == "bom_wmts" else "RainViewer Global Radar",
                    "frame_count": len(rad_frames),
                    "frames": [
                        {
                            "key": f.timestamp_key,
                            "epoch": f.epoch,
                            "iso_utc": f.iso_utc,
                            "url": f"{api_base}/frame/radar/{f.timestamp_key}.webp",
                            "coverage_fraction": f.coverage_fraction,
                        }
                        for f in rad_frames
                    ],
                },
                "basemap": {
                    "bom_dark_tiles": BOM_BASEMAP_DARK_URL if in_au else None,
                    "bom_light_tiles": BOM_BASEMAP_LIGHT_URL if in_au else None,
                    "bom_towns_overlay": BOM_OVERLAY_TOWNS_URL if in_au else None,
                    "bom_borders_overlay": BOM_OVERLAY_BORDERS_URL if in_au else None,
                },
            },
            "timeline": self.build_timeline(),
            "solar": self.solar_analysis.to_dict(),
            "endpoints": {
                "wind": f"{api_base}/wind",
                "hazards": f"{api_base}/hazards",
            },
        }

    def get_frame_bytes(self, layer: str, key: str) -> bytes | None:
        """Retrieve cached WebP image bytes for `true_colour`, `cloud_mask`, `solar_cloud`, or `radar`."""
        clean_key = key.removesuffix(".webp").removesuffix(".png")
        if layer in ("true_colour", "cloud_mask", "solar_cloud"):
            sf = self.satellite.get_frame(clean_key)
            if sf is None:
                return None
            if layer == "true_colour":
                return sf.true_colour_webp
            if layer == "cloud_mask":
                return sf.cloud_mask_webp
            return sf.solar_cloud_webp
        if layer == "radar":
            rf = self.radar.get_frame_by_key(clean_key)
            return rf.radar_webp if rf else None
        return None

    def get_hazards_payload(self) -> dict[str, Any]:
        """Return combined NASA FIRMS / DEA fire hotspots and 2-hour lightning GeoJSON."""
        return {
            "fires": self.firms.current_geojson,
            "lightning": self.lightning.to_geojson(),
        }
