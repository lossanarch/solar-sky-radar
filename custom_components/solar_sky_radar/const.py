"""Constants for the Solar Sky Radar Home Assistant integration."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

DOMAIN: Final = "solar_sky_radar"
NAME: Final = "Solar Sky Radar"
VERSION: Final = "0.1.4"

# Default coordinates: Melbourne, Victoria, Australia
DEFAULT_LATITUDE: Final = -37.8136
DEFAULT_LONGITUDE: Final = 144.9631
DEFAULT_RADIUS_DEG: Final = 3.5  # ~700x700 km regional crop around home site
DEFAULT_UPDATE_MINUTES: Final = 5
HISTORY_MINUTES: Final = 120  # Last 2 hours of imagery for playback

# Config entry keys
CONF_LATITUDE: Final = "latitude"
CONF_LONGITUDE: Final = "longitude"
CONF_RADIUS_DEG: Final = "radius_deg"
CONF_SATELLITE_PROVIDER: Final = "satellite_provider"
CONF_RADAR_PROVIDER: Final = "radar_provider"
CONF_FIRMS_MAP_KEY: Final = "firms_map_key"
CONF_ENABLE_DEA_HOTSPOTS: Final = "enable_dea_hotspots"
CONF_ENABLE_BOM_FTP: Final = "enable_bom_ftp"
CONF_WIND_LEVEL: Final = "wind_level"
CONF_UPDATE_MINUTES: Final = "update_minutes"

# Provider modes
PROVIDER_AUTO: Final = "auto"
SAT_PROVIDER_HIMAWARI: Final = "himawari"
SAT_PROVIDER_BOM_FTP: Final = "bom_ftp"
SAT_PROVIDER_GOES_EAST: Final = "goes-19"
SAT_PROVIDER_GOES_WEST: Final = "goes-18"
SAT_PROVIDER_METEOSAT_0: Final = "meteosat-0deg"
SAT_PROVIDER_METEOSAT_IODC: Final = "meteosat-9"
SAT_PROVIDER_JMA: Final = "jma_fd"

RADAR_PROVIDER_BOM: Final = "bom_wmts"
RADAR_PROVIDER_RAINVIEWER: Final = "rainviewer"
RADAR_PROVIDER_IEM_NEXRAD: Final = "iem_nexrad"

WIND_LEVEL_SURFACE: Final = "10m"
WIND_LEVEL_CLOUD_850: Final = "850hPa"
WIND_LEVEL_CLOUD_700: Final = "700hPa"

# Static & API HTTP paths registered in Home Assistant
STATIC_URL_BASE: Final = f"/{DOMAIN}/www"
CARD_FILENAME: Final = "solar-sky-radar-card.js"
API_BASE: Final = f"/api/{DOMAIN}"


@dataclass(frozen=True)
class GeostationarySatSpec:
    """CGMS / GOES-R Fixed Grid navigation parameters for geostationary satellites."""

    sat_id: str
    label: str
    sub_lon_deg: float
    tile_px: int
    geocolor_zoom: int
    vis_band: str
    vis_zoom: int
    ir_band: str
    ir_zoom: int
    # Radian step per pixel at geocolor_zoom
    step_rad_at_geocolor_z: float
    perspective_height_km: float = 42164.0


GEOSTATIONARY_SATELLITES: Final[dict[str, GeostationarySatSpec]] = {
    "himawari": GeostationarySatSpec(
        sat_id="himawari",
        label="Himawari-9 (140.7E Australia / Asia-Pacific)",
        sub_lon_deg=140.7,
        tile_px=688,
        geocolor_zoom=4,  # 11008x11008 (~1 km)
        vis_band="band_03",
        vis_zoom=5,  # 22016x22016 (~500 m)
        ir_band="band_13",
        ir_zoom=3,  # 5504x5504 (~2 km)
        step_rad_at_geocolor_z=2.794399512e-5,
        perspective_height_km=42164.0,
    ),
    "goes-19": GeostationarySatSpec(
        sat_id="goes-19",
        label="GOES-19 East (75.2W Americas / Atlantic)",
        sub_lon_deg=-75.2,
        tile_px=678,
        geocolor_zoom=4,  # 10848x10848 (~1 km)
        vis_band="band_02",
        vis_zoom=5,
        ir_band="band_13",
        ir_zoom=3,
        step_rad_at_geocolor_z=2.800000000e-5,
        perspective_height_km=42164.16,
    ),
    "goes-18": GeostationarySatSpec(
        sat_id="goes-18",
        label="GOES-18 West (137.2W Pacific / West Americas)",
        sub_lon_deg=-137.2,
        tile_px=678,
        geocolor_zoom=4,
        vis_band="band_02",
        vis_zoom=5,
        ir_band="band_13",
        ir_zoom=3,
        step_rad_at_geocolor_z=2.800000000e-5,
        perspective_height_km=42164.16,
    ),
    "meteosat-0deg": GeostationarySatSpec(
        sat_id="meteosat-0deg",
        label="Meteosat Prime (0E Europe / Africa)",
        sub_lon_deg=0.0,
        tile_px=464,
        geocolor_zoom=3,  # 3712x3712 (~3 km)
        vis_band="band_02",
        vis_zoom=3,
        ir_band="band_09",
        ir_zoom=3,
        step_rad_at_geocolor_z=8.384339e-5,
        perspective_height_km=42164.0,
    ),
    "meteosat-9": GeostationarySatSpec(
        sat_id="meteosat-9",
        label="Meteosat IODC (45.5E Indian Ocean)",
        sub_lon_deg=45.5,
        tile_px=464,
        geocolor_zoom=3,
        vis_band="band_02",
        vis_zoom=3,
        ir_band="band_09",
        ir_zoom=3,
        step_rad_at_geocolor_z=8.384339e-5,
        perspective_height_km=42164.0,
    ),
}

# Australian BOM domain bounds
AU_BOUNDS: Final = {
    "west": 110.0,
    "east": 156.0,
    "south": -45.5,
    "north": -9.0,
}

# BOM WMTS Australian TileMatrixSet definitions (EPSG:3857 origin offsets)
BOM_WMTS_BASE_URL: Final = "https://api.bom.gov.au/apikey/v1/mapping/timeseries/wmts"
BOM_BASEMAP_DARK_URL: Final = (
    "https://api.bom.gov.au/apikey/v1/mapping/basemaps/basemap_dark/MapServer/tile/{z}/{y}/{x}?blankTile=false"
)
BOM_BASEMAP_LIGHT_URL: Final = (
    "https://api.bom.gov.au/apikey/v1/mapping/basemaps/basemap_default/MapServer/tile/{z}/{y}/{x}?blankTile=false"
)
BOM_OVERLAY_TOWNS_URL: Final = (
    "https://api.bom.gov.au/apikey/v1/mapping/overlays/towns_and_cities/MapServer/tile/{z}/{y}/{x}?blankTile=false"
)
BOM_OVERLAY_BORDERS_URL: Final = (
    "https://api.bom.gov.au/apikey/v1/mapping/overlays/state_borders/MapServer/tile/{z}/{y}/{x}?blankTile=false"
)

BOM_GOOGLE_MAPS_MATRIX: Final[dict[int, dict[str, float | int]]] = {
    0: {"tlx": 11584952.0, "tly": 34168990.685578, "w": 1, "h": 1},
    1: {"tlx": 11584952.0, "tly": 14131482.342789, "w": 1, "h": 1},
    2: {"tlx": 11584952.0, "tly": 4112728.171395, "w": 1, "h": 1},
    3: {"tlx": 11584952.0, "tly": 4112728.171395, "w": 2, "h": 2},
    4: {"tlx": 11584952.0, "tly": 1608039.628546, "w": 3, "h": 3},
    5: {"tlx": 11584952.0, "tly": 355695.357122, "w": 6, "h": 5},
    6: {"tlx": 11584952.0, "tly": -270476.778591, "w": 11, "h": 9},
    7: {"tlx": 11584952.0, "tly": -583562.846447, "w": 22, "h": 17},
    8: {"tlx": 11584952.0, "tly": -740105.880375, "w": 43, "h": 33},
}
