"""Rain radar provider: Australian BOM 5-min WMTS + Global RainViewer 10-min tiles.

Stitches radar tiles onto the exact regional Web Mercator bounding box so the 2-hour
jogging slider can scrub 24 frames at 60fps with zero tile pop-in or rate-limit churn,
while also exposing tile templates for wide-area panning.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import io
import logging
import math
from typing import Final

import aiohttp
import numpy as np
from PIL import Image

from ..const import (
    AU_BOUNDS,
    BOM_GOOGLE_MAPS_MATRIX,
    BOM_WMTS_BASE_URL,
    PROVIDER_AUTO,
    RADAR_PROVIDER_BOM,
    RADAR_PROVIDER_RAINVIEWER,
)
from .geostationary import BoundingBox

_LOGGER = logging.getLogger(__name__)

WEB_MERCATOR_HALF_EXTENT: Final = 20037508.342789244
WEB_MERCATOR_WORLD_EXTENT: Final = WEB_MERCATOR_HALF_EXTENT * 2.0
RAINVIEWER_API_URL: Final = "https://api.rainviewer.com/public/weather-maps.json"
BOM_REFLECTIVITY_LAYER: Final = "atm_surf_air_precip_reflectivity_dbz"
BOM_RAIN_RATE_LAYER: Final = "atm_surf_air_precip_rate_1hr_total_mm_h"
USER_AGENT: Final = "HomeAssistant-SolarSkyRadar/0.1"


@dataclass
class RadarRenderedFrame:
    """Single stitched 5- or 10-minute transparent radar frame."""

    timestamp_key: str
    epoch: int
    iso_utc: str
    provider: str
    radar_webp: bytes
    coverage_fraction: float  # Fraction of bbox pixels with active precipitation


def lon_to_mercator_x(lon_deg: float) -> float:
    return (lon_deg / 180.0) * WEB_MERCATOR_HALF_EXTENT


def lat_to_mercator_y(lat_deg: float) -> float:
    lat_r = math.radians(max(-85.0511, min(85.0511, lat_deg)))
    return math.log(math.tan(math.pi / 4.0 + lat_r / 2.0)) * (WEB_MERCATOR_HALF_EXTENT / math.pi)


def is_in_australia(lat: float, lon: float) -> bool:
    return (
        AU_BOUNDS["south"] <= lat <= AU_BOUNDS["north"]
        and AU_BOUNDS["west"] <= lon <= AU_BOUNDS["east"]
    )


def generate_bom_5min_epochs(now_utc: datetime | None = None, count: int = 25, lag_minutes: int = 6) -> list[int]:
    """Generate `count` 5-minute UTC epochs covering the past 2 hours."""
    now = now_utc or datetime.now(timezone.utc)
    anchor = now - timedelta(minutes=lag_minutes)
    floored_minute = (anchor.minute // 5) * 5
    latest = anchor.replace(minute=floored_minute, second=0, microsecond=0)
    latest_epoch = int(latest.timestamp())
    return [latest_epoch - (i * 300) for i in range(count - 1, -1, -1)]


class RainRadarManager:
    """Manages 2-hour rolling buffer of stitched regional rain radar frames."""

    def __init__(
        self,
        lat: float,
        lon: float,
        radius_deg: float = 3.5,
        provider_override: str = PROVIDER_AUTO,
        out_size: int = 640,
    ) -> None:
        self.lat = lat
        self.lon = lon
        self.bbox = BoundingBox.around(lat, lon, radius_deg)
        self.provider_override = provider_override
        self.out_size = out_size
        self._frames: dict[int, RadarRenderedFrame] = {}

    def select_provider(self) -> str:
        if self.provider_override in (RADAR_PROVIDER_BOM, RADAR_PROVIDER_RAINVIEWER):
            return self.provider_override
        return RADAR_PROVIDER_BOM if is_in_australia(self.lat, self.lon) else RADAR_PROVIDER_RAINVIEWER

    def update_aoi(self, lat: float, lon: float, radius_deg: float = 3.5, provider_override: str = PROVIDER_AUTO) -> None:
        new_bbox = BoundingBox.around(lat, lon, radius_deg)
        if new_bbox != self.bbox or provider_override != self.provider_override:
            self.lat = lat
            self.lon = lon
            self.bbox = new_bbox
            self.provider_override = provider_override
            self._frames.clear()

    async def _probe_bom_epoch(self, session: aiohttp.ClientSession, epoch: int) -> bool:
        iso = datetime.fromtimestamp(epoch, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        url = (
            f"{BOM_WMTS_BASE_URL}?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0"
            f"&LAYER={BOM_REFLECTIVITY_LAYER}&STYLE=default&FORMAT=image/png"
            f"&TILEMATRIXSET=GoogleMapsCompatible_BoM&TILEMATRIX=0&TILEROW=0&TILECOL=0&time={iso}"
        )
        try:
            async with session.get(
                url, headers={"User-Agent": USER_AGENT}, timeout=aiohttp.ClientTimeout(total=4.5)
            ) as resp:
                return resp.status == 200 and "image" in (resp.headers.get("Content-Type") or "")
        except Exception:  # noqa: BLE001
            return False

    async def _stitch_bom_frame(self, session: aiohttp.ClientSession, epoch: int) -> RadarRenderedFrame | None:
        """Stitch BOM WMTS 256x256 PNG tiles across `self.bbox` with exact EPSG:3857 origin math."""
        z = 7 if (self.bbox.east - self.bbox.west) <= 9.5 else 6
        matrix = BOM_GOOGLE_MAPS_MATRIX[z]
        tile_span_m = WEB_MERCATOR_WORLD_EXTENT / (2 ** z)
        tlx = float(matrix["tlx"])
        tly = float(matrix["tly"])
        max_w = int(matrix["w"])
        max_h = int(matrix["h"])

        x_west = lon_to_mercator_x(self.bbox.west)
        x_east = lon_to_mercator_x(self.bbox.east)
        y_north = lat_to_mercator_y(self.bbox.north)
        y_south = lat_to_mercator_y(self.bbox.south)

        col_f0 = (x_west - tlx) / tile_span_m
        col_f1 = (x_east - tlx) / tile_span_m
        row_f0 = (tly - y_north) / tile_span_m
        row_f1 = (tly - y_south) / tile_span_m

        c_min = max(0, int(math.floor(col_f0)))
        c_max = min(max_w - 1, int(math.floor(col_f1)))
        r_min = max(0, int(math.floor(row_f0)))
        r_max = min(max_h - 1, int(math.floor(row_f1)))
        if c_min > c_max or r_min > r_max:
            return None

        iso = datetime.fromtimestamp(epoch, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        cols = range(c_min, c_max + 1)
        rows = range(r_min, r_max + 1)
        canvas = np.zeros((len(rows) * 256, len(cols) * 256, 4), dtype=np.uint8)

        async def _dl(ri: int, ci: int, tr: int, tc: int) -> bool:
            url = (
                f"{BOM_WMTS_BASE_URL}?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0"
                f"&LAYER={BOM_REFLECTIVITY_LAYER}&STYLE=default&FORMAT=image/png"
                f"&TILEMATRIXSET=GoogleMapsCompatible_BoM&TILEMATRIX={z}"
                f"&TILEROW={tr}&TILECOL={tc}&time={iso}"
            )
            for attempt in range(2):
                try:
                    async with session.get(
                        url, headers={"User-Agent": USER_AGENT}, timeout=aiohttp.ClientTimeout(total=10)
                    ) as resp:
                        if resp.status in (429, 502, 503, 504) and attempt == 0:
                            await asyncio.sleep(0.35)
                            continue
                        if resp.status != 200:
                            return False
                        raw = await resp.read()
                    im = Image.open(io.BytesIO(raw)).convert("RGBA")
                    canvas[ri * 256 : (ri + 1) * 256, ci * 256 : (ci + 1) * 256] = np.asarray(im, dtype=np.uint8)
                    return True
                except Exception:  # noqa: BLE001
                    if attempt == 0:
                        await asyncio.sleep(0.25)
            return False

        ok = await asyncio.gather(
            *[_dl(ri, ci, tr, tc) for ri, tr in enumerate(rows) for ci, tc in enumerate(cols)]
        )
        if not any(ok):
            return None

        def _crop_and_encode() -> tuple[bytes, float]:
            px_x0 = (col_f0 - c_min) * 256.0
            px_x1 = (col_f1 - c_min) * 256.0
            px_y0 = (row_f0 - r_min) * 256.0
            px_y1 = (row_f1 - r_min) * 256.0
            cropped = Image.fromarray(canvas, mode="RGBA").crop((px_x0, px_y0, px_x1, px_y1)).resize(
                (self.out_size, self.out_size), Image.Resampling.BILINEAR
            )
            arr = np.asarray(cropped, dtype=np.uint8)
            rain_frac = float(np.mean(arr[:, :, 3] > 20))
            buf = io.BytesIO()
            cropped.save(buf, format="WEBP", quality=85, method=4)
            return buf.getvalue(), rain_frac

        webp_bytes, rain_frac = await asyncio.to_thread(_crop_and_encode)
        ts_key = datetime.fromtimestamp(epoch, tz=timezone.utc).strftime("%Y%m%d%H%M%S")
        return RadarRenderedFrame(
            timestamp_key=ts_key,
            epoch=epoch,
            iso_utc=iso,
            provider=RADAR_PROVIDER_BOM,
            radar_webp=webp_bytes,
            coverage_fraction=round(rain_frac, 4),
        )

    async def _stitch_rainviewer_frame(
        self, session: aiohttp.ClientSession, host: str, path: str, epoch: int
    ) -> RadarRenderedFrame | None:
        """Stitch RainViewer Universal Blue (scheme 2, z=6/7) tiles onto `self.bbox`."""
        z = 6
        n = 2 ** z

        def _tx(lon_d: float) -> float:
            return ((lon_d + 180.0) / 360.0) * n

        def _ty(lat_d: float) -> float:
            lr = math.radians(max(-85.05, min(85.05, lat_d)))
            return (1.0 - math.log(math.tan(lr) + 1.0 / math.cos(lr)) / math.pi) / 2.0 * n

        c_min, c_max = int(math.floor(_tx(self.bbox.west))), int(math.floor(_tx(self.bbox.east)))
        r_min, r_max = int(math.floor(_ty(self.bbox.north))), int(math.floor(_ty(self.bbox.south)))
        cols = range(c_min, c_max + 1)
        rows = range(r_min, r_max + 1)
        canvas = np.zeros((len(rows) * 256, len(cols) * 256, 4), dtype=np.uint8)

        async def _dl(ri: int, ci: int, tr: int, tc: int) -> bool:
            url = f"{host}{path}/256/{z}/{tc % n}/{tr}/2/1_1.png"
            try:
                async with session.get(
                    url, headers={"User-Agent": USER_AGENT}, timeout=aiohttp.ClientTimeout(total=8)
                ) as resp:
                    if resp.status != 200:
                        return False
                    im = Image.open(io.BytesIO(await resp.read())).convert("RGBA")
                    canvas[ri * 256 : (ri + 1) * 256, ci * 256 : (ci + 1) * 256] = np.asarray(im, dtype=np.uint8)
                    return True
            except Exception:  # noqa: BLE001
                return False

        ok = await asyncio.gather(
            *[_dl(ri, ci, tr, tc) for ri, tr in enumerate(rows) for ci, tc in enumerate(cols)]
        )
        if not any(ok):
            return None

        def _crop_and_encode() -> tuple[bytes, float]:
            px_x0 = (_tx(self.bbox.west) - c_min) * 256.0
            px_x1 = (_tx(self.bbox.east) - c_min) * 256.0
            px_y0 = (_ty(self.bbox.north) - r_min) * 256.0
            px_y1 = (_ty(self.bbox.south) - r_min) * 256.0
            cropped = Image.fromarray(canvas, mode="RGBA").crop((px_x0, px_y0, px_x1, px_y1)).resize(
                (self.out_size, self.out_size), Image.Resampling.BILINEAR
            )
            arr = np.asarray(cropped, dtype=np.uint8)
            rain_frac = float(np.mean(arr[:, :, 3] > 20))
            buf = io.BytesIO()
            cropped.save(buf, format="WEBP", quality=85, method=4)
            return buf.getvalue(), rain_frac

        webp_bytes, rain_frac = await asyncio.to_thread(_crop_and_encode)
        iso = datetime.fromtimestamp(epoch, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        ts_key = datetime.fromtimestamp(epoch, tz=timezone.utc).strftime("%Y%m%d%H%M%S")
        return RadarRenderedFrame(
            timestamp_key=ts_key,
            epoch=epoch,
            iso_utc=iso,
            provider=RADAR_PROVIDER_RAINVIEWER,
            radar_webp=webp_bytes,
            coverage_fraction=round(rain_frac, 4),
        )

    async def async_refresh(self, session: aiohttp.ClientSession, max_frames: int = 25) -> list[RadarRenderedFrame]:
        """Refresh the 2-hour radar frame buffer from BOM WMTS (AU) or RainViewer (Global)."""
        provider = self.select_provider()

        if provider == RADAR_PROVIDER_BOM:
            epochs = generate_bom_5min_epochs(count=max_frames, lag_minutes=6)
            # Verify newest epoch is published; step back 5 min if still propagating
            if epochs and not await self._probe_bom_epoch(session, epochs[-1]):
                epochs = [e - 300 for e in epochs]

            cutoff_ep = (epochs[0] - 600) if epochs else 0
            for old_e in list(self._frames):
                if old_e < cutoff_ep:
                    del self._frames[old_e]

            # Probe BOM WMTS mainly over the most recent 60 min (13 x 5m); older slots backfill via RainViewer
            recent_bom_epochs = epochs[-13:]
            missing = [e for e in recent_bom_epochs if e not in self._frames]
            sem = asyncio.Semaphore(3)

            async def _fetch_bom(ep: int) -> None:
                async with sem:
                    frame = await self._stitch_bom_frame(session, ep)
                    if frame is not None:
                        self._frames[ep] = frame

            if missing:
                await asyncio.gather(*[_fetch_bom(ep) for ep in missing])

            # BOM Public WMTS retains the most recent ~45-60 min of 5-min frames;
            # backfill older slots (-120m .. -50m) from RainViewer so the full 2-hour
            # jogging slider has continuous precipitation radar motion alongside satellite.
            min_bom_ep = min(self._frames) if self._frames else None
            if min_bom_ep is not None and (epochs[-1] - min_bom_ep) >= 5400:
                return sorted(self._frames.values(), key=lambda f: f.epoch)
        else:
            min_bom_ep = None

        # Global RainViewer (or backfill for >45-min-old frames beyond BOM WMTS window)
        try:
            async with session.get(
                RAINVIEWER_API_URL, headers={"User-Agent": USER_AGENT}, timeout=aiohttp.ClientTimeout(total=10)
            ) as resp:
                resp.raise_for_status()
                rv_meta = await resp.json()
            host = rv_meta.get("host", "https://tilecache.rainviewer.com")
            past = rv_meta.get("radar", {}).get("past", [])[-13:]
            if min_bom_ep is not None:
                past = [item for item in past if int(item["time"]) < (min_bom_ep - 240)]
            else:
                keep_rv = {int(item["time"]) for item in past}
                for old_e in list(self._frames):
                    if old_e not in keep_rv:
                        del self._frames[old_e]

            sem = asyncio.Semaphore(3)

            async def _fetch_rv(item: dict) -> None:
                ep = int(item["time"])
                if ep in self._frames:
                    return
                async with sem:
                    frame = await self._stitch_rainviewer_frame(session, host, item["path"], ep)
                    if frame is not None:
                        self._frames[ep] = frame

            await asyncio.gather(*[_fetch_rv(item) for item in past])
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("RainViewer radar refresh failed: %s", err)

        return sorted(self._frames.values(), key=lambda f: f.epoch)

    def get_frame_by_key(self, timestamp_key: str) -> RadarRenderedFrame | None:
        for f in self._frames.values():
            if f.timestamp_key == timestamp_key:
                return f
        return None

    def get_ordered_frames(self) -> list[RadarRenderedFrame]:
        return sorted(self._frames.values(), key=lambda f: f.epoch)
