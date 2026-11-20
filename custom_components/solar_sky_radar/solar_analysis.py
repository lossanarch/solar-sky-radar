"""Solar PV Cloud Nowcast, Spatial Patchiness, and Upwind Arrival ETA Engine.

Uses high-resolution geostationary cloud optical opacity + IR cloud-top coldness
combined with 850 hPa cloud-steering winds to answer two practical daytime solar PV
questions:
1. Is current sky cover reliable or patchy/intermittent (inverter ramping risk)?
2. Are thick frontal or storm clouds approaching upwind, and in how many minutes
   will solar generation drop?
"""

from __future__ import annotations

from dataclasses import dataclass
import math
from typing import Any

import numpy as np

from .providers.geostationary import BoundingBox, mercator_y
from .providers.wind import WindFieldSnapshot


@dataclass
class SolarCloudAnalysis:
    """Computed solar sky condition, patchiness, and upwind cloud arrival metrics."""

    regime: str
    regime_label: str
    summary: str
    solar_reliability_score: int  # 0 (unreliable/storm) .. 100 (steady clear)
    estimated_transmittance_pct: int  # Estimated % of clear-sky irradiance reaching panels
    local_cloud_cover_pct: float
    local_optical_depth: float
    local_ir_coldness: float
    patchiness_index: float  # 0 (uniform) .. 100 (highly broken cumulus)
    approaching_cloud_eta_min: int | None
    clearing_eta_min: int | None
    cloud_wind_speed_kmh: float
    cloud_wind_from_deg: float
    forecast_60m: list[dict[str, float | int]]  # 10-min steps +10..+60m
    arrival_arcs_geojson: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "regime": self.regime,
            "regime_label": self.regime_label,
            "summary": self.summary,
            "solar_reliability_score": self.solar_reliability_score,
            "estimated_transmittance_pct": self.estimated_transmittance_pct,
            "local_cloud_cover_pct": round(self.local_cloud_cover_pct, 1),
            "local_optical_depth": round(self.local_optical_depth, 3),
            "local_ir_coldness": round(self.local_ir_coldness, 3),
            "patchiness_index": round(self.patchiness_index, 1),
            "approaching_cloud_eta_min": self.approaching_cloud_eta_min,
            "clearing_eta_min": self.clearing_eta_min,
            "cloud_wind_speed_kmh": round(self.cloud_wind_speed_kmh, 1),
            "cloud_wind_from_deg": round(self.cloud_wind_from_deg, 0),
            "forecast_60m": self.forecast_60m,
            "arrival_arcs_geojson": self.arrival_arcs_geojson,
        }


def destination_latlon(lat_deg: float, lon_deg: float, bearing_deg: float, distance_km: float) -> tuple[float, float]:
    """Great-circle destination point from (lat, lon) along initial `bearing_deg` for `distance_km`."""
    r_earth = 6371.0
    ang = distance_km / r_earth
    brng = math.radians(bearing_deg)
    lat1 = math.radians(lat_deg)
    lon1 = math.radians(lon_deg)

    sin_lat2 = math.sin(lat1) * math.cos(ang) + math.cos(lat1) * math.sin(ang) * math.cos(brng)
    lat2 = math.asin(max(-1.0, min(1.0, sin_lat2)))
    y = math.sin(brng) * math.sin(ang) * math.cos(lat1)
    x = math.cos(ang) - math.sin(lat1) * math.sin(lat2)
    lon2 = lon1 + math.atan2(y, x)
    lon2_deg = ((math.degrees(lon2) + 540.0) % 360.0) - 180.0
    return math.degrees(lat2), lon2_deg


def latlon_to_raster_rc(lat: float, lon: float, bbox: BoundingBox, h: int, w: int) -> tuple[int, int]:
    """Map WGS84 (lat, lon) onto Web Mercator raster row/col indices."""
    yn = float(mercator_y(bbox.north))
    ys = float(mercator_y(bbox.south))
    yp = float(mercator_y(lat))
    row = int(round(((yn - yp) / max(1e-6, yn - ys)) * (h - 1)))
    col = int(round(((lon - bbox.west) / max(1e-6, bbox.east - bbox.west)) * (w - 1)))
    return max(0, min(h - 1, row)), max(0, min(w - 1, col))


