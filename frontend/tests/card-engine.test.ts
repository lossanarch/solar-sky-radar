import { describe, expect, it, vi } from "vitest";
import type { StyleSpecification } from "maplibre-gl";
import { FramePlayer } from "../src/map/frame-player";
import { sanitizeVectorStyleForPrivacy } from "../src/map/map-controller";
import { sampleWindUV } from "../src/map/wind-particles";
import {
  resolveAutoplayMode,
  type ManifestPayload,
  type WindPayload,
} from "../src/types";

const MOCK_MANIFEST: ManifestPayload = {
  updated_epoch: 2200,
  location: { latitude: -37.8136, longitude: 144.9631, radius_deg: 2.4, in_australia: true },
  bbox: {
    west: 141.9,
    south: -40.2,
    east: 148.0,
    north: -35.4,
    coordinates: [
      [141.9, -35.4],
      [148.0, -35.4],
      [148.0, -40.2],
      [141.9, -40.2],
    ],
  },
  providers: {
    satellite: {
      id: "himawari",
      label: "Himawari-9",
      frame_count: 2,
      frames: [
        {
          key: "s1",
          epoch: 1000,
          iso_utc: "2026-11-20T00:00:00Z",
          true_colour_url: "https://example.invalid/tc1.webp",
          cloud_mask_url: "https://example.invalid/cm1.webp",
          solar_cloud_url: "https://example.invalid/sc1.webp",
        },
        {
          key: "s2",
          epoch: 1600,
          iso_utc: "2026-11-20T00:10:00Z",
          true_colour_url: "https://example.invalid/tc2.webp",
          cloud_mask_url: "https://example.invalid/cm2.webp",
          solar_cloud_url: "https://example.invalid/sc2.webp",
        },
      ],
    },
    radar: {
      id: "bom_wmts",
      label: "BOM 5-min WMTS",
      frame_count: 3,
      frames: [
        { key: "r1", epoch: 1000, iso_utc: "2026-11-20T00:00:00Z", url: "https://example.invalid/r1.webp", coverage_fraction: 1 },
        { key: "r2", epoch: 1300, iso_utc: "2026-11-20T00:05:00Z", url: "https://example.invalid/r2.webp", coverage_fraction: 1 },
        { key: "r3", epoch: 1600, iso_utc: "2026-11-20T00:10:00Z", url: "https://example.invalid/r3.webp", coverage_fraction: 1 },
      ],
    },
    basemap: {
      bom_dark_tiles: null,
      bom_light_tiles: null,
      bom_towns_overlay: null,
      bom_borders_overlay: null,
    },
  },
  timeline: [
    { epoch: 1000, iso_utc: "2026-11-20T00:00:00Z", offset_minutes: -10, satellite_key: "s1", radar_key: "r1" },
    { epoch: 1300, iso_utc: "2026-11-20T00:05:00Z", offset_minutes: -5, satellite_key: "s1", radar_key: "r2" },
    { epoch: 1600, iso_utc: "2026-11-20T00:10:00Z", offset_minutes: 0, satellite_key: "s2", radar_key: "r3" },
  ],
  solar: {
    regime: "clear_reliable",
    regime_label: "Clear / Reliable Solar",
    summary: "Clear sky",
    solar_reliability_score: 95,
    estimated_transmittance_pct: 96,
    local_cloud_cover_pct: 4,
    local_optical_depth: 0.04,
    local_ir_coldness: 0.02,
    patchiness_index: 5,
    approaching_cloud_eta_min: null,
    clearing_eta_min: null,
    cloud_wind_speed_kmh: 28,
    cloud_wind_from_deg: 310,
    forecast_60m: [],
    arrival_arcs_geojson: { type: "FeatureCollection", features: [] },
  },
  endpoints: { wind: "/api/solar_sky_radar/wind", hazards: "/api/solar_sky_radar/hazards" },
};

