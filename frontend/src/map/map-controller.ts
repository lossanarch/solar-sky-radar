import type * as GeoJSON from "geojson";
import maplibregl, {
  type GeoJSONSource,
  type ImageSource,
  type Map as MapLibreMap,
  type StyleSpecification,
} from "maplibre-gl";
import type {
  BasemapTheme,
  HazardsPayload,
  HomeAssistantLike,
  ManifestPayload,
  SolarSkyRadarCardConfig,
  WindPayload,
} from "../types";
import type { ResolvedFrameUrls } from "./frame-player";
import { WindStreamlineRenderer } from "./wind-particles";

const OPENFREEMAP_DARK_STYLE = "https://tiles.openfreemap.org/styles/dark";
const OPENFREEMAP_LIGHT_STYLE = "https://tiles.openfreemap.org/styles/positron";

// Cache sanitized vector styles so switching or remounting cards requires zero extra fetches
const SAFE_VECTOR_STYLE_CACHE = new Map<string, Promise<StyleSpecification>>();

// 1x1 transparent PNG placeholder while initial WebP frame decodes
const TRANSPARENT_1X1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const EMPTY_FC: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

function buildPlaceholderStyle(dark: boolean): StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [
      {
        id: "ssr-placeholder-bg",
        type: "background",
        paint: { "background-color": dark ? "#0b1120" : "#f1f5f9" },
      },
    ],
  };
}

/**
 * Strip sprite sheets and pattern/icon lookups from vector styles so MapLibre GL JS
 * never calls `canvas.getContext('2d').getImageData(...)` (avoiding browser canvas
 * anti-fingerprinting prompts and striped placeholder artifacts while keeping crisp
 * vector roads, coastlines, boundaries, and `.pbf` city/suburb labels).
 */
export function sanitizeVectorStyleForPrivacy(
  raw: StyleSpecification,
  dark: boolean
): StyleSpecification {
  const style = structuredClone(raw) as StyleSpecification & {
    sprite?: unknown;
  };
  delete style.sprite;

  style.layers = (style.layers ?? []).filter((layer) => {
    const rec = layer as Record<string, unknown>;
    const layout = rec.layout as Record<string, unknown> | undefined;
    const paint = rec.paint as Record<string, unknown> | undefined;

    if (layer.type === "symbol" && layout && "icon-image" in layout) {
      if (!("text-field" in layout)) {
        return false;
      }
      delete layout["icon-image"];
      delete layout["icon-size"];
      delete layout["icon-padding"];
      delete layout["icon-offset"];
      delete layout["icon-anchor"];
      delete layout["icon-optional"];
    }

    if (paint) {
      if ("fill-pattern" in paint) {
        delete paint["fill-pattern"];
        if (!("fill-color" in paint)) {
          paint["fill-color"] = dark
            ? "rgba(20, 45, 38, 0.22)"
            : "rgba(187, 226, 198, 0.25)";
        }
      }
      delete paint["line-pattern"];
      delete paint["background-pattern"];
    }

    return true;
  });

  return style;
}