def build_upwind_arrival_arcs_geojson(
    home_lat: float,
    home_lon: float,
    upwind_bearing_deg: float,
    cloud_speed_kmh: float,
) -> dict[str, Any]:
    """Build GeoJSON upwind arrival arcs (15m, 30m, 60m) + steering corridor centerline."""
    features: list[dict[str, Any]] = []
    eff_speed = max(8.0, float(cloud_speed_kmh))

    for minutes in (15, 30, 60):
        dist_km = eff_speed * (minutes / 60.0)
        arc_coords: list[list[float]] = []
        # 76-degree upwind fan centered on the cloud approach bearing
        for offset in np.linspace(-38.0, 38.0, 25):
            la, lo = destination_latlon(home_lat, home_lon, upwind_bearing_deg + float(offset), dist_km)
            arc_coords.append([round(lo, 5), round(la, 5)])

        mid_lat, mid_lon = destination_latlon(home_lat, home_lon, upwind_bearing_deg, dist_km)
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": arc_coords},
                "properties": {
                    "kind": "arrival_arc",
                    "minutes": minutes,
                    "distance_km": round(dist_km, 1),
                    "label": f"{minutes}m ({round(dist_km)} km)",
                },
            }
        )
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [round(mid_lon, 5), round(mid_lat, 5)]},
                "properties": {
                    "kind": "arrival_label",
                    "minutes": minutes,
                    "label": f"{minutes} min upwind",
                },
            }
        )

    # Upwind approach ray from 60-min arc to home array
    far_lat, far_lon = destination_latlon(home_lat, home_lon, upwind_bearing_deg, eff_speed * 1.05)
    features.append(
        {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [[round(far_lon, 5), round(far_lat, 5)], [round(home_lon, 5), round(home_lat, 5)]],
            },
            "properties": {
                "kind": "approach_vector",
                "bearing_from_deg": round(upwind_bearing_deg, 0),
                "speed_kmh": round(cloud_speed_kmh, 1),
            },
        }
    )

    return {"type": "FeatureCollection", "features": features}


