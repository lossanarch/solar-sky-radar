"""Geostationary satellite navigation, tile stitching, and cloud mask synthesis.

Reprojects CGMS / GOES-R fixed-grid full-disk satellite tiles (Himawari-9, GOES-19,
GOES-18, Meteosat-0deg, Meteosat-9) directly onto Web Mercator (EPSG:3857) Y / linear
longitude rasters so MapLibre image sources align to coastlines with zero distortion.
"""

from __future__ import annotations

from dataclasses import dataclass
import math
from typing import Final

import numpy as np

from ..const import GEOSTATIONARY_SATELLITES, GeostationarySatSpec

WGS84_R_EQ_KM: Final = 6378.137
WGS84_R_POL_KM: Final = 6356.7523142


@dataclass(frozen=True)
class BoundingBox:
    """Geographic bounding box in WGS84 degrees."""

    west: float
    south: float
    east: float
    north: float

    @classmethod
    def around(cls, lat: float, lon: float, radius_deg: float = 3.5) -> BoundingBox:
        """Create an aspect-balanced regional box around (lat, lon)."""
        cos_lat = max(0.35, math.cos(math.radians(lat)))
        lon_span = min(12.0, radius_deg / cos_lat)
        lat_span = min(9.0, radius_deg)
        return cls(
            west=round(max(-179.9, lon - lon_span), 4),
            south=round(max(-82.0, lat - lat_span), 4),
            east=round(min(179.9, lon + lon_span), 4),
            north=round(min(82.0, lat + lat_span), 4),
        )

    def as_maplibre_coordinates(self) -> list[list[float]]:
        """Return [topLeft, topRight, bottomRight, bottomLeft] [lon, lat] corners."""
        return [
            [self.west, self.north],
            [self.east, self.north],
            [self.east, self.south],
            [self.west, self.south],
        ]


@dataclass
class ReprojectionGrid:
    """Cached pixel lookup table from output Web Mercator raster to satellite disk."""

    sat_id: str
    zoom: int
    bbox: BoundingBox
    out_w: int
    out_h: int
    tile_cols: range
    tile_rows: range
    # Coordinates inside the stitched tile canvas
    local_x: np.ndarray  # float32 (out_h, out_w)
    local_y: np.ndarray  # float32 (out_h, out_w)
    valid_mask: np.ndarray  # bool (out_h, out_w)
    lats_deg: np.ndarray  # float32 (out_h,)
    lons_deg: np.ndarray  # float32 (out_w,)


def mercator_y(lat_deg: float | np.ndarray) -> float | np.ndarray:
    """Convert latitude in degrees to normalized Web Mercator Y."""
    lat_rad = np.radians(np.clip(lat_deg, -85.0511, 85.0511))
    return np.log(np.tan(np.pi / 4.0 + lat_rad / 2.0))


def inverse_mercator_y(y: float | np.ndarray) -> float | np.ndarray:
    """Convert Web Mercator Y back to latitude in degrees."""
    return np.degrees(2.0 * np.arctan(np.exp(y)) - np.pi / 2.0)


def select_best_satellite(lat: float, lon: float, override: str = "auto") -> GeostationarySatSpec:
    """Select the geostationary satellite with the highest viewing elevation for (lat, lon)."""
    if override in GEOSTATIONARY_SATELLITES:
        return GEOSTATIONARY_SATELLITES[override]

    best_spec = GEOSTATIONARY_SATELLITES["himawari"]
    best_cos_zenith = -1.0
    lat_r = math.radians(lat)
    for spec in GEOSTATIONARY_SATELLITES.values():
        dlon_r = math.radians(((lon - spec.sub_lon_deg + 180.0) % 360.0) - 180.0)
        cos_z = math.cos(lat_r) * math.cos(dlon_r)
        # Prefer Himawari-9 slightly across all Australian longitudes (112E..156E)
        if spec.sat_id == "himawari" and 105.0 <= lon <= 179.0 and -55.0 <= lat <= 25.0:
            cos_z += 0.08
        if cos_z > best_cos_zenith:
            best_cos_zenith = cos_z
            best_spec = spec

    return best_spec


