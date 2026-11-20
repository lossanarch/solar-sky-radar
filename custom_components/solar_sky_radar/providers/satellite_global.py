"""Global + Australian High-Resolution Satellite True Colour & Visual Cloud Provider.

Combines:
1. High-resolution (1 km GeoColor + 500 m Visible pan-sharpening + 2 km Clean IR)
   geostationary satellite imagery across all 5 global platforms via HTTPS:
   - Himawari-9 (140.7E — Melbourne, Australia, NZ, East Asia)
   - GOES-19 East (75.2W — Americas & Atlantic)
   - GOES-18 West (137.2W — Pacific & West Americas)
   - Meteosat Prime (0E — Europe & Africa)
   - Meteosat IODC (45.5E — Indian Ocean & Western Australia)
2. Optional BOM Anonymous FTP (`IDE00406` / `IDE00435`) when port 21 is reachable.
3. JMA Bosai Himawari Full Disk (`targetTimes_fd.json`) Web Mercator tile fallback.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
import io
import logging
import math
from typing import Final

import aiohttp
import numpy as np
from PIL import Image

from ..const import GeostationarySatSpec
from .geostationary import (
    BoundingBox,
    ReprojectionGrid,
    bilinear_sample,
    build_reprojection_grid,
    inverse_mercator_y,
    mercator_y,
    pan_sharpen_true_colour,
    select_best_satellite,
    synthesize_cloud_overlays,
)
from .satellite_bom import BomFtpSatelliteClient

_LOGGER = logging.getLogger(__name__)

SLIDER_BASE: Final = "https://rammb-slider.cira.colostate.edu"
JMA_FD_TIMES_URL: Final = "https://www.jma.go.jp/bosai/himawari/data/satimg/targetTimes_fd.json"
JMA_FD_TILE_TPL: Final = (
    "https://www.jma.go.jp/bosai/himawari/data/satimg/{ts}/fd/{ts}/{band}/{prod}/{z}/{x}/{y}.jpg"
)
USER_AGENT: Final = "HomeAssistant-SolarSkyRadar/0.1 (+https://github.com/solar-sky-radar)"


@dataclass
class SatelliteRenderedFrame:
    """Processed 10-minute satellite frame ready for serving and solar analysis."""

    timestamp_key: str  # YYYYMMDDHHMMSS UTC
    epoch: int  # Unix seconds UTC
    iso_utc: str
    source_label: str
    true_colour_webp: bytes
    cloud_mask_webp: bytes
    solar_cloud_webp: bytes
    rgb_preview: np.ndarray  # uint8 (H, W, 3) for temporal baseline & tests
    cloud_optical: np.ndarray  # float32 (H, W) [0..1]
    ir_coldness: np.ndarray  # float32 (H, W) [0..1]


def parse_timestamp_key(ts_str: str) -> tuple[int, str]:
    """Parse a 12- or 14-digit UTC timestamp string into (unix_epoch, iso_string)."""
    clean = str(ts_str).strip()
    if len(clean) == 12:
        clean += "00"
    dt = datetime.strptime(clean[:14], "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)
    return int(dt.timestamp()), dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def encode_webp(arr: np.ndarray, quality: int = 84, lossless: bool = False) -> bytes:
    """Encode an RGB or RGBA uint8 NumPy array into compact WebP bytes."""
    mode = "RGBA" if arr.ndim == 3 and arr.shape[2] == 4 else "RGB"
    img = Image.fromarray(arr, mode=mode)
    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=quality, lossless=lossless, method=4)
    return buf.getvalue()


class SatelliteCloudManager:
    """Fetches, reprojects, pan-sharpens, and caches 2 hours of satellite & cloud frames."""

    def __init__(
        self,
        lat: float,
        lon: float,
        radius_deg: float = 3.5,
        provider_override: str = "auto",
        enable_bom_ftp: bool = False,
        out_size: int = 704,
    ) -> None:
        self.lat = lat
        self.lon = lon
        self.bbox = BoundingBox.around(lat, lon, radius_deg)
        self.provider_override = provider_override
        self.enable_bom_ftp = enable_bom_ftp
        self.out_size = out_size

        self.spec: GeostationarySatSpec = select_best_satellite(lat, lon, provider_override)
        self._grid_geocolor: ReprojectionGrid | None = None
        self._grid_vis: ReprojectionGrid | None = None
        self._grid_ir: ReprojectionGrid | None = None

        self._frames: dict[str, SatelliteRenderedFrame] = {}
        self._bom_ftp = BomFtpSatelliteClient()

    def update_aoi(
        self,
        lat: float,
        lon: float,
        radius_deg: float = 3.5,
        provider_override: str = "auto",
    ) -> None:
        """Reconfigure center/radius and invalidate cached LUTs if bounds changed."""
        new_bbox = BoundingBox.around(lat, lon, radius_deg)
        new_spec = select_best_satellite(lat, lon, provider_override)
        if new_bbox != self.bbox or new_spec.sat_id != self.spec.sat_id:
            self.lat = lat
            self.lon = lon
            self.bbox = new_bbox
            self.spec = new_spec
            self._grid_geocolor = None
            self._grid_vis = None
            self._grid_ir = None
            self._frames.clear()

    def _ensure_grids(self) -> tuple[ReprojectionGrid, ReprojectionGrid, ReprojectionGrid]:
        if self._grid_geocolor is None:
            # Choose zoom level proportional to requested span so tile count stays <= 6 tiles
            span = max(self.bbox.east - self.bbox.west, self.bbox.north - self.bbox.south)
            gc_z = self.spec.geocolor_zoom if span <= 11.0 else max(2, self.spec.geocolor_zoom - 1)
            vis_z = min(self.spec.vis_zoom, gc_z + 1) if span <= 8.5 else gc_z
            ir_z = min(self.spec.ir_zoom, gc_z)

            self._grid_geocolor = build_reprojection_grid(
                self.spec, self.bbox, gc_z, out_w=self.out_size, out_h=self.out_size
            )
            self._grid_vis = build_reprojection_grid(
                self.spec, self.bbox, vis_z, out_w=self.out_size, out_h=self.out_size
            )
            self._grid_ir = build_reprojection_grid(
                self.spec, self.bbox, ir_z, out_w=self.out_size, out_h=self.out_size
            )
        assert self._grid_geocolor is not None
        assert self._grid_vis is not None
        assert self._grid_ir is not None
        return self._grid_geocolor, self._grid_vis, self._grid_ir

    async def _fetch_slider_timestamps(
        self, session: aiohttp.ClientSession, product: str
    ) -> list[str]:
        url = f"{SLIDER_BASE}/data/json/{self.spec.sat_id}/full_disk/{product}/latest_times.json"
        async with session.get(url, headers={"User-Agent": USER_AGENT}, timeout=aiohttp.ClientTimeout(total=12)) as resp:
            resp.raise_for_status()
            payload = await resp.json()
            raw_list = payload.get("timestamps_int", [])
            # Keep last ~2h10m (13 frames at 10-min intervals, or 9 frames at 15-min intervals)
            # Returned newest-first by SLIDER; sort ascending (oldest -> newest)
            ordered = sorted(str(x) for x in raw_list[:16])
            if not ordered:
                return []
            latest_epoch, _ = parse_timestamp_key(ordered[-1])
            cutoff = latest_epoch - 130 * 60
            return [ts for ts in ordered if parse_timestamp_key(ts)[0] >= cutoff]

    async def _fetch_stitched_product(
        self,
        session: aiohttp.ClientSession,
        product: str,
        timestamp_str: str,
        grid: ReprojectionGrid,
        channels: int = 3,
    ) -> np.ndarray | None:
        """Download only the few tiles intersecting `grid` and stitch into a canvas."""
        yyyy, mm, dd = timestamp_str[:4], timestamp_str[4:6], timestamp_str[6:8]
        tile_px = self.spec.tile_px
        n_rows = len(grid.tile_rows)
        n_cols = len(grid.tile_cols)
        if n_rows == 0 or n_cols == 0:
            return None

        canvas = (
            np.zeros((n_rows * tile_px, n_cols * tile_px, channels), dtype=np.uint8)
            if channels > 1
            else np.zeros((n_rows * tile_px, n_cols * tile_px), dtype=np.uint8)
        )

        async def _get_one(r_idx: int, c_idx: int, tile_r: int, tile_c: int) -> bool:
            url = (
                f"{SLIDER_BASE}/data/imagery/{yyyy}/{mm}/{dd}/"
                f"{self.spec.sat_id}---full_disk/{product}/{timestamp_str}/"
                f"{grid.zoom:02d}/{tile_r:03d}_{tile_c:03d}.png"
            )
            try:
                async with session.get(
                    url, headers={"User-Agent": USER_AGENT}, timeout=aiohttp.ClientTimeout(total=14)
                ) as resp:
                    if resp.status != 200:
                        return False
                    raw = await resp.read()
                img = Image.open(io.BytesIO(raw)).convert("RGB" if channels == 3 else "L")
                arr = np.asarray(img, dtype=np.uint8)
                y0, x0 = r_idx * tile_px, c_idx * tile_px
                canvas[y0 : y0 + arr.shape[0], x0 : x0 + arr.shape[1]] = arr
                return True
            except Exception as err:  # noqa: BLE001
                _LOGGER.debug("Tile fetch error %s: %s", url, err)
                return False

        tasks = [
            _get_one(ri, ci, tr, tc)
            for ri, tr in enumerate(grid.tile_rows)
            for ci, tc in enumerate(grid.tile_cols)
        ]
        results = await asyncio.gather(*tasks)
        return canvas if any(results) else None

    async def _fetch_jma_fallback_frame(
        self,
        session: aiohttp.ClientSession,
        ts_14: str,
        band: str = "REP",
        prod: str = "ETC",
        channels: int = 3,
    ) -> np.ndarray | None:
        """Fallback Web Mercator tile stitcher from JMA Bosai Full Disk (`z=5`)."""
        z = 5
        n = 2 ** z

        def _lon_to_tile_x(lon_d: float) -> float:
            return ((lon_d + 180.0) / 360.0) * n

        def _lat_to_tile_y(lat_d: float) -> float:
            lat_r = math.radians(max(-85.0, min(85.0, lat_d)))
            return (1.0 - math.log(math.tan(lat_r) + 1.0 / math.cos(lat_r)) / math.pi) / 2.0 * n

        tx_min = int(math.floor(_lon_to_tile_x(self.bbox.west)))
        tx_max = int(math.floor(_lon_to_tile_x(self.bbox.east)))
        ty_min = int(math.floor(_lat_to_tile_y(self.bbox.north)))
        ty_max = int(math.floor(_lat_to_tile_y(self.bbox.south)))

        cols = range(tx_min, tx_max + 1)
        rows = range(ty_min, ty_max + 1)
        canvas = (
            np.zeros((len(rows) * 256, len(cols) * 256, 3), dtype=np.uint8)
            if channels == 3
            else np.zeros((len(rows) * 256, len(cols) * 256), dtype=np.uint8)
        )

        async def _dl(ri: int, ci: int, ty: int, tx: int) -> bool:
            url = JMA_FD_TILE_TPL.format(ts=ts_14, band=band, prod=prod, z=z, x=tx % n, y=ty)
            try:
                async with session.get(
                    url, headers={"User-Agent": USER_AGENT}, timeout=aiohttp.ClientTimeout(total=10)
                ) as r:
                    if r.status != 200:
                        return False
                    im = Image.open(io.BytesIO(await r.read())).convert("RGB" if channels == 3 else "L")
                    canvas[ri * 256 : (ri + 1) * 256, ci * 256 : (ci + 1) * 256] = np.asarray(im, dtype=np.uint8)
                    return True
            except Exception:  # noqa: BLE001
                return False

        ok = await asyncio.gather(
            *[_dl(ri, ci, ty, tx) for ri, ty in enumerate(rows) for ci, tx in enumerate(cols)]
        )
        if not any(ok):
            return None

        # Crop exact Mercator sub-window and resize to out_size x out_size
        px_x0 = (_lon_to_tile_x(self.bbox.west) - tx_min) * 256.0
        px_x1 = (_lon_to_tile_x(self.bbox.east) - tx_min) * 256.0
        px_y0 = (_lat_to_tile_y(self.bbox.north) - ty_min) * 256.0
        px_y1 = (_lat_to_tile_y(self.bbox.south) - ty_min) * 256.0
        pil = Image.fromarray(canvas).crop((px_x0, px_y0, px_x1, px_y1)).resize(
            (self.out_size, self.out_size), Image.Resampling.BILINEAR
        )
        return np.asarray(pil, dtype=np.uint8)

    async def async_refresh(self, session: aiohttp.ClientSession, max_frames: int = 13) -> list[SatelliteRenderedFrame]:
        """Fetch any missing 10-minute frames from the last 2 hours and rebuild cloud masks."""
        gc_grid, vis_grid, ir_grid = self._ensure_grids()

        timestamps: list[str] = []
        vis_lookup: dict[str, str] = {}
        ir_lookup: dict[str, str] = {}
        use_jma_fallback = False

        try:
            gc_times, vis_times, ir_times = await asyncio.gather(
                self._fetch_slider_timestamps(session, "geocolor"),
                self._fetch_slider_timestamps(session, self.spec.vis_band),
                self._fetch_slider_timestamps(session, self.spec.ir_band),
                return_exceptions=True,
            )
            if isinstance(gc_times, list) and gc_times:
                timestamps = gc_times[-max_frames:]
                if isinstance(vis_times, list):
                    # Match by YYYYMMDDHHMM prefix (GOES timestamps include scan seconds)
                    vis_lookup = {t[:12]: t for t in vis_times}
                if isinstance(ir_times, list):
                    ir_lookup = {t[:12]: t for t in ir_times}
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("Primary SLIDER timestamp query failed: %s", err)

        if not timestamps and self.spec.sat_id == "himawari":
            try:
                async with session.get(
                    JMA_FD_TIMES_URL, headers={"User-Agent": USER_AGENT}, timeout=aiohttp.ClientTimeout(total=10)
                ) as resp:
                    if resp.status == 200:
                        jma_items = await resp.json()
                        timestamps = [item["basetime"] for item in jma_items[-max_frames:]]
                        use_jma_fallback = True
            except Exception as err:  # noqa: BLE001
                _LOGGER.warning("JMA fallback timestamp query failed: %s", err)

        if not timestamps:
            return sorted(self._frames.values(), key=lambda f: f.epoch)

        # Prune frames older than earliest retained timestamp
        keep_keys = set(timestamps)
        for old_k in list(self._frames):
            if old_k not in keep_keys:
                del self._frames[old_k]

        missing = [ts for ts in timestamps if ts not in self._frames]

        # Download missing raw RGB/Vis/IR frames with bounded concurrency
        sem = asyncio.Semaphore(4)
        raw_fetched: dict[str, tuple[np.ndarray, np.ndarray | None, np.ndarray | None, str]] = {}

        async def _process_timestamp(ts: str) -> None:
            async with sem:
                if self.enable_bom_ftp and self.spec.sat_id == "himawari":
                    bom_rgb = await self._bom_ftp.async_fetch_cropped_rgb(
                        ts[:12], self.bbox, out_w=self.out_size, out_h=self.out_size
                    )
                    if bom_rgb is not None:
                        raw_fetched[ts] = (bom_rgb, None, None, "BOM Himawari-9 (IDE00406)")
                        return

                if use_jma_fallback:
                    rgb_arr, ir_arr = await asyncio.gather(
                        self._fetch_jma_fallback_frame(session, ts, "REP", "ETC", 3),
                        self._fetch_jma_fallback_frame(session, ts, "B13", "TBB", 1),
                    )
                    if rgb_arr is not None:
                        raw_fetched[ts] = (rgb_arr, None, ir_arr, "JMA Himawari-9 Full Disk")
                    return

                vis_ts = vis_lookup.get(ts[:12])
                ir_ts = ir_lookup.get(ts[:12])

                gc_coro = self._fetch_stitched_product(session, "geocolor", ts, gc_grid, 3)
                vis_coro = (
                    self._fetch_stitched_product(session, self.spec.vis_band, vis_ts, vis_grid, 1)
                    if vis_ts
                    else asyncio.sleep(0, result=None)
                )
                ir_coro = (
                    self._fetch_stitched_product(session, self.spec.ir_band, ir_ts, ir_grid, 1)
                    if ir_ts
                    else asyncio.sleep(0, result=None)
                )
                gc_canvas, vis_canvas, ir_canvas = await asyncio.gather(gc_coro, vis_coro, ir_coro)
                if gc_canvas is None:
                    return

                def _reproject_sync() -> tuple[np.ndarray, np.ndarray | None, np.ndarray | None]:
                    rgb_1km = bilinear_sample(gc_canvas, gc_grid)
                    vis_500m = bilinear_sample(vis_canvas, vis_grid) if vis_canvas is not None else None
                    ir_2km = bilinear_sample(ir_canvas, ir_grid) if ir_canvas is not None else None
                    sharp_rgb = pan_sharpen_true_colour(rgb_1km, vis_500m)
                    vis_u8 = np.clip(vis_500m, 0, 255).astype(np.uint8) if vis_500m is not None else None
                    ir_u8 = np.clip(ir_2km, 0, 255).astype(np.uint8) if ir_2km is not None else None
                    return sharp_rgb, vis_u8, ir_u8

                sharp_rgb, vis_u8, ir_u8 = await asyncio.to_thread(_reproject_sync)
                raw_fetched[ts] = (sharp_rgb, vis_u8, ir_u8, self.spec.label)

        if missing:
            await asyncio.gather(*[_process_timestamp(ts) for ts in missing])

        # Compute multi-frame minimum RGB baseline across all available frames to suppress bright land/sand
        all_rgbs = [f.rgb_preview for f in self._frames.values()] + [v[0] for v in raw_fetched.values()]
        baseline_min: np.ndarray | None = None
        if len(all_rgbs) >= 3:
            baseline_min = np.min(np.stack(all_rgbs, axis=0), axis=0)

        def _encode_missing_sync() -> list[SatelliteRenderedFrame]:
            built: list[SatelliteRenderedFrame] = []
            for ts, (rgb_arr, vis_u8, ir_u8, label) in raw_fetched.items():
                epoch, iso_utc = parse_timestamp_key(ts)
                cloud_mask_rgba, solar_class_rgba, cloud_opt, ir_cold = synthesize_cloud_overlays(
                    rgb_arr, vis_u8, ir_u8, baseline_min_rgb=baseline_min
                )
                built.append(
                    SatelliteRenderedFrame(
                        timestamp_key=ts,
                        epoch=epoch,
                        iso_utc=iso_utc,
                        source_label=label,
                        true_colour_webp=encode_webp(rgb_arr, quality=85),
                        cloud_mask_webp=encode_webp(cloud_mask_rgba, quality=82),
                        solar_cloud_webp=encode_webp(solar_class_rgba, quality=82),
                        rgb_preview=rgb_arr,
                        cloud_optical=cloud_opt,
                        ir_coldness=ir_cold,
                    )
                )
            return built

        if raw_fetched:
            for frame in await asyncio.to_thread(_encode_missing_sync):
                self._frames[frame.timestamp_key] = frame

        return sorted(self._frames.values(), key=lambda f: f.epoch)

    def get_frame(self, timestamp_key: str) -> SatelliteRenderedFrame | None:
        return self._frames.get(timestamp_key)

    def get_ordered_frames(self) -> list[SatelliteRenderedFrame]:
        return sorted(self._frames.values(), key=lambda f: f.epoch)