describe("FramePlayer", () => {
  it("loads manifest at latest frame and steps cleanly with wrap-around", async () => {
    const visited: number[] = [];
    const player = new FramePlayer(
      () => ({
        fetchWithAuth: async () => new Response(null, { status: 404 }),
      }),
      (resolved) => visited.push(resolved.index),
      () => {}
    );
    player.setLayerFlags({
      trueColour: false,
      cloudOverlay: false,
      cloudMode: "solar_cloud",
      radar: false,
    });

    await player.loadManifest(MOCK_MANIFEST, false);
    expect(player.index).toBe(2);
    expect(player.length).toBe(3);

    player.step(1);
    expect(player.index).toBe(0);

    player.step(-1);
    expect(player.index).toBe(2);

    player.seek(1, true);
    expect(player.index).toBe(1);
    expect(visited).toEqual([2, 0, 2, 1]);
    player.destroy();
  });

  it("supports single-play 2-hour loop that stops automatically on Now", async () => {
    vi.useFakeTimers();
    try {
      const states: boolean[] = [];
      const visited: number[] = [];
      // Ensure window.setTimeout / clearTimeout exist in Node test env
      vi.stubGlobal("window", globalThis);

      const player = new FramePlayer(
        () => ({
          fetchWithAuth: async () => new Response(null, { status: 404 }),
        }),
        (resolved) => visited.push(resolved.index),
        () => {},
        (playing) => states.push(playing)
      );
      player.setLayerFlags({
        trueColour: false,
        cloudOverlay: false,
        cloudMode: "cloud_mask",
        radar: false,
      });

      await player.loadManifest(MOCK_MANIFEST, false);
      expect(player.index).toBe(2);

      // Single-play starts from oldest (-2h, index 0) and halts at latest (Now, index 2)
      player.play(true);
      expect(player.isPlaying).toBe(true);
      expect(player.index).toBe(0);

      vi.advanceTimersByTime(450);
      expect(player.index).toBe(1);
      expect(player.isPlaying).toBe(true);

      vi.advanceTimersByTime(450);
      expect(player.index).toBe(2);
      expect(player.isPlaying).toBe(false);
      expect(states).toEqual([true, false]);

      player.destroy();
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });
});

describe("resolveAutoplayMode & sanitizeVectorStyleForPrivacy", () => {
  it("resolves autoplay_mode and legacy flags cleanly", () => {
    expect(resolveAutoplayMode({ type: "x" })).toBe("off");
    expect(resolveAutoplayMode({ type: "x", autoplay: true })).toBe("loop");
    expect(resolveAutoplayMode({ type: "x", autoplay_once: true })).toBe("once");
    expect(resolveAutoplayMode({ type: "x", autoplay_mode: "once", autoplay: true })).toBe("once");
  });

  it("strips sprite and pattern/icon properties to prevent canvas getImageData readback", () => {
    const raw: StyleSpecification = {
      version: 8,
      sprite: "https://tiles.openfreemap.org/sprites/ofm_f384/ofm",
      glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
      sources: {},
      layers: [
        {
          id: "landcover_wood",
          type: "fill",
          source: "openmaptiles",
          paint: { "fill-pattern": "wood" },
        },
        {
          id: "highway_shield",
          type: "symbol",
          source: "openmaptiles",
          layout: { "icon-image": "road_3" },
        },
        {
          id: "label_town",
          type: "symbol",
          source: "openmaptiles",
          layout: { "text-field": "{name}", "icon-image": "circle_11_black" },
        },
      ],
    };

    const clean = sanitizeVectorStyleForPrivacy(raw, false);
    expect(clean.sprite).toBeUndefined();
    expect(clean.layers.map((l) => l.id)).toEqual(["landcover_wood", "label_town"]);

    const wood = clean.layers[0] as { paint: Record<string, unknown> };
    expect(wood.paint["fill-pattern"]).toBeUndefined();
    expect(wood.paint["fill-color"]).toBeDefined();

    const town = clean.layers[1] as { layout: Record<string, unknown> };
    expect(town.layout["icon-image"]).toBeUndefined();
    expect(town.layout["text-field"]).toBe("{name}");
  });
});

describe("sampleWindUV", () => {
  const windPayload: WindPayload = {
    fetched_epoch: 1760000000,
    bbox: { west: 142, south: -40, east: 148, north: -36 },
    rows: 3,
    cols: 3,
    lats: [-40, -38, -36],
    lons: [142, 145, 148],
    levels: {
      "850hPa": {
        label: "850 hPa Cloud Steering",
        u: [10, 20, 30, 20, 40, 60, 30, 60, 90],
        v: [-10, -10, -10, -20, -20, -20, -30, -30, -30],
        center_speed_kmh: 44.7,
        center_dir_deg: 296,
      },
    },
  };

  it("interpolates bilinearly inside the bounding box and returns null outside", () => {
    const center = sampleWindUV(windPayload, "850hPa", 145, -38);
    expect(center).not.toBeNull();
    expect(center![0]).toBeCloseTo(40, 4);
    expect(center![1]).toBeCloseTo(-20, 4);

    const mid = sampleWindUV(windPayload, "850hPa", 143.5, -39);
    expect(mid).not.toBeNull();
    expect(mid![0]).toBeCloseTo(22.5, 4);
    expect(mid![1]).toBeCloseTo(-15, 4);

    expect(sampleWindUV(windPayload, "850hPa", 145, -45)).toBeNull();
    expect(sampleWindUV(windPayload, "850hPa", 152, -38)).toBeNull();
  });
});
