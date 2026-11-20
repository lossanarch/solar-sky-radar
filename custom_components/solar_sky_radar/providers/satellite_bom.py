"""Optional Australian Bureau of Meteorology (BOM) Anonymous FTP satellite client.

Supports fetching 10-minute Australia-domain Equirectangular Himawari-9 imagery
(`IDE00435` 1km True Colour/IR, `IDE00439` 500m Visible, `IDE00430` 2km Cloud Mask,
`IDE00406` 2km True Colour JPG) from `ftp://ftp.bom.gov.au/anon/gen/gms/` when port 21
egress is reachable on the host network, and cropping/warping onto Web Mercator.
"""

from __future__ import annotations

import asyncio
import ftplib
import io
import logging
from typing import Final

import numpy as np
from PIL import Image

from .geostationary import BoundingBox, inverse_mercator_y, mercator_y

_LOGGER = logging.getLogger(__name__)

# BOM Australia Equirectangular Satellite Domain (from BOM IDBEA006 / IDBEA007 User Guides)
BOM_AUS_WEST: Final = 85.0
BOM_AUS_EAST: Final = 195.0  # 165W wrapped East of 180
BOM_AUS_SOUTH: Final = -55.0
BOM_AUS_NORTH: Final = 20.0
BOM_FTP_HOST: Final = "ftp.bom.gov.au"
BOM_FTP_DIR: Final = "/anon/gen/gms"


def warp_bom_equirectangular_to_mercator(
    img_array: np.ndarray,
    bbox: BoundingBox,
    out_w: int = 768,
    out_h: int = 768,
) -> np.ndarray:
    """Crop and warp an Australia-domain Equirectangular BOM raster onto Web Mercator Y."""
    src_h, src_w = img_array.shape[:2]
    y_north = float(mercator_y(bbox.north))
    y_south = float(mercator_y(bbox.south))
    lats = inverse_mercator_y(np.linspace(y_north, y_south, out_h, dtype=np.float64))
    lons = np.linspace(bbox.west, bbox.east, out_w, dtype=np.float64)
    lons_wrapped = np.where(lons < 0.0, lons + 360.0, lons)

    row_f = ((BOM_AUS_NORTH - lats) / (BOM_AUS_NORTH - BOM_AUS_SOUTH)) * (src_h - 1)
    col_f = ((lons_wrapped - BOM_AUS_WEST) / (BOM_AUS_EAST - BOM_AUS_WEST)) * (src_w - 1)

    r_idx = np.clip(np.round(row_f).astype(np.int32), 0, src_h - 1)
    c_idx = np.clip(np.round(col_f).astype(np.int32), 0, src_w - 1)
    return img_array[r_idx[:, None], c_idx[None, :]]


def _sync_list_bom_timestamps(product_code: str = "IDE00406", timeout: float = 6.0) -> list[str]:
    """List recent UTC timestamps (YYYYMMDDHHMM) for a BOM product via anonymous FTP."""
    ftp = ftplib.FTP(BOM_FTP_HOST, timeout=timeout)
    try:
        ftp.login()
        ftp.cwd(BOM_FTP_DIR)
        names = ftp.nlst()
        prefix = f"{product_code}."
        stamps: list[str] = []
        for name in names:
            if name.startswith(prefix) and (name.endswith(".jpg") or name.endswith(".tif")):
                parts = name.split(".")
                if len(parts) >= 3 and len(parts[1]) == 12 and parts[1].isdigit():
                    stamps.append(parts[1])
        return sorted(set(stamps))
    finally:
        try:
            ftp.quit()
        except Exception:  # noqa: BLE001
            ftp.close()


def _sync_fetch_bom_file(filename: str, timeout: float = 12.0) -> bytes:
    """Download a single file from BOM anonymous FTP into memory."""
    buf = io.BytesIO()
    ftp = ftplib.FTP(BOM_FTP_HOST, timeout=timeout)
    try:
        ftp.login()
        ftp.cwd(BOM_FTP_DIR)
        ftp.retrbinary(f"RETR {filename}", buf.write)
        return buf.getvalue()
    finally:
        try:
            ftp.quit()
        except Exception:  # noqa: BLE001
            ftp.close()


class BomFtpSatelliteClient:
    """Non-blocking BOM anonymous FTP helper with automatic reachability circuit-breaker."""

    def __init__(self) -> None:
        self._ftp_reachable: bool | None = None

    @property
    def is_available(self) -> bool:
        return self._ftp_reachable is not False

    async def async_list_recent_timestamps(self, limit: int = 13) -> list[str]:
        """Return up to `limit` latest 10-minute timestamps if FTP port 21 is open."""
        if self._ftp_reachable is False:
            return []
        try:
            stamps = await asyncio.to_thread(_sync_list_bom_timestamps, "IDE00406", 4.5)
            self._ftp_reachable = bool(stamps)
            return stamps[-limit:]
        except Exception as err:  # noqa: BLE001
            _LOGGER.debug("BOM anonymous FTP unreachable (%s); using HTTPS Himawari-9 tiles", err)
            self._ftp_reachable = False
            return []

    async def async_fetch_cropped_rgb(
        self,
        timestamp_12: str,
        bbox: BoundingBox,
        out_w: int = 768,
        out_h: int = 768,
    ) -> np.ndarray | None:
        """Fetch IDE00406 True Colour/IR composite and warp onto Web Mercator bbox."""
        if self._ftp_reachable is False:
            return None
        try:
            raw = await asyncio.to_thread(_sync_fetch_bom_file, f"IDE00406.{timestamp_12}.jpg", 12.0)
            img = Image.open(io.BytesIO(raw)).convert("RGB")
            arr = np.asarray(img, dtype=np.uint8)
            return warp_bom_equirectangular_to_mercator(arr, bbox, out_w=out_w, out_h=out_h)
        except Exception as err:  # noqa: BLE001
            _LOGGER.debug("BOM FTP fetch failed for %s: %s", timestamp_12, err)
            self._ftp_reachable = False
            return None