def build_reprojection_grid(
    spec: GeostationarySatSpec,
    bbox: BoundingBox,
    zoom: int,
    out_w: int = 768,
    out_h: int = 768,
) -> ReprojectionGrid:
    """Precompute exact vectorized CGMS/FGF forward projection for a Web Mercator bbox."""
    y_north = float(mercator_y(bbox.north))
    y_south = float(mercator_y(bbox.south))
    merc_ys = np.linspace(y_north, y_south, out_h, dtype=np.float64)
    lats_deg = inverse_mercator_y(merc_ys)
    lons_deg = np.linspace(bbox.west, bbox.east, out_w, dtype=np.float64)

    lat_grid = np.radians(lats_deg)[:, None]
    lon_grid = np.radians(lons_deg)[None, :]
    sub_lon = math.radians(spec.sub_lon_deg)
    dlon = (lon_grid - sub_lon + math.pi) % (2.0 * math.pi) - math.pi

    r_ratio_sq = (WGS84_R_POL_KM ** 2) / (WGS84_R_EQ_KM ** 2)
    ecc_sq = (WGS84_R_EQ_KM ** 2 - WGS84_R_POL_KM ** 2) / (WGS84_R_EQ_KM ** 2)

    phi_c = np.arctan(r_ratio_sq * np.tan(lat_grid))
    cos_phi = np.cos(phi_c)
    sin_phi = np.sin(phi_c)
    r_c = WGS84_R_POL_KM / np.sqrt(1.0 - ecc_sq * (cos_phi ** 2))

    h_sat = spec.perspective_height_km
    r_x = r_c * cos_phi * np.cos(dlon)
    r_1 = h_sat - r_x
    r_2 = -r_c * cos_phi * np.sin(dlon)
    r_3 = np.broadcast_to(r_c * sin_phi, r_1.shape)
    r_norm = np.sqrt(r_1 ** 2 + r_2 ** 2 + r_3 ** 2)

    # Check horizon visibility from geostationary orbit
    visible = (r_x * h_sat) > (r_c ** 2)

    if spec.sat_id.startswith("goes-"):
        # NOAA GOES-R ABI Fixed Grid (FGF) scan-angle convention (GOES-R PUG Vol. 3 Sec 5.1.2.8)
        x_rad = np.arcsin(np.clip(-r_2 / np.maximum(r_norm, 1e-6), -1.0, 1.0))
        y_rad = -np.arctan2(r_3, r_1)
    else:
        # WMO CGMS normalized geostationary projection (Himawari-8/9 & Meteosat)
        x_rad = np.arctan2(-r_2, r_1)
        y_rad = np.arcsin(np.clip(-r_3 / np.maximum(r_norm, 1e-6), -1.0, 1.0))

    scale = 2.0 ** (zoom - spec.geocolor_zoom)
    step_rad = spec.step_rad_at_geocolor_z / scale
    total_px = spec.tile_px * (2 ** zoom)
    center_px = total_px / 2.0

    disk_col = center_px + (x_rad / step_rad)
    disk_row = center_px + (y_rad / step_rad)

    valid = (
        visible
        & (disk_col >= 0.0)
        & (disk_col < total_px - 1.0)
        & (disk_row >= 0.0)
        & (disk_row < total_px - 1.0)
    )

    n_tiles = 2 ** zoom
    if np.any(valid):
        min_col_t = max(0, int(np.floor(np.min(disk_col[valid]) / spec.tile_px)))
        max_col_t = min(n_tiles - 1, int(np.floor(np.max(disk_col[valid]) / spec.tile_px)))
        min_row_t = max(0, int(np.floor(np.min(disk_row[valid]) / spec.tile_px)))
        max_row_t = min(n_tiles - 1, int(np.floor(np.max(disk_row[valid]) / spec.tile_px)))
    else:
        min_col_t = max_col_t = min_row_t = max_row_t = 0

    local_x = (disk_col - min_col_t * spec.tile_px).astype(np.float32)
    local_y = (disk_row - min_row_t * spec.tile_px).astype(np.float32)

    return ReprojectionGrid(
        sat_id=spec.sat_id,
        zoom=zoom,
        bbox=bbox,
        out_w=out_w,
        out_h=out_h,
        tile_cols=range(min_col_t, max_col_t + 1),
        tile_rows=range(min_row_t, max_row_t + 1),
        local_x=local_x,
        local_y=local_y,
        valid_mask=valid,
        lats_deg=lats_deg.astype(np.float32),
        lons_deg=lons_deg.astype(np.float32),
    )


