"""Wind vector grid & solar irradiance provider via Open-Meteo Global Forecast API.

Fetches both:
- `10m` Surface Wind (local breeze / gusts)
- `850hPa` & `700hPa` Cloud-Steering Wind (1.5 - 3.0 km altitude where cumulus,
  stratocumulus, and frontal storm clouds actually advect toward solar arrays)
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import logging
import math
from typing import Any, Final

import aiohttp
import numpy as np

from .geostationary import BoundingBox

_LOGGER = logging.getLogger(__name__)

OPEN_METEO_URL: Final = "https://api.open-meteo.com/v1/forecast"
USER_AGENT: Final = "HomeAssistant-SolarSkyRadar/0.1"


def meteorological_to_uv_ms(speed_kmh: float, direction_from_deg: float) -> tuple[float, float]:
    """Convert meteorological wind (speed in km/h, direction FROM in deg) to (u, v) in m/s.

    u > 0 means blowing West -> East; v > 0 means blowing South -> North.
    """
    speed_ms = float(speed_kmh) / 3.6
    rad = math.radians(float(direction_from_deg))
    u = -speed_ms * math.sin(rad)
    v = -speed_ms * math.cos(rad)
    return round(u, 3), round(v, 3)


@dataclass
class WindFieldSnapshot:
    """Regional wind vector field for both surface (10m) and cloud-steering (850hPa) levels."""

    fetched_epoch: int
    bbox: BoundingBox
    rows: int
    cols: int
    lats: list[float]  # South -> North
    lons: list[float]  # West -> East
    # Flattened row-major [row * cols + col] in m/s
    u_10m: list[float]
    v_10m: list[float]
    u_850hpa: list[float]
    v_850hpa: list[float]
    center_surface_speed_kmh: float
    center_surface_dir_deg: float
    center_cloud_speed_kmh: float
    center_cloud_dir_deg: float
    shortwave_wm2: float | None
    direct_wm2: float | None
    diffuse_wm2: float | None
    model_cloud_cover_pct: float | None

    def to_api_dict(self) -> dict[str, Any]:
        return {
            "fetched_epoch": self.fetched_epoch,
            "bbox": {
                "west": self.bbox.west,
                "south": self.bbox.south,
                "east": self.bbox.east,
                "north": self.bbox.north,
            },
            "rows": self.rows,
            "cols": self.cols,
            "lats": self.lats,
            "lons": self.lons,
            "levels": {
                "10m": {
                    "label": "Surface Wind (10 m)",
                    "u": self.u_10m,
                    "v": self.v_10m,
                    "center_speed_kmh": round(self.center_surface_speed_kmh, 1),
                    "center_dir_deg": round(self.center_surface_dir_deg, 0),
                },
                "850hPa": {
                    "label": "Cloud Steering Wind (850 hPa / ~1.5 km)",
                    "u": self.u_850hpa,
                    "v": self.v_850hpa,
                    "center_speed_kmh": round(self.center_cloud_speed_kmh, 1),
                    "center_dir_deg": round(self.center_cloud_dir_deg, 0),
                },
            },
            "irradiance": {
                "shortwave_wm2": self.shortwave_wm2,
                "direct_wm2": self.direct_wm2,
                "diffuse_wm2": self.diffuse_wm2,
                "model_cloud_cover_pct": self.model_cloud_cover_pct,
            },
        }


class WindFieldManager:
    """Samples and caches a 6x6 regional wind vector grid every 25 minutes."""

    def __init__(self, lat: float, lon: float, radius_deg: float = 3.5, grid_n: int = 6) -> None:
        self.lat = lat
        self.lon = lon
        self.bbox = BoundingBox.around(lat, lon, radius_deg)
        self.grid_n = grid_n
        self._snapshot: WindFieldSnapshot | None = None

    def update_aoi(self, lat: float, lon: float, radius_deg: float = 3.5) -> None:
        new_bbox = BoundingBox.around(lat, lon, radius_deg)
        if new_bbox != self.bbox:
            self.lat = lat
            self.lon = lon
            self.bbox = new_bbox
            self._snapshot = None

    async def async_refresh(self, session: aiohttp.ClientSession, force: bool = False) -> WindFieldSnapshot | None:
        now_epoch = int(datetime.now(timezone.utc).timestamp())
        if not force and self._snapshot and (now_epoch - self._snapshot.fetched_epoch) < 1500:
            return self._snapshot

        lats = [round(float(v), 3) for v in np.linspace(self.bbox.south, self.bbox.north, self.grid_n)]
        lons = [round(float(v), 3) for v in np.linspace(self.bbox.west, self.bbox.east, self.grid_n)]

        query_lats: list[str] = []
        query_lons: list[str] = []
        for la in lats:
            for lo in lons:
                query_lats.append(str(la))
                query_lons.append(str(lo))

        # Append exact home site as final point for irradiance & center wind diagnostics
        query_lats.append(str(round(self.lat, 4)))
        query_lons.append(str(round(self.lon, 4)))

        params = {
            "latitude": ",".join(query_lats),
            "longitude": ",".join(query_lons),
            "current": (
                "wind_speed_10m,wind_direction_10m,cloud_cover,"
                "shortwave_radiation,direct_radiation,diffuse_radiation"
            ),
            "hourly": "wind_speed_850hPa,wind_direction_850hPa,wind_speed_700hPa,wind_direction_700hPa",
            "forecast_days": "1",
            "wind_speed_unit": "kmh",
            "timeformat": "unixtime",
        }

        try:
            async with session.get(
                OPEN_METEO_URL,
                params=params,
                headers={"User-Agent": USER_AGENT},
                timeout=aiohttp.ClientTimeout(total=15),
            ) as resp:
                resp.raise_for_status()
                data = await resp.json()

            items = data if isinstance(data, list) else [data]
            total_grid = self.grid_n * self.grid_n
            if len(items) < total_grid + 1:
                return self._snapshot

            u_10m: list[float] = []
            v_10m: list[float] = []
            u_850: list[float] = []
            v_850: list[float] = []

            def _extract_850(entry: dict[str, Any]) -> tuple[float, float]:
                hourly = entry.get("hourly") or {}
                times = hourly.get("time") or []
                s850 = hourly.get("wind_speed_850hPa") or []
                d850 = hourly.get("wind_direction_850hPa") or []
                s700 = hourly.get("wind_speed_700hPa") or []
                d700 = hourly.get("wind_direction_700hPa") or []
                if not times or not s850 or not d850:
                    cur = entry.get("current") or {}
                    return float(cur.get("wind_speed_10m") or 0.0), float(cur.get("wind_direction_10m") or 0.0)
                idx = min(range(len(times)), key=lambda i: abs(int(times[i]) - now_epoch))
                sp = float(s850[idx] if s850[idx] is not None else 0.0)
                dr = float(d850[idx] if d850[idx] is not None else 0.0)
                # Blend 25% of 700hPa when available for mid/high frontal cloud decks
                if idx < len(s700) and s700[idx] is not None and idx < len(d700) and d700[idx] is not None:
                    u8, v8 = meteorological_to_uv_ms(sp, dr)
                    u7, v7 = meteorological_to_uv_ms(float(s700[idx]), float(d700[idx]))
                    ub, vb = 0.75 * u8 + 0.25 * u7, 0.75 * v8 + 0.25 * v7
                    sp_blend = math.hypot(ub, vb) * 3.6
                    dr_blend = (math.degrees(math.atan2(-ub, -vb)) + 360.0) % 360.0
                    return sp_blend, dr_blend
                return sp, dr

            for pt in items[:total_grid]:
                cur = pt.get("current") or {}
                sp10 = float(cur.get("wind_speed_10m") or 0.0)
                dr10 = float(cur.get("wind_direction_10m") or 0.0)
                u10, v10 = meteorological_to_uv_ms(sp10, dr10)
                u_10m.append(u10)
                v_10m.append(v10)

                sp85, dr85 = _extract_850(pt)
                u85, v85 = meteorological_to_uv_ms(sp85, dr85)
                u_850.append(u85)
                v_850.append(v85)

            center_pt = items[total_grid]
            c_cur = center_pt.get("current") or {}
            c_sp10 = float(c_cur.get("wind_speed_10m") or 0.0)
            c_dr10 = float(c_cur.get("wind_direction_10m") or 0.0)
            c_sp85, c_dr85 = _extract_850(center_pt)

            self._snapshot = WindFieldSnapshot(
                fetched_epoch=now_epoch,
                bbox=self.bbox,
                rows=self.grid_n,
                cols=self.grid_n,
                lats=lats,
                lons=lons,
                u_10m=u_10m,
                v_10m=v_10m,
                u_850hpa=u_850,
                v_850hpa=v_850,
                center_surface_speed_kmh=c_sp10,
                center_surface_dir_deg=c_dr10,
                center_cloud_speed_kmh=c_sp85,
                center_cloud_dir_deg=c_dr85,
                shortwave_wm2=c_cur.get("shortwave_radiation"),
                direct_wm2=c_cur.get("direct_radiation"),
                diffuse_wm2=c_cur.get("diffuse_radiation"),
                model_cloud_cover_pct=c_cur.get("cloud_cover"),
            )
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("Open-Meteo wind grid fetch failed: %s", err)

        return self._snapshot

    @property
    def current_snapshot(self) -> WindFieldSnapshot | None:
        return self._snapshot