function fetchPrivacySafeVectorStyle(
  url: string,
  dark: boolean
): Promise<StyleSpecification> {
  const cached = SAFE_VECTOR_STYLE_CACHE.get(url);
  if (cached) return cached;

  const p = (async () => {
    try {
      const resp = await fetch(url, { mode: "cors" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = (await resp.json()) as StyleSpecification;
      return sanitizeVectorStyleForPrivacy(json, dark);
    } catch {
      SAFE_VECTOR_STYLE_CACHE.delete(url);
      return buildPlaceholderStyle(dark);
    }
  })();

  SAFE_VECTOR_STYLE_CACHE.set(url, p);
  return p;
}

function buildBomRasterStyle(
  dark: boolean,
  baseTilesUrl: string,
  townsOverlayUrl: string | null,
  bordersOverlayUrl: string | null
): StyleSpecification {
  const sources: StyleSpecification["sources"] = {
    "bom-base": {
      type: "raster",
      tiles: [baseTilesUrl],
      tileSize: 256,
      maxzoom: 10,
      attribution: "© Australian Bureau of Meteorology",
    },
  };
  const layers: StyleSpecification["layers"] = [
    {
      id: "bom-background",
      type: "background",
      paint: { "background-color": dark ? "#0b1120" : "#dbeafe" },
    },
    {
      id: "bom-base-layer",
      type: "raster",
      source: "bom-base",
      paint: { "raster-opacity": 1.0 },
    },
  ];

  if (bordersOverlayUrl) {
    sources["bom-borders"] = {
      type: "raster",
      tiles: [bordersOverlayUrl],
      tileSize: 256,
      maxzoom: 10,
    };
    layers.push({
      id: "bom-borders-top",
      type: "raster",
      source: "bom-borders",
      paint: { "raster-opacity": 0.75 },
    });
  }

  if (townsOverlayUrl) {
    sources["bom-towns"] = {
      type: "raster",
      tiles: [townsOverlayUrl],
      tileSize: 256,
      maxzoom: 10,
    };
    layers.push({
      id: "bom-towns-label-top",
      type: "raster",
      source: "bom-towns",
      paint: { "raster-opacity": 0.95 },
    });
  }

  return { version: 8, sources, layers };
}

export function resolveIsDark(
  theme: BasemapTheme | undefined,
  hass: HomeAssistantLike | undefined
): boolean {
  const t = theme ?? "auto";
  if (t === "dark" || t === "bom_dark") return true;
  if (t === "light" || t === "bom_light") return false;
  return hass?.themes?.darkMode ?? true;
}

/**
 * Manages the MapLibre GL JS scene, keeping coastlines, roads, and suburb/city labels
 * pinned ABOVE the True Colour satellite, Visual Cloud, and Rain Radar rasters.
 */
export class MapController {
  private map: MapLibreMap | null = null;
  private windRenderer: WindStreamlineRenderer | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private homeMarker: maplibregl.Marker | null = null;
  private styleReady = false;
  private currentStyleKey = "";
  private styleSeq = 0;

  private manifest: ManifestPayload | null = null;
  private hazards: HazardsPayload | null = null;
  private latestFrame: ResolvedFrameUrls | null = null;
  private config!: SolarSkyRadarCardConfig;
  private destroyed = false;

  constructor(
    private container: HTMLElement,
    private getHass: () => HomeAssistantLike | undefined
  ) {}

  init(config: SolarSkyRadarCardConfig): void {
    this.config = config;
    const centerLat =
      config.center_latitude ?? this.getHass()?.config?.latitude ?? -37.8136;
    const centerLon =
      config.center_longitude ?? this.getHass()?.config?.longitude ?? 144.9631;
    const zoom = config.zoom_level ?? 7.2;
    const isDark = resolveIsDark(config.basemap_theme, this.getHass());

    // Disable `localIdeographFontFamily` so MapLibre never invokes TinySDF canvas pixel readback
    this.map = new maplibregl.Map({
      container: this.container,
      style: buildPlaceholderStyle(isDark),
      center: [centerLon, centerLat],
      zoom,
      minZoom: 3,
      maxZoom: 12,
      localIdeographFontFamily: false,
      attributionControl: false,
      pitchWithRotate: false,
      dragRotate: false,
      transformRequest: (url) => {
        const token = this.getHass()?.auth?.data?.access_token;
        if (token && url.startsWith("/") && url.includes("/api/")) {
          return {
            url: `${window.location.origin}${url}`,
            headers: { Authorization: `Bearer ${token}` },
          };
        }
        return { url };
      },
    });

    this.map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right"
    );

    this.windRenderer = new WindStreamlineRenderer(this.container);
    this.windRenderer.attachMap(this.map);

    this.map.on("styledata", () => {
      if (this.map?.isStyleLoaded() && !this.map.getSource("ssr-true-colour")) {
        this.styleReady = true;
        this.setupOverlayLayers();
        this.syncAllState();
      }
    });

    this.updateHomeMarker(centerLat, centerLon);
    void this.applyResolvedStyle(config.basemap_theme ?? "auto");

    this.resizeObserver = new ResizeObserver(() => {
      this.map?.resize();
      this.windRenderer?.resize();
    });
    this.resizeObserver.observe(this.container);
  }

  private computeStyleKey(theme: BasemapTheme): {
    styleKey: string;
    isDark: boolean;
  } {
    const isDark = resolveIsDark(theme, this.getHass());
    const bm = this.manifest?.providers.basemap;
    if ((theme === "bom_dark" || theme === "bom_light") && bm) {
      const baseUrl =
        theme === "bom_dark" ? bm.bom_dark_tiles : bm.bom_light_tiles;
      if (baseUrl) {
        return { styleKey: theme, isDark: theme === "bom_dark" };
      }
    }
    return { styleKey: isDark ? "ofm_dark" : "ofm_light", isDark };
  }

  private async applyResolvedStyle(theme: BasemapTheme): Promise<void> {
    if (!this.map || this.destroyed) return;
    const { styleKey, isDark } = this.computeStyleKey(theme);
    if (styleKey === this.currentStyleKey) return;

    this.currentStyleKey = styleKey;
    const seq = ++this.styleSeq;
    const bm = this.manifest?.providers.basemap;

    let styleSpec: StyleSpecification;
    if ((styleKey === "bom_dark" || styleKey === "bom_light") && bm) {
      const baseUrl =
        styleKey === "bom_dark" ? bm.bom_dark_tiles! : bm.bom_light_tiles!;
      styleSpec = buildBomRasterStyle(
        styleKey === "bom_dark",
        baseUrl,
        bm.bom_towns_overlay,
        bm.bom_borders_overlay
      );
    } else {
      const url = isDark ? OPENFREEMAP_DARK_STYLE : OPENFREEMAP_LIGHT_STYLE;
      styleSpec = await fetchPrivacySafeVectorStyle(url, isDark);
    }

    if (this.destroyed || !this.map || seq !== this.styleSeq) return;
    this.styleReady = false;
    this.map.setStyle(styleSpec);
  }

  /**
   * Find the first road/boundary/symbol layer so weather rasters sit ABOVE land/water fill
   * while coastlines, highways, and suburb/city labels stay sharp ON TOP of clouds & radar.
   */
  private findOverlayAnchorLayerId(): string | undefined {
    if (!this.map) return undefined;
    const layers = this.map.getStyle()?.layers ?? [];
    const bomAnchor = layers.find(
      (l) => l.id === "bom-borders-top" || l.id === "bom-towns-label-top"
    );
    if (bomAnchor) return bomAnchor.id;

    const vecAnchor = layers.find(
      (l) =>
        l.type === "symbol" ||
        l.id.includes("highway_major") ||
        l.id.includes("boundary")
    );
    return vecAnchor?.id;
  }

  private defaultCoords(): [[number, number], [number, number], [number, number], [number, number]] {
    if (this.manifest?.bbox?.coordinates) {
      return this.manifest.bbox.coordinates;
    }
    const lat = this.config.center_latitude ?? -37.8136;
    const lon = this.config.center_longitude ?? 144.9631;
    return [
      [lon - 4.4, lat + 3.5],
      [lon + 4.4, lat + 3.5],
      [lon + 4.4, lat - 3.5],
      [lon - 4.4, lat - 3.5],
    ];
  }

  private setupOverlayLayers(): void {
    if (!this.map || this.map.getSource("ssr-true-colour")) return;
    const anchorId = this.findOverlayAnchorLayerId();
    const coords = this.defaultCoords();
    const isDark = resolveIsDark(this.config.basemap_theme, this.getHass());

    // 1. Satellite Visible True Colour Image Source
    this.map.addSource("ssr-true-colour", {
      type: "image",
      url: TRANSPARENT_1X1,
      coordinates: coords,
    });
    this.map.addLayer(
      {
        id: "ssr-true-colour-layer",
        type: "raster",
        source: "ssr-true-colour",
        paint: {
          "raster-opacity": this.config.true_colour_opacity ?? 0.85,
          "raster-fade-duration": 0,
          "raster-resampling": "linear",
        },
      },
      anchorId
    );

    // 2. Visual Cloud / Solar Classification Overlay
    this.map.addSource("ssr-visual-cloud", {
      type: "image",
      url: TRANSPARENT_1X1,
      coordinates: coords,
    });
    this.map.addLayer(
      {
        id: "ssr-visual-cloud-layer",
        type: "raster",
        source: "ssr-visual-cloud",
        paint: {
          "raster-opacity": this.config.cloud_opacity ?? 0.78,
          "raster-fade-duration": 0,
          "raster-resampling": "linear",
        },
      },
      anchorId
    );

    // 3. Rain Radar Overlay (BOM 5-min WMTS / RainViewer global)
    this.map.addSource("ssr-radar", {
      type: "image",
      url: TRANSPARENT_1X1,
      coordinates: coords,
    });
    this.map.addLayer(
      {
        id: "ssr-radar-layer",
        type: "raster",
        source: "ssr-radar",
        paint: {
          "raster-opacity": this.config.radar_opacity ?? 0.84,
          "raster-fade-duration": 0,
          "raster-resampling": "linear",
        },
      },
      anchorId
    );

    // Crisp vector coastline outline ABOVE weather rasters
    const styleSources = this.map.getStyle()?.sources ?? {};
    if (styleSources["openmaptiles"] && !this.map.getLayer("ssr-coastline-crisp")) {
      try {
        this.map.addLayer(
          {
            id: "ssr-coastline-crisp",
            type: "line",
            source: "openmaptiles",
            "source-layer": "water",
            paint: {
              "line-color": isDark
                ? "rgba(148, 163, 184, 0.65)"
                : "rgba(51, 65, 85, 0.58)",
              "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.7, 9, 1.35],
            },
          },
          anchorId
        );
      } catch {
        // Ignore if vector tile schema differs
      }
    }

    // 4. Upwind Solar Arrival Arcs (15m / 30m / 60m) — clean colour-coded dashed lines only (no text clutter)
    this.map.addSource("ssr-solar-arcs", {
      type: "geojson",
      data: this.manifest?.solar?.arrival_arcs_geojson ?? EMPTY_FC,
    });
    this.map.addLayer({
      id: "ssr-solar-arcs-line",
      type: "line",
      source: "ssr-solar-arcs",
      filter: ["==", ["get", "kind"], "arrival_arc"],
      paint: {
        "line-color": [
          "match",
          ["get", "minutes"],
          15,
          isDark ? "#38bdf8" : "#0284c7",
          30,
          isDark ? "#fbbf24" : "#d97706",
          isDark ? "#f87171" : "#dc2626",
        ],
        "line-width": 2.0,
        "line-dasharray": [3, 2.5],
        "line-opacity": 0.9,
      },
    });
    this.map.addLayer({
      id: "ssr-solar-vector-line",
      type: "line",
      source: "ssr-solar-arcs",
      filter: ["==", ["get", "kind"], "approach_vector"],
      paint: {
        "line-color": isDark ? "#38bdf8" : "#0284c7",
        "line-width": 1.6,
        "line-opacity": 0.7,
      },
    });

    // 5. NASA FIRMS / DEA Bushfire Hotspots
    this.map.addSource("ssr-fires", {
      type: "geojson",
      data: this.hazards?.fires ?? EMPTY_FC,
    });
    this.map.addLayer({
      id: "ssr-fires-glow",
      type: "circle",
      source: "ssr-fires",
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "frp_mw"], 10],
          2,
          6,
          40,
          12,
          150,
          20,
        ],
        "circle-color": "#f97316",
        "circle-opacity": 0.28,
        "circle-blur": 0.65,
      },
    });
    this.map.addLayer({
      id: "ssr-fires-core",
      type: "circle",
      source: "ssr-fires",
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "frp_mw"], 10],
          2,
          3.2,
          40,
          5.8,
          150,
          9.5,
        ],
        "circle-color": [
          "step",
          ["coalesce", ["get", "hours_ago"], 12],
          "#fef08a",
          3,
          "#fb923c",
          12,
          "#ef4444",
          24,
          "#991b1b",
        ],
        "circle-stroke-color": "rgba(15, 23, 42, 0.9)",
        "circle-stroke-width": 1.1,
      },
    });

    this.map.on("click", "ssr-fires-core", (e) => {
      const feat = e.features?.[0];
      if (!feat || feat.geometry.type !== "Point") return;
      const p = feat.properties ?? {};
      const coords = feat.geometry.coordinates.slice() as [number, number];
      const popupNode = document.createElement("div");
      popupNode.style.fontFamily = "system-ui, sans-serif";
      popupNode.style.fontSize = "12px";
      popupNode.style.color = "#0f172a";
      popupNode.style.lineHeight = "1.45";

      const title = document.createElement("strong");
      title.textContent = `${p.provider ?? "Fire Hotspot"}`;
      popupNode.appendChild(title);

      const details = [
        `Sensor: ${p.satellite ?? ""} ${p.instrument ?? ""}`,
        `Radiative Power: ${p.frp_mw ?? "?"} MW (${p.temp_kelvin ?? "?"} K)`,
        `Detected: ${p.hours_ago ?? "?"}h ago`,
      ];
      for (const line of details) {
        const div = document.createElement("div");
        div.textContent = line;
        popupNode.appendChild(div);
      }

      new maplibregl.Popup({ closeButton: true, maxWidth: "240px" })
        .setLngLat(coords)
        .setDOMContent(popupNode)
        .addTo(this.map!);
    });

    // 6. Time-Synced Blitzortung Lightning Strikes
    this.map.addSource("ssr-lightning", {
      type: "geojson",
      data: EMPTY_FC,
    });
    this.map.addLayer({
      id: "ssr-lightning-halo",
      type: "circle",
      source: "ssr-lightning",
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "frame_age_min"], 10],
          0,
          12,
          10,
          7,
          30,
          4,
        ],
        "circle-color": "#fde047",
        "circle-opacity": [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "frame_age_min"], 10],
          0,
          0.55,
          20,
          0.15,
          45,
          0.0,
        ],
        "circle-blur": 0.6,
      },
    });
    this.map.addLayer({
      id: "ssr-lightning-bolt",
      type: "circle",
      source: "ssr-lightning",
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "frame_age_min"], 10],
          0,
          4.8,
          15,
          3.4,
          45,
          2.2,
        ],
        "circle-color": [
          "step",
          ["coalesce", ["get", "frame_age_min"], 10],
          "#ffffff",
          4,
          "#fde047",
          12,
          "#f97316",
          25,
          "#dc2626",
        ],
        "circle-stroke-color": "#0f172a",
        "circle-stroke-width": 1.2,
      },
    });
  }

  private updateHomeMarker(lat: number, lon: number): void {
    if (!this.map) return;
    if (!this.homeMarker) {
      const el = document.createElement("div");
      el.style.width = "14px";
      el.style.height = "14px";
      el.style.borderRadius = "9999px";
      el.style.background = "#0ea5e9";
      el.style.border = "2.5px solid #ffffff";
      el.style.boxShadow =
        "0 0 0 4px rgba(14, 165, 233, 0.30), 0 2px 6px rgba(15, 23, 42, 0.55)";
      el.title = "Home / Solar PV Array";
      this.homeMarker = new maplibregl.Marker({ element: el })
        .setLngLat([lon, lat])
        .addTo(this.map);
    } else {
      this.homeMarker.setLngLat([lon, lat]);
    }
  }

  updateConfig(config: SolarSkyRadarCardConfig): void {
    this.config = config;
    if (!this.map) return;

    const isDark = resolveIsDark(config.basemap_theme, this.getHass());
    void this.applyResolvedStyle(config.basemap_theme ?? "auto");

    this.syncLayerVisibilityAndOpacity();
    this.windRenderer?.setOptions(
      config.show_wind ?? true,
      config.wind_level ?? "850hPa",
      config.wind_opacity ?? 0.85,
      isDark
    );
  }

  setManifest(manifest: ManifestPayload): void {
    const firstLoad = this.manifest === null;
    this.manifest = manifest;

    if (firstLoad && this.map && this.config.center_latitude === undefined) {
      this.map.jumpTo({
        center: [manifest.location.longitude, manifest.location.latitude],
        zoom: this.config.zoom_level ?? 7.2,
      });
    }
    this.updateHomeMarker(
      this.config.center_latitude ?? manifest.location.latitude,
      this.config.center_longitude ?? manifest.location.longitude
    );

    if (
      this.config.basemap_theme === "bom_dark" ||
      this.config.basemap_theme === "bom_light"
    ) {
      this.updateConfig(this.config);
    }

    if (this.styleReady && this.map) {
      const coords = manifest.bbox.coordinates;
      for (const srcId of ["ssr-true-colour", "ssr-visual-cloud", "ssr-radar"]) {
        const src = this.map.getSource(srcId) as ImageSource | undefined;
        src?.setCoordinates(coords);
      }
      const arcsSrc = this.map.getSource("ssr-solar-arcs") as GeoJSONSource | undefined;
      if (arcsSrc && manifest.solar?.arrival_arcs_geojson) {
        arcsSrc.setData(manifest.solar.arrival_arcs_geojson);
      }
    }
  }

  setWind(wind: WindPayload | null): void {
    const isDark = resolveIsDark(this.config.basemap_theme, this.getHass());
    this.windRenderer?.setWindData(wind);
    this.windRenderer?.setOptions(
      this.config.show_wind ?? true,
      this.config.wind_level ?? "850hPa",
      this.config.wind_opacity ?? 0.85,
      isDark
    );
  }

  setHazards(hazards: HazardsPayload): void {
    this.hazards = hazards;
    if (!this.styleReady || !this.map) return;
    const fireSrc = this.map.getSource("ssr-fires") as GeoJSONSource | undefined;
    fireSrc?.setData(hazards.fires ?? EMPTY_FC);
    if (this.latestFrame) {
      this.updateTimeFilteredLightning(this.latestFrame.slot.epoch);
    }
  }

  applyFrame(frame: ResolvedFrameUrls): void {
    this.latestFrame = frame;
    if (!this.styleReady || !this.map) return;
    const coords = this.defaultCoords();

    const tcSrc = this.map.getSource("ssr-true-colour") as ImageSource | undefined;
    if (tcSrc && (this.config.show_true_colour ?? true) && frame.trueColourBlobUrl) {
      tcSrc.updateImage({ url: frame.trueColourBlobUrl, coordinates: coords });
    }

    const vcSrc = this.map.getSource("ssr-visual-cloud") as ImageSource | undefined;
    if (vcSrc && (this.config.show_cloud_overlay ?? true) && frame.cloudOverlayBlobUrl) {
      vcSrc.updateImage({ url: frame.cloudOverlayBlobUrl, coordinates: coords });
    }

    const radSrc = this.map.getSource("ssr-radar") as ImageSource | undefined;
    if (radSrc && (this.config.show_radar ?? true) && frame.radarBlobUrl) {
      radSrc.updateImage({ url: frame.radarBlobUrl, coordinates: coords });
    }

    this.updateTimeFilteredLightning(frame.slot.epoch);
  }

  private updateTimeFilteredLightning(frameEpoch: number): void {
    if (!this.map || !this.styleReady) return;
    const src = this.map.getSource("ssr-lightning") as GeoJSONSource | undefined;
    if (!src) return;

    if (!(this.config.show_lightning ?? true) || !this.hazards?.lightning?.features) {
      src.setData(EMPTY_FC);
      return;
    }

    const active = this.hazards.lightning.features
      .filter((f) => {
        const ep = Number(f.properties?.epoch ?? 0);
        const ageSec = frameEpoch - ep;
        return ageSec >= -120 && ageSec <= 2100;
      })
      .map((f) => ({
        ...f,
        properties: {
          ...f.properties,
          frame_age_min: Math.max(
            0,
            Math.round(((frameEpoch - Number(f.properties?.epoch ?? frameEpoch)) / 60) * 10) / 10
          ),
        },
      }));

    src.setData({ type: "FeatureCollection", features: active });
  }

  private syncLayerVisibilityAndOpacity(): void {
    if (!this.map || !this.styleReady) return;

    const setVis = (id: string, on: boolean) => {
      if (this.map?.getLayer(id)) {
        this.map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
      }
    };
    const setRasterOp = (id: string, val: number) => {
      if (this.map?.getLayer(id)) {
        this.map.setPaintProperty(id, "raster-opacity", Math.max(0, Math.min(1, val)));
      }
    };

    setVis("ssr-true-colour-layer", this.config.show_true_colour ?? true);
    setRasterOp("ssr-true-colour-layer", this.config.true_colour_opacity ?? 0.85);

    setVis("ssr-visual-cloud-layer", this.config.show_cloud_overlay ?? true);
    setRasterOp("ssr-visual-cloud-layer", this.config.cloud_opacity ?? 0.78);

    setVis("ssr-radar-layer", this.config.show_radar ?? true);
    setRasterOp("ssr-radar-layer", this.config.radar_opacity ?? 0.84);

    const ringsOn = this.config.show_solar_rings ?? true;
    setVis("ssr-solar-arcs-line", ringsOn);
    setVis("ssr-solar-vector-line", ringsOn);

    const firesOn = this.config.show_fires ?? true;
    setVis("ssr-fires-glow", firesOn);
    setVis("ssr-fires-core", firesOn);

    const ltgOn = this.config.show_lightning ?? true;
    setVis("ssr-lightning-halo", ltgOn);
    setVis("ssr-lightning-bolt", ltgOn);
  }

  private syncAllState(): void {
    this.syncLayerVisibilityAndOpacity();
    if (this.manifest) this.setManifest(this.manifest);
    if (this.hazards) this.setHazards(this.hazards);
    if (this.latestFrame) this.applyFrame(this.latestFrame);
  }

  recenter(): void {
    if (!this.map) return;
    const lat =
      this.config.center_latitude ??
      this.manifest?.location.latitude ??
      this.getHass()?.config?.latitude ??
      -37.8136;
    const lon =
      this.config.center_longitude ??
      this.manifest?.location.longitude ??
      this.getHass()?.config?.longitude ??
      144.9631;
    this.map.flyTo({
      center: [lon, lat],
      zoom: this.config.zoom_level ?? 7.2,
      duration: 650,
    });
  }

  zoomBy(delta: number): void {
    if (!this.map) return;
    this.map.zoomTo(this.map.getZoom() + delta, { duration: 220 });
  }

  destroy(): void {
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    this.windRenderer?.destroy();
    this.homeMarker?.remove();
    this.map?.remove();
    this.map = null;
  }
}
