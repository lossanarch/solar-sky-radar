"""Tests for solar PV cloud patchiness, upwind arrival ETA, FIRMS/DEA, and Blitzortung."""

from __future__ import annotations

from datetime import datetime, timezone

import numpy as np

from custom_components.solar_sky_radar.engine import RadarSkyEngine
from custom_components.solar_sky_radar.providers.firms import (
    enrich_hotspots_with_incidents,
    parse_firms_csv,
    parse_nsw_rfs_geojson,
    parse_vic_emergency_geojson,
)
from custom_components.solar_sky_radar.providers.geostationary import BoundingBox
from custom_components.solar_sky_radar.providers.lightning import (
    LightningStrikeBuffer,
    lzw_decode_blitzortung,
)
from custom_components.solar_sky_radar.providers.wind import (
    WindFieldSnapshot,
    meteorological_to_uv_ms,
)
from custom_components.solar_sky_radar.solar_analysis import analyze_solar_sky


def _make_uniform_wind(bbox: BoundingBox, speed_kmh: float, from_deg: float) -> WindFieldSnapshot:
    lats = [bbox.south, 0.5 * (bbox.south + bbox.north), bbox.north]
    lons = [bbox.west, 0.5 * (bbox.west + bbox.east), bbox.east]
    u_ms, v_ms = meteorological_to_uv_ms(speed_kmh, from_deg)
    u_flat = [u_ms] * 9
    v_flat = [v_ms] * 9
    return WindFieldSnapshot(
        fetched_epoch=1_760_000_000,
        bbox=bbox,
        rows=3,
        cols=3,
        lats=lats,
        lons=lons,
        u_10m=u_flat,
        v_10m=v_flat,
        u_850hpa=u_flat,
        v_850hpa=v_flat,
        center_surface_speed_kmh=speed_kmh * 0.5,
        center_surface_dir_deg=from_deg,
        center_cloud_speed_kmh=speed_kmh,
        center_cloud_dir_deg=from_deg,
        shortwave_wm2=780.0,
        direct_wm2=650.0,
        diffuse_wm2=130.0,
        model_cloud_cover_pct=15.0,
    )


def test_solar_analysis_clear_vs_patchy_vs_upwind_eta() -> None:
    home_lat, home_lon = -37.8136, 144.9631
    bbox = BoundingBox.around(home_lat, home_lon, radius_deg=2.0)
    # 60 km/h NW (315 deg) cloud-steering wind -> clouds travel 1.0 km per minute
    wind = _make_uniform_wind(bbox, speed_kmh=60.0, from_deg=315.0)

    # 1) Clear sky over Melbourne, with a heavy frontal cloud band ~30 km NW upwind
    optical = np.zeros((240, 240), dtype=np.float32)
    ir = np.zeros((240, 240), dtype=np.float32)
    optical[78:106, 78:106] = 0.85
    ir[78:106, 78:106] = 0.72

    res = analyze_solar_sky(home_lat, home_lon, bbox, optical, ir, wind)
    assert res.local_cloud_cover_pct < 5.0
    assert res.estimated_transmittance_pct > 90
    assert res.approaching_cloud_eta_min is not None
    assert 15 <= res.approaching_cloud_eta_min <= 45
    assert res.regime == "storm_approaching"
    assert len(res.arrival_arcs_geojson["features"]) == 4
    assert all(
        f["properties"]["kind"] in ("arrival_arc", "approach_vector")
        for f in res.arrival_arcs_geojson["features"]
    )

    # 2) Patchy broken cumulus checkerboard right over home -> high patchiness & ramping risk
    checker = np.zeros((240, 240), dtype=np.float32)
    checker[95:145:2, 95:145:2] = 0.85
    res_patchy = analyze_solar_sky(home_lat, home_lon, bbox, checker, ir * 0.15, wind)
    assert res_patchy.patchiness_index >= 36.0
    assert res_patchy.regime == "patchy_unreliable"

    # 3) Heavy cloud overhead with clear sky upwind -> clearing ETA detected
    clearing_opt = np.zeros((240, 240), dtype=np.float32)
    clearing_opt[105:140, 105:140] = 0.82
    res_clearing = analyze_solar_sky(home_lat, home_lon, bbox, clearing_opt, clearing_opt * 0.8, wind)
    assert res_clearing.clearing_eta_min is not None
    assert 15 <= res_clearing.clearing_eta_min <= 55


def test_firms_csv_parsing() -> None:
    sample_csv = (
        "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight\n"
        "-37.5000,145.1000,342.5,0.4,0.4,2026-11-20,0315,N20,VIIRS,h,2.0NRT,295.1,28.4,D\n"
        "-38.1200,144.4500,318.2,0.5,0.5,2026-11-20,0240,N20,VIIRS,n,2.0NRT,289.4,8.7,D\n"
    )
    parsed = parse_firms_csv(
        sample_csv,
        "VIIRS_NOAA20_NRT",
        now_epoch=1_795_146_000,
        home_lat=-37.8136,
        home_lon=144.9631,
    )
    assert len(parsed) == 2
    assert parsed[0]["properties"]["frp_mw"] == 28.4
    assert parsed[0]["properties"]["intensity"] == "Moderate"
    assert parsed[0]["properties"]["temp_celsius"] == 69.4
    assert parsed[0]["properties"]["confidence"] == "high"
    assert parsed[0]["properties"]["instrument"] == "VIIRS"
    assert parsed[0]["properties"]["satellite"] == "NOAA-20"
    assert parsed[0]["properties"]["daynight"] == "Daytime pass"
    assert parsed[0]["properties"]["accuracy"] == "0.40 × 0.40 km"
    assert parsed[0]["properties"]["distance_km"] > 30.0
    assert parsed[0]["properties"]["bearing_compass"] in ("N", "NNE", "NE")