def bilinear_sample(canvas: np.ndarray, grid: ReprojectionGrid) -> np.ndarray:
    """Fast vectorized bilinear interpolation from a stitched tile canvas (H, W, C) or (H, W)."""
    is_2d = canvas.ndim == 2
    src = canvas[:, :, None] if is_2d else canvas
    h, w, c = src.shape

    x = np.clip(grid.local_x, 0.0, max(0.0, w - 1.001))
    y = np.clip(grid.local_y, 0.0, max(0.0, h - 1.001))

    x0 = np.floor(x).astype(np.int32)
    y0 = np.floor(y).astype(np.int32)
    x1 = np.minimum(x0 + 1, w - 1)
    y1 = np.minimum(y0 + 1, h - 1)

    wx = (x - x0)[:, :, None]
    wy = (y - y0)[:, :, None]

    Ia = src[y0, x0].astype(np.float32)
    Ib = src[y1, x0].astype(np.float32)
    Ic = src[y0, x1].astype(np.float32)
    Id = src[y1, x1].astype(np.float32)

    out = (Ia * (1.0 - wx) + Ic * wx) * (1.0 - wy) + (Ib * (1.0 - wx) + Id * wx) * wy
    out = np.where(grid.valid_mask[:, :, None], out, 0.0)
    if is_2d:
        return out[:, :, 0]
    return out


def pan_sharpen_true_colour(rgb: np.ndarray, vis_500m: np.ndarray | None) -> np.ndarray:
    """Sharpen 1km GeoColor RGB clouds using 500m visible reflectance during daylight."""
    if vis_500m is None:
        return np.clip(rgb, 0, 255).astype(np.uint8)

    # Only sharpen where daytime visible band has solar illumination
    vis_norm = vis_500m.astype(np.float32) / 255.0
    if float(np.percentile(vis_norm, 95)) < 0.12:
        return np.clip(rgb, 0, 255).astype(np.uint8)

    rgb_f = rgb.astype(np.float32)
    lum = (0.299 * rgb_f[:, :, 0] + 0.587 * rgb_f[:, :, 1] + 0.114 * rgb_f[:, :, 2]) / 255.0
    # High-pass detail ratio from 500m band applied gently to cloud highlights
    detail = np.clip((vis_norm + 0.08) / (lum + 0.08), 0.72, 1.38)
    weight = np.clip((vis_norm - 0.18) / 0.35, 0.0, 0.75)[:, :, None]
    sharpened = rgb_f * (1.0 - weight + weight * detail[:, :, None])
    return np.clip(sharpened, 0, 255).astype(np.uint8)


