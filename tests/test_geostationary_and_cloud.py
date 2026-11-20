"""Tests for geostationary CGMS/GOES-R projection math and cloud synthesis."""

from __future__ import annotations

import numpy as np

from custom_components.solar_sky_radar.const import GEOSTATIONARY_SATELLITES
from custom_components.solar_sky_radar.providers.geostationary import (
    BoundingBox,
    build_reprojection_grid,
    pan_sharpen_true_colour,
    select_best_satellite,
    synthesize_cloud_overlays,
)


def test_satellite_selection_priority() -> None:
    # Melbourne -> Himawari-9
    assert select_best_satellite(-37.8136, 144.9631).sat_id == "himawari"
    # New York -> GOES-19
    assert select_best_satellite(40.7128, -74.0060).sat_id == "goes-19"
    # San Francisco -> GOES-18
    assert select_best_satellite(37.7749, -122.4194).sat_id == "goes-18"
    # London -> Meteosat 0 deg
    assert select_best_satellite(51.5072, -0.1276).sat_id == "meteosat-0deg"


def test_melbourne_himawari_projection_and_compact_tile_window() -> None:
    spec = GEOSTATIONARY_SATELLITES["himawari"]
    bbox = BoundingBox.around(-37.8136, 144.9631, radius_deg=2.4)
    grid = build_reprojection_grid(spec, bbox, zoom=4, out_w=128, out_h=128)

    assert np.all(grid.valid_mask)
    tile_count = len(grid.tile_cols) * len(grid.tile_rows)
    assert 1 <= tile_count <= 6
    # Melbourne sits in the southern-eastern quadrant of Himawari-9 full disk (z=4 -> 16x16 tiles)
    assert min(grid.tile_cols) >= 7
    assert min(grid.tile_rows) >= 11


def test_goes19_fgf_projection_new_york() -> None:
    spec = GEOSTATIONARY_SATELLITES["goes-19"]
    bbox = BoundingBox.around(40.7128, -74.0060, radius_deg=2.0)
    grid = build_reprojection_grid(spec, bbox, zoom=4, out_w=64, out_h=64)

    assert np.all(grid.valid_mask)
    # New York is nearly due north of -75.2W sub-satellite point (center tile col ~ 7..8)
    assert 6 <= min(grid.tile_cols) <= 9
    assert 1 <= min(grid.tile_rows) <= 4


def test_pan_sharpen_true_colour_injects_500m_detail() -> None:
    rgb = np.full((32, 32, 3), 120, dtype=np.uint8)
    vis = np.full((32, 32), 120, dtype=np.uint8)
    vis[::2, ::2] = 225  # High-frequency 500m cumulus highlights

    sharpened = pan_sharpen_true_colour(rgb, vis)
    assert sharpened.shape == (32, 32, 3)
    assert sharpened.dtype == np.uint8
    assert float(sharpened.std()) > 12.0


def test_cloud_overlay_synthesis_regimes() -> None:
    # Build a 64x64 synthetic scene with 4 distinct 32x32 regimes:
    # Top-Left:     Clear warm dark ocean/land
    # Top-Right:    Thin high ice cirrus (dark visible, very cold/bright IR)
    # Bottom-Left:  Patchy low cumulus (checkerboard bright visible, warm IR)
    # Bottom-Right: Deep convective storm deck (bright visible + very cold/bright IR)
    rgb = np.full((64, 64, 3), 24, dtype=np.uint8)
    vis = np.full((64, 64), 24, dtype=np.uint8)
    ir = np.full((64, 64), 30, dtype=np.uint8)

    # Top-Right: Thin high cirrus
    rgb[0:32, 32:64] = 55
    vis[0:32, 32:64] = 55
    ir[0:32, 32:64] = 215

    # Bottom-Left: Patchy cumulus checkerboard
    rgb[32:64:2, 0:32:2] = 230
    vis[32:64:2, 0:32:2] = 230
    ir[32:64, 0:32] = 110

    # Bottom-Right: Deep storm deck
    rgb[32:64, 32:64] = 245
    vis[32:64, 32:64] = 245
    ir[32:64, 32:64] = 235

    cloud_mask_rgba, solar_rgba, optical, ir_cold = synthesize_cloud_overlays(
        rgb=rgb,
        vis_gray=vis,
        ir_gray=ir,
        baseline_min_rgb=None,
    )

    assert cloud_mask_rgba.shape == (64, 64, 4)
    assert solar_rgba.shape == (64, 64, 4)
    assert optical.shape == (64, 64)
    assert ir_cold.shape == (64, 64)

    # Clear pixel is fully transparent
    assert solar_rgba[10, 10, 3] == 0
    # Thin cirrus is semi-transparent cyan-blue (B > R)
    assert solar_rgba[10, 48, 3] > 60
    assert solar_rgba[10, 48, 2] > solar_rgba[10, 48, 0]
    # Patchy cumulus bright cell has warm amber tint (R > B)
    assert solar_rgba[40, 8, 3] > 120
    assert solar_rgba[40, 8, 0] > solar_rgba[40, 8, 2]
    # Deep storm core has high alpha and strong violet-magenta B channel
    assert solar_rgba[48, 48, 3] > 210
    assert solar_rgba[48, 48, 2] > 200