def analyze_solar_sky(
    home_lat: float,
    home_lon: float,
    bbox: BoundingBox,
    cloud_optical: np.ndarray | None,
    ir_coldness: np.ndarray | None,
    wind: WindFieldSnapshot | None,
) -> SolarCloudAnalysis:
    """Analyze overhead and upwind satellite cloud fields for daytime solar PV prediction."""
    cloud_speed = wind.center_cloud_speed_kmh if wind else 25.0
    cloud_from_deg = wind.center_cloud_dir_deg if wind else 270.0
    arcs_geojson = build_upwind_arrival_arcs_geojson(home_lat, home_lon, cloud_from_deg, cloud_speed)

    if cloud_optical is None or cloud_optical.size == 0:
        return SolarCloudAnalysis(
            regime="unknown",
            regime_label="Loading Satellite Cloud Data",
            summary="Waiting for initial geostationary cloud scan.",
            solar_reliability_score=50,
            estimated_transmittance_pct=75,
            local_cloud_cover_pct=0.0,
            local_optical_depth=0.0,
            local_ir_coldness=0.0,
            patchiness_index=0.0,
            approaching_cloud_eta_min=None,
            clearing_eta_min=None,
            cloud_wind_speed_kmh=cloud_speed,
            cloud_wind_from_deg=cloud_from_deg,
            forecast_60m=[],
            arrival_arcs_geojson=arcs_geojson,
        )

    h, w = cloud_optical.shape
    ir_arr = ir_coldness if ir_coldness is not None and ir_coldness.shape == cloud_optical.shape else np.zeros_like(cloud_optical)

    # Approximate km per pixel near home site
    km_per_px_ew = ((bbox.east - bbox.west) * 111.32 * math.cos(math.radians(home_lat))) / max(1, w)
    km_per_px_ns = ((bbox.north - bbox.south) * 110.57) / max(1, h)
    km_per_px = max(0.35, 0.5 * (km_per_px_ew + km_per_px_ns))

    r0, c0 = latlon_to_raster_rc(home_lat, home_lon, bbox, h, w)
    local_rad_px = max(3, int(round(12.0 / km_per_px)))
    patch_rad_px = max(6, int(round(32.0 / km_per_px)))

    local_patch = cloud_optical[
        max(0, r0 - local_rad_px) : min(h, r0 + local_rad_px + 1),
        max(0, c0 - local_rad_px) : min(w, c0 + local_rad_px + 1),
    ]
    local_ir_patch = ir_arr[
        max(0, r0 - local_rad_px) : min(h, r0 + local_rad_px + 1),
        max(0, c0 - local_rad_px) : min(w, c0 + local_rad_px + 1),
    ]
    wide_patch = cloud_optical[
        max(0, r0 - patch_rad_px) : min(h, r0 + patch_rad_px + 1),
        max(0, c0 - patch_rad_px) : min(w, c0 + patch_rad_px + 1),
    ]

    local_cover_pct = float(np.mean(local_patch >= 0.22) * 100.0)
    local_opt = float(np.mean(local_patch))
    local_ir = float(np.mean(local_ir_patch))

    # Spatial patchiness combines standard deviation and adjacent pixel gradient (cloud edges!)
    std_val = float(np.std(wide_patch))
    if wide_patch.shape[0] > 2 and wide_patch.shape[1] > 2:
        grad_y = np.abs(np.diff(wide_patch, axis=0)).mean()
        grad_x = np.abs(np.diff(wide_patch, axis=1)).mean()
        edge_density = float(0.5 * (grad_x + grad_y))
    else:
        edge_density = 0.0
    patchiness = float(np.clip((std_val * 240.0) + (edge_density * 380.0), 0.0, 100.0))

    # Thin cirrus lets much more diffuse light through than low/deep water/storm clouds
    is_thin_cirrus = local_ir >= 0.38 and local_opt <= 0.44
    attenuation = (0.38 * local_opt) if is_thin_cirrus else (0.84 * (local_opt ** 1.05))
    transmittance_pct = int(round(np.clip((1.0 - attenuation) * 100.0, 8.0, 100.0)))

    # Raycast upwind along `cloud_from_deg` for the next 75 minutes of cloud advection
    approaching_eta: int | None = None
    clearing_eta: int | None = None
    forecast_60m: list[dict[str, float | int]] = []

    if cloud_speed >= 5.0:
        for step_min in range(5, 76, 5):
            dist_km = cloud_speed * (step_min / 60.0)
            samples_opt: list[float] = []
            samples_ir: list[float] = []
            for fan_deg in (-10.0, 0.0, 10.0):
                la, lo = destination_latlon(home_lat, home_lon, cloud_from_deg + fan_deg, dist_km)
                if not (bbox.south <= la <= bbox.north and bbox.west <= lo <= bbox.east):
                    continue
                rr, cc = latlon_to_raster_rc(la, lo, bbox, h, w)
                box_r = max(1, int(round(4.0 / km_per_px)))
                sub_o = cloud_optical[max(0, rr - box_r) : min(h, rr + box_r + 1), max(0, cc - box_r) : min(w, cc + box_r + 1)]
                sub_i = ir_arr[max(0, rr - box_r) : min(h, rr + box_r + 1), max(0, cc - box_r) : min(w, cc + box_r + 1)]
                if sub_o.size:
                    samples_opt.append(float(np.mean(sub_o)))
                    samples_ir.append(float(np.mean(sub_i)))

            if not samples_opt:
                continue
            step_opt = float(np.mean(samples_opt))
            step_ir = float(np.mean(samples_ir))
            step_trans = int(round(np.clip((1.0 - 0.84 * step_opt) * 100.0, 8.0, 100.0)))

            if step_min <= 60 and step_min % 10 == 0:
                forecast_60m.append(
                    {
                        "minutes_ahead": step_min,
                        "cloud_opacity_pct": round(step_opt * 100.0, 0),
                        "est_solar_pct": step_trans,
                    }
                )

            # Detect approaching heavy cloud drop when current sky is noticeably clearer
            is_heavy_upwind = (step_opt >= 0.62) or (step_opt >= 0.52 and step_ir >= 0.45)
            if approaching_eta is None and local_opt < 0.52 and is_heavy_upwind and (step_opt - local_opt) >= 0.16:
                approaching_eta = step_min

            # Detect approaching clear break when currently under heavy cloud
            if clearing_eta is None and local_opt >= 0.56 and step_opt <= 0.26:
                clearing_eta = step_min

    # Determine primary solar sky regime and human-readable guidance
    compass = _deg_to_compass(cloud_from_deg)
    if local_opt >= 0.68 and local_ir >= 0.48:
        regime = "storm_overhead"
        regime_label = "Heavy / Storm Cloud Deck"
        reliability = 15
        if clearing_eta:
            summary = f"Thick storm cloud overhead (~{transmittance_pct}% solar); clearer break ~{clearing_eta}m upwind ({compass})."
        else:
            summary = f"Dense storm/frontal cloud deck overhead (~{transmittance_pct}% of clear-sky solar)."
    elif approaching_eta is not None and approaching_eta <= 65:
        regime = "storm_approaching"
        regime_label = f"Cloud Drop in ~{approaching_eta}m"
        reliability = max(20, 65 - int(60 - approaching_eta) // 2)
        summary = (
            f"Thick cloud band approaching from {compass} at {round(cloud_speed)} km/h — "
            f"expect sharp solar drop in ~{approaching_eta} min."
        )
    elif patchiness >= 36.0 and 15.0 <= local_cover_pct <= 90.0:
        regime = "patchy_unreliable"
        regime_label = "Patchy / Intermittent Solar"
        reliability = max(25, int(round(75.0 - 0.55 * patchiness)))
        summary = (
            f"Patchy broken cloud ({round(local_cover_pct)}% cover, patchiness {round(patchiness)}/100) — "
            f"frequent solar PV ramps likely."
        )
    elif is_thin_cirrus and local_cover_pct >= 25.0:
        regime = "thin_high_cloud"
        regime_label = "Thin High Cloud (Steady)"
        reliability = 78
        summary = f"High thin cirrus (~{transmittance_pct}% solar transmittance) — smooth, predictable output."
    elif local_cover_pct >= 78.0 and local_opt >= 0.50:
        regime = "overcast_low"
        regime_label = "Solid Overcast (Diffuse)"
        reliability = 45
        if clearing_eta:
            summary = f"Uniform overcast (~{transmittance_pct}% diffuse solar); brighter slot ~{clearing_eta}m away ({compass})."
        else:
            summary = f"Uniform overcast deck (~{transmittance_pct}% diffuse solar, low variability)."
    elif local_cover_pct < 20.0:
        regime = "clear_reliable"
        regime_label = "Clear / Reliable Solar"
        reliability = 95
        summary = f"Clear sky ({round(local_cover_pct)}% cloud) — steady clear-sky solar output."
    else:
        regime = "partly_cloudy"
        regime_label = "Light / Partly Cloudy"
        reliability = int(round(np.clip(88.0 - 0.45 * local_cover_pct - 0.3 * patchiness, 45.0, 90.0)))
        summary = f"Scattered cloud ({round(local_cover_pct)}% cover, ~{transmittance_pct}% solar transmittance)."

    return SolarCloudAnalysis(
        regime=regime,
        regime_label=regime_label,
        summary=summary,
        solar_reliability_score=reliability,
        estimated_transmittance_pct=transmittance_pct,
        local_cloud_cover_pct=local_cover_pct,
        local_optical_depth=local_opt,
        local_ir_coldness=local_ir,
        patchiness_index=patchiness,
        approaching_cloud_eta_min=approaching_eta,
        clearing_eta_min=clearing_eta,
        cloud_wind_speed_kmh=cloud_speed,
        cloud_wind_from_deg=cloud_from_deg,
        forecast_60m=forecast_60m,
        arrival_arcs_geojson=arcs_geojson,
    )


def _deg_to_compass(deg: float) -> str:
    dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
    idx = int(round((deg % 360.0) / 22.5)) % 16
    return dirs[idx]
