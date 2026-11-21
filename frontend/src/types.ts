import type * as GeoJSON from "geojson";

export type CloudRenderMode = "cloud_mask" | "solar_cloud";
export type WindAltitudeMode = "850hPa" | "10m";
export type BasemapTheme = "auto" | "dark" | "light" | "bom_dark" | "bom_light";
export type AutoplayMode = "off" | "once" | "loop";

export interface SolarSkyRadarCardConfig {
  type: string;
  title?: string;
  entry_id?: string;
  api_base?: string;
  center_latitude?: number;
  center_longitude?: number;
  zoom_level?: number;
  map_height?: number;
  basemap_theme?: BasemapTheme;

  show_true_colour?: boolean;
  true_colour_opacity?: number;

  show_cloud_overlay?: boolean;
  cloud_mode?: CloudRenderMode;
  cloud_opacity?: number;

  show_radar?: boolean;
  radar_opacity?: number;

  show_wind?: boolean;
  wind_level?: WindAltitudeMode;
  wind_opacity?: number;

  show_lightning?: boolean;
  show_fires?: boolean;
  show_solar_rings?: boolean;
  show_solar_hud?: boolean;
  show_legend?: boolean;

  autoplay_mode?: AutoplayMode;
  autoplay?: boolean;
  autoplay_once?: boolean;
  playback_speed?: number;
}

export function resolveAutoplayMode(config: SolarSkyRadarCardConfig): AutoplayMode {
  if (
    config.autoplay_mode === "off" ||
    config.autoplay_mode === "once" ||
    config.autoplay_mode === "loop"
  ) {
    return config.autoplay_mode;
  }
  if (config.autoplay_once) return "once";
  if (config.autoplay) return "loop";
  return "off";
}

export interface SatelliteFrameMeta {
  key: string;
  epoch: number;
  iso_utc: string;
  true_colour_url: string;
  cloud_mask_url: string;
  solar_cloud_url: string;
}

export interface RadarFrameMeta {
  key: string;
  epoch: number;
  iso_utc: string;
  url: string;
  coverage_fraction: number;
}

export interface TimelineSlot {
  epoch: number;
  iso_utc: string;
  offset_minutes: number;
  satellite_key: string | null;
  radar_key: string | null;
}

export interface SolarForecastStep {
  minutes_ahead: number;
  cloud_opacity_pct: number;
  est_solar_pct: number;
}

export interface SolarAnalysisPayload {
  regime: string;
  regime_label: string;
  summary: string;
  solar_reliability_score: number;
  estimated_transmittance_pct: number;
  local_cloud_cover_pct: number;
  local_optical_depth: number;
  local_ir_coldness: number;
  patchiness_index: number;
  approaching_cloud_eta_min: number | null;
  clearing_eta_min: number | null;
  cloud_wind_speed_kmh: number;
  cloud_wind_from_deg: number;
  forecast_60m: SolarForecastStep[];
  arrival_arcs_geojson: GeoJSON.FeatureCollection;
}

export interface ManifestPayload {
  updated_epoch: number;
  location: {
    latitude: number;
    longitude: number;
    radius_deg: number;
    in_australia: boolean;
  };
  bbox: {
    west: number;
    south: number;
    east: number;
    north: number;
    coordinates: [[number, number], [number, number], [number, number], [number, number]];
  };
  providers: {
    satellite: {
      id: string;
      label: string;
      frame_count: number;
      frames: SatelliteFrameMeta[];
    };
    radar: {
      id: string;
      label: string;
      frame_count: number;
      frames: RadarFrameMeta[];
    };
    basemap: {
      bom_dark_tiles: string | null;
      bom_light_tiles: string | null;
      bom_towns_overlay: string | null;
      bom_borders_overlay: string | null;
    };
  };
  timeline: TimelineSlot[];
  solar: SolarAnalysisPayload;
  endpoints: {
    wind: string;
    hazards: string;
  };
}

export interface WindLevelGrid {
  label: string;
  u: number[];
  v: number[];
  center_speed_kmh: number;
  center_dir_deg: number;
}

export interface WindPayload {
  fetched_epoch: number;
  bbox: { west: number; south: number; east: number; north: number };
  rows: number;
  cols: number;
  lats: number[];
  lons: number[];
  levels: Record<string, WindLevelGrid>;
  irradiance?: {
    shortwave_wm2: number | null;
    direct_wm2: number | null;
    diffuse_wm2: number | null;
    model_cloud_cover_pct: number | null;
  };
}

export interface HazardsPayload {
  fires: GeoJSON.FeatureCollection & {
    meta?: {
      status: string;
      count: number;
      sources: string[];
      firms_configured: boolean;
      updated_epoch: number;
    };
  };
  lightning: GeoJSON.FeatureCollection & {
    meta?: {
      count_2h: number;
      count_15m: number;
      updated_epoch: number;
    };
  };
}

export interface HomeAssistantLike {
  config?: {
    latitude?: number;
    longitude?: number;
    time_zone?: string;
  };
  themes?: {
    darkMode?: boolean;
  };
  auth?: {
    data?: {
      access_token?: string;
    };
  };
  fetchWithAuth?: (path: string, init?: RequestInit) => Promise<Response>;
}