def synthesize_cloud_overlays(
    rgb: np.ndarray,
    vis_gray: np.ndarray | None,
    ir_gray: np.ndarray | None,
    baseline_min_rgb: np.ndarray | None = None,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Synthesize clean visual cloud RGBA, solar-classified cloud RGBA, optical depth, and IR index.

    Returns:
      - cloud_mask_rgba: (H, W, 4) uint8 clean white/grey visual cloud layer with transparent clear sky
      - solar_class_rgba: (H, W, 4) uint8 color-coded solar cloud impact overlay:
          * Soft cyan-white: thin high cirrus (mild solar impact)
          * Warm amber-gold: patchy low/mid cumulus (rapid solar ramping / intermittent)
          * Deep violet-magenta: thick frontal/convective storm deck (steep solar drop)
      - cloud_optical: (H, W) float32 [0..1] estimated cloud optical opacity
      - ir_coldness: (H, W) float32 [0..1] normalized cloud-top coldness
    """
    rgb_f = rgb.astype(np.float32) / 255.0
    r, g, b = rgb_f[:, :, 0], rgb_f[:, :, 1], rgb_f[:, :, 2]

    max_c = np.maximum(np.maximum(r, g), b)
    min_c = np.minimum(np.minimum(r, g), b)
    chroma = max_c - min_c
    saturation = chroma / np.maximum(max_c, 1e-4)

    # Neutral whiteness suppresses red Australian soil (r >> b) and green forest (g > r, b)
    soil_warmth = np.maximum(0.0, r - b)
    neutral_white = min_c * np.clip(1.0 - 1.65 * saturation, 0.0, 1.0) * np.clip(1.0 - 1.8 * soil_warmth, 0.0, 1.0)

    if vis_gray is not None:
        vis_norm = vis_gray.astype(np.float32) / 255.0
        daylight_strength = float(np.clip((np.percentile(vis_norm, 96) - 0.08) / 0.25, 0.0, 1.0))
    else:
        vis_norm = max_c
        daylight_strength = float(np.clip((np.percentile(neutral_white, 96) - 0.20) / 0.25, 0.0, 1.0))

    # Subtract stationary surface albedo baseline when multi-frame history is available
    if baseline_min_rgb is not None:
        base_f = baseline_min_rgb.astype(np.float32) / 255.0
        base_min_c = np.minimum(np.minimum(base_f[:, :, 0], base_f[:, :, 1]), base_f[:, :, 2])
        # Cap baseline at 0.38 so persistent overcast deck is never subtracted away!
        surface_floor = np.minimum(base_min_c, 0.36)
        transient_boost = np.maximum(0.0, neutral_white - surface_floor * 0.85)
        day_cloud = np.clip((0.55 * (neutral_white - 0.16) + 0.65 * transient_boost) / 0.56, 0.0, 1.0)
    else:
        day_cloud = np.clip((neutral_white - 0.21) / 0.54, 0.0, 1.0)

    if ir_gray is not None:
        ir_norm = ir_gray.astype(np.float32) / 255.0
        # SLIDER & JMA Ch13 greyscale: bright (>0.42) = cold cloud tops (< -5 C)
        ir_cold = np.clip((ir_norm - 0.38) / 0.48, 0.0, 1.0)
    else:
        ir_cold = np.clip((neutral_white - 0.28) / 0.55, 0.0, 1.0)

    # Blend daytime visible cloud thickness (catches warm low Melbourne cumulus!) with IR coldness
    cloud_optical = (
        daylight_strength * np.maximum(day_cloud, 0.68 * ir_cold)
        + (1.0 - daylight_strength) * np.maximum(ir_cold, day_cloud * 0.75)
    ).astype(np.float32)
    cloud_optical = np.clip(cloud_optical, 0.0, 1.0)

    # 1. Clean Visual Cloud Mask RGBA (smooth feathering on thin edges, crisp bright thick tops)
    alpha_clean = np.clip(np.maximum(0.0, (cloud_optical - 0.07) / 0.78) ** 0.88, 0.0, 0.94)
    shade = np.clip(205.0 + 50.0 * (cloud_optical ** 0.7), 200.0, 255.0)
    # Subtle cool-blue shadow tint in dense storm cloud bases for visual depth
    blue_tint = np.clip(shade + 6.0 * ir_cold, 200.0, 255.0)
    rg_tint = np.clip(shade - 12.0 * (ir_cold ** 1.5), 188.0, 255.0)

    cloud_mask_rgba = np.zeros((*cloud_optical.shape, 4), dtype=np.uint8)
    cloud_mask_rgba[:, :, 0] = rg_tint.astype(np.uint8)
    cloud_mask_rgba[:, :, 1] = np.clip(rg_tint + 3.0, 190.0, 255.0).astype(np.uint8)
    cloud_mask_rgba[:, :, 2] = blue_tint.astype(np.uint8)
    cloud_mask_rgba[:, :, 3] = (alpha_clean * 255.0).astype(np.uint8)

    # 2. Solar Cloud Classification RGBA
    # Compute 5x5 local spatial variance via fast box-filter integral to highlight patchy cumulus
    pad = 3
    padded = np.pad(cloud_optical, pad, mode="edge")
    csum = np.pad(padded, ((1, 0), (1, 0)), mode="constant").cumsum(0).cumsum(1)
    k = 2 * pad + 1
    local_mean = (csum[k:, k:] - csum[:-k, k:] - csum[k:, :-k] + csum[:-k, :-k]) / float(k * k)
    sq_pad = np.pad(cloud_optical ** 2, pad, mode="edge")
    csum2 = np.pad(sq_pad, ((1, 0), (1, 0)), mode="constant").cumsum(0).cumsum(1)
    local_var = np.maximum(0.0, (csum2[k:, k:] - csum2[:-k, k:] - csum2[k:, :-k] + csum2[:-k, :-k]) / float(k * k) - local_mean ** 2)
    local_std = np.sqrt(local_var)

    # Classification weights:
    # - storm_w: thick optical + cold IR top -> deep convective/frontal drop (violet/magenta-red)
    # - cirrus_w: cold IR top + modest visible optical -> thin high cirrus (ice cyan)
    # - patchy_w: broken/moderate optical or high local edge texture -> intermittent PV ramping (amber)
    storm_w = np.clip((cloud_optical - 0.56) / 0.32, 0.0, 1.0) * np.clip((ir_cold - 0.42) / 0.38, 0.25, 1.0)
    cirrus_w = np.clip((ir_cold - 0.35) / 0.40, 0.0, 1.0) * np.clip(1.0 - (day_cloud - 0.15) / 0.42, 0.0, 1.0)
    patchy_w = np.clip(local_std / 0.14, 0.0, 1.0) * (1.0 - 0.7 * storm_w)
    overcast_w = np.clip(1.0 - storm_w - cirrus_w - patchy_w, 0.0, 1.0)

    total_w = np.maximum(storm_w + cirrus_w + patchy_w + overcast_w, 1e-4)
    storm_w /= total_w
    cirrus_w /= total_w
    patchy_w /= total_w
    overcast_w /= total_w

    # Palette (R, G, B):
    # Cirrus: (125, 226, 255) | Patchy: (255, 196, 77) | Overcast: (226, 232, 240) | Storm: (192, 92, 255)
    sc_r = 125.0 * cirrus_w + 255.0 * patchy_w + 226.0 * overcast_w + 192.0 * storm_w
    sc_g = 226.0 * cirrus_w + 196.0 * patchy_w + 232.0 * overcast_w + 92.0 * storm_w
    sc_b = 255.0 * cirrus_w + 77.0 * patchy_w + 240.0 * overcast_w + 255.0 * storm_w

    solar_class_rgba = np.zeros((*cloud_optical.shape, 4), dtype=np.uint8)
    solar_class_rgba[:, :, 0] = np.clip(sc_r, 0, 255).astype(np.uint8)
    solar_class_rgba[:, :, 1] = np.clip(sc_g, 0, 255).astype(np.uint8)
    solar_class_rgba[:, :, 2] = np.clip(sc_b, 0, 255).astype(np.uint8)
    solar_class_rgba[:, :, 3] = (np.clip(alpha_clean * 1.04, 0.0, 0.92) * 255.0).astype(np.uint8)

    return cloud_mask_rgba, solar_class_rgba, cloud_optical, ir_cold.astype(np.float32)
