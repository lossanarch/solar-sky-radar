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

// 1x1 transparent PNG placeholder while initial WebP frame decodes
const TRANSPARENT_1X1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const EMPTY_FC: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

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

  private manifest: ManifestPayload | null = null;
  private hazards: HazardsPayload | null = null;
  private latestFrame: ResolvedFrameUrls | null = null;
  private config!: SolarSkyRadarCardConfig;

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

    const { styleKey, style } = this.resolveStyle(config.basemap_theme ?? "auto");
    this.currentStyleKey = styleKey;

    this.map = new maplibregl.Map({
      container: this.container,
      style,
      center: [centerLon, centerLat],
      zoom,
      minZoom: 3,
      maxZoom: 12,
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

    this.map.on("load", () => {
      this.styleReady = true;
      this.setupOverlayLayers();
      this.syncAllState();
    });

    this.map.on("styledata", () => {
      if (this.map?.isStyleLoaded() && !this.map.getSource("ssr-true-colour")) {
        this.styleReady = true;
        this.setupOverlayLayers();
        this.syncAllState();
      }
    });

    this.updateHomeMarker(centerLat, centerLon);

    this.resizeObserver = new ResizeObserver(() => {
      this.map?.resize();
      this.windRenderer?.resize();
    });
    this.resizeObserver.observe(this.container);
  }

  private resolveStyle(theme: BasemapTheme): {
    styleKey: string;
    style: string | StyleSpecification;
  } {
    const haDark = this.getHass()?.themes?.darkMode ?? true;
    const isDark = theme === "auto" ? haDark : theme === "dark" || theme === "bom_dark";
    const bm = this.manifest?.providers.basemap;

    if ((theme === "bom_dark" || theme === "bom_light") && bm) {
      const baseUrl =
        theme === "bom_dark" ? bm.bom_dark_tiles : bm.bom_light_tiles;
      if (baseUrl) {
        return {
          styleKey: theme,
          style: buildBomRasterStyle(
            theme === "bom_dark",
            baseUrl,
            bm.bom_towns_overlay,
            bm.bom_borders_overlay
          ),
        };
      }
    }

    return {
      styleKey: isDark ? "ofm_dark" : "ofm_light",
      style: isDark ? OPENFREEMAP_DARK_STYLE : OPENFREEMAP_LIGHT_STYLE,
    };
  }

  /**
   * Find the first road/boundary/symbol layer so weather rasters sit ABOVE land/water fill
   * while coastlines, highways, and suburb/city labels stay sharp ON TOP of clouds & radar.
   */
  private findOverlayAnchorLayerId(): string | undefined {
    if (!this.map) return undefined;
    const layers = this.map.getStyle()?.layers ?? [];
    // On BOM custom style, insert right before borders/town labels
    const bomAnchor = layers.find(
      (l) => l.id === "bom-borders-top" || l.id === "bom-towns-label-top"
    );
    if (bomAnchor) return bomAnchor.id;

    // On OpenFreeMap vector styles, insert before major highways, boundaries, and all text symbols
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

    // Add a crisp vector coastline outline ABOVE weather rasters when vector water source exists
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
              "line-color": "rgba(148, 163, 184, 0.65)",
              "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.7, 9, 1.35],
            },
          },
          anchorId
        );
      } catch {
        // Ignore if vector tile schema differs
      }
    }

    // 4. Upwind Solar Arrival Arcs (15m / 30m / 60m) — drawn on top of labels/roads
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
          "#38bdf8",
          30,
          "#fbbf24",
          "#f87171",
        ],
        "line-width": 1.75,
        "line-dasharray": [3, 2.5],
        "line-opacity": 0.88,
      },
    });
    this.map.addLayer({
      id: "ssr-solar-vector-line",
      type: "line",
      source: "ssr-solar-arcs",
      filter: ["==", ["get", "kind"], "approach_vector"],
      paint: {
        "line-color": "#38bdf8",
        "line-width": 1.5,
        "line-opacity": 0.65,
      },
    });
    this.map.addLayer({
      id: "ssr-solar-arcs-label",
      type: "symbol",
      source: "ssr-solar-arcs",
      filter: ["==", ["get", "kind"], "arrival_label"],
      layout: {
        "text-field": ["get", "label"],
        "text-size": 11,
        "text-offset": [0, -0.6],
      },
      paint: {
        "text-color": "#e0f2fe",
        "text-halo-color": "rgba(15, 23, 42, 0.92)",
        "text-halo-width": 1.5,
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
      el.style.background = "#38bdf8";
      el.style.border = "2.5px solid #f8fafc";
      el.style.boxShadow = "0 0 0 4px rgba(56, 189, 248, 0.32), 0 2px 6px rgba(0,0,0,0.6)";
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

    const { styleKey, style } = this.resolveStyle(config.basemap_theme ?? "auto");
    if (styleKey !== this.currentStyleKey) {
      this.currentStyleKey = styleKey;
      this.styleReady = false;
      this.map.setStyle(style);
    }

    this.syncLayerVisibilityAndOpacity();
    this.windRenderer?.setOptions(
      config.show_wind ?? true,
      config.wind_level ?? "850hPa",
      config.wind_opacity ?? 0.85
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

    // Re-evaluate BOM basemap if selected once manifest arrives
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
    this.windRenderer?.setWindData(wind);
    this.windRenderer?.setOptions(
      this.config.show_wind ?? true,
      this.config.wind_level ?? "850hPa",
      this.config.wind_opacity ?? 0.85
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

    // Show strikes occurring within the 35 minutes leading up to `frameEpoch`
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
    setVis("ssr-solar-arcs-label", ringsOn);

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
    this.resizeObserver?.disconnect();
    this.windRenderer?.destroy();
    this.homeMarker?.remove();
    this.map?.remove();
    this.map = null;
  }
}