def test_state_fire_incidents_and_hotspot_enrichment() -> None:
    bbox = BoundingBox(west=141.0, south=-39.5, east=152.0, north=-33.0)
    vic_payload = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "GeometryCollection",
                    "geometries": [{"type": "Point", "coordinates": [145.102, -37.502]}],
                },
                "properties": {
                    "id": 991,
                    "category1": "Fire",
                    "category2": "Bushfire",
                    "status": "Responding",
                    "sourceOrg": "CFA",
                    "sourceFeed": "cfa-incident",
                    "sourceTitle": "Whittlesea Rd",
                    "location": "Whittlesea",
                    "sizeFmt": "45 Ha.",
                    "resources": 4,
                    "updated": "2026-11-20T03:10:00Z",
                },
            },
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [145.0, -37.8]},
                "properties": {
                    "id": 992,
                    "category1": "Tree Down",
                    "category2": "Tree Down",
                    "sourceFeed": "ses-incident",
                },
            },
        ],
    }
    nsw_payload = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [150.834, -35.045]},
                "properties": {
                    "title": "BEECROFT RANGE FIRE",
                    "category": "Advice",
                    "link": "https://www.rfs.nsw.gov.au/fire-information/fires-near-me",
                    "description": (
                        "ALERT LEVEL: Advice <br />LOCATION: BEECROFT <br />"
                        "COUNCIL AREA: Shoalhaven <br />STATUS: Being controlled <br />"
                        "TYPE: Bush Fire <br />FIRE: Yes <br />SIZE: 410 ha <br />"
                        "RESPONSIBLE AGENCY: Rural Fire Service"
                    ),
                },
            }
        ],
    }

    vic_inc = parse_vic_emergency_geojson(vic_payload, bbox, 1_795_146_000, -37.8136, 144.9631)
    assert len(vic_inc) == 1
    assert vic_inc[0]["properties"]["fire_type"] == "Bushfire"
    assert vic_inc[0]["properties"]["resources"] == 4

    nsw_inc = parse_nsw_rfs_geojson(nsw_payload, bbox, 1_795_146_000, -37.8136, 144.9631)
    assert len(nsw_inc) == 1
    assert nsw_inc[0]["properties"]["size_text"] == "410 ha"
    assert nsw_inc[0]["properties"]["council_area"] == "Shoalhaven"

    hotspot = {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [145.100, -37.500]},
        "properties": {"id": "hs-1", "provider": "Geoscience Australia DEA", "frp_mw": 35.0},
    }
    merged = enrich_hotspots_with_incidents([hotspot], [*vic_inc, *nsw_inc], match_radius_km=6.0)
    # Nearby VicEmergency incident enriches hs-1; distant NSW RFS incident is appended standalone
    assert len(merged) == 2
    assert merged[0]["properties"]["incident_title"] == "Whittlesea Rd (Whittlesea)"
    assert merged[0]["properties"]["incident_status"] == "Responding"
    assert merged[0]["properties"]["size_text"] == "45 Ha."
    assert merged[1]["properties"]["incident_title"] == "BEECROFT RANGE FIRE"


def test_blitzortung_lzw_and_hass_state_ingestion() -> None:
    raw = '{"lat":-37.82,"lon":144.95,"time":1760000000000000000}'
    assert lzw_decode_blitzortung(raw) == raw

    buf = LightningStrikeBuffer(lat=-37.8136, lon=144.9631, radius_deg=2.5)
    now_epoch = int(datetime.now(timezone.utc).timestamp())

    class _FakeState:
        def __init__(self, entity_id: str, attrs: dict[str, object]) -> None:
            self.entity_id = entity_id
            self.attributes = attrs
            self.last_changed = datetime.fromtimestamp(now_epoch - 180, tz=timezone.utc)

    count = buf.ingest_from_hass_states(
        [
            _FakeState(
                "geo_location.blitzortung_lightning_abc123",
                {
                    "source": "blitzortung",
                    "latitude": -37.75,
                    "longitude": 144.90,
                    "publication_date": now_epoch - 180,
                },
            )
        ],
        now_epoch=now_epoch,
    )
    assert count == 1
    geo = buf.to_geojson()
    assert len(geo["features"]) == 1
    assert 2.5 <= geo["features"][0]["properties"]["age_minutes"] <= 3.5


def test_engine_manifest_defaults_melbourne_vs_london() -> None:
    melb = RadarSkyEngine(lat=-37.8136, lon=144.9631, radius_deg=2.4).build_manifest()
    assert melb["location"]["in_australia"] is True
    assert melb["providers"]["satellite"]["id"] == "himawari"
    assert melb["providers"]["radar"]["id"] == "bom_wmts"

    london = RadarSkyEngine(lat=51.5072, lon=-0.1276, radius_deg=2.4).build_manifest()
    assert london["location"]["in_australia"] is False
    assert london["providers"]["satellite"]["id"] == "meteosat-0deg"
    assert london["providers"]["radar"]["id"] == "rainviewer"
