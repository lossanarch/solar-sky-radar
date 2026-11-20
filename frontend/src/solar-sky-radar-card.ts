import { LitElement, css, html, nothing, unsafeCSS } from "lit";
import { property, state } from "lit/decorators.js";
import maplibreCss from "maplibre-gl/dist/maplibre-gl.css?inline";

import "./components/jog-slider";
import "./editor";
import { FramePlayer, type ResolvedFrameUrls } from "./map/frame-player";
import { MapController } from "./map/map-controller";
import type {
  CloudRenderMode,
  HazardsPayload,
  HomeAssistantLike,
  ManifestPayload,
  SolarSkyRadarCardConfig,
  TimelineSlot,
  WindAltitudeMode,
  WindPayload,
} from "./types";

const DEFAULT_CONFIG: SolarSkyRadarCardConfig = {
  type: "custom:solar-sky-radar-card",
  basemap_theme: "auto",
  zoom_level: 7.2,
  map_height: 490,
  show_true_colour: true,
  true_colour_opacity: 0.84,
  show_cloud_overlay: true,
  cloud_mode: "cloud_mask",
  cloud_opacity: 0.78,
  show_radar: true,
  radar_opacity: 0.85,
  show_wind: true,
  wind_level: "850hPa",
  wind_opacity: 0.85,
  show_lightning: true,
  show_fires: true,
  show_solar_rings: true,
  show_solar_hud: true,
  show_legend: true,
  autoplay: false,
  playback_speed: 1,
};

export class SolarSkyRadarCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistantLike;

  @state() private config: SolarSkyRadarCardConfig = { ...DEFAULT_CONFIG };
  @state() private manifest: ManifestPayload | null = null;
  @state() private wind: WindPayload | null = null;
  @state() private hazards: HazardsPayload | null = null;
  @state() private timeline: TimelineSlot[] = [];
  @state() private readySlots: boolean[] = [];
  @state() private currentIndex = 0;
  @state() private playing = false;
  @state() private speed = 1;
  @state() private loading = true;
  @state() private errorMessage: string | null = null;
  @state() private hudExpanded = false;
  @state() private mixerOpen = false;

  private mapController: MapController | null = null;
  private framePlayer: FramePlayer | null = null;
  private pollTimer: number | null = null;
  private visibilityObserver: IntersectionObserver | null = null;

  static styles = [
    unsafeCSS(maplibreCss),
    css`
      :host {
        display: block;
      }

      .card {
        position: relative;
        border-radius: var(--ha-card-border-radius, 14px);
        overflow: hidden;
        background: #0b1120;
        border: 1px solid var(--ha-card-border-color, rgba(148, 163, 184, 0.22));
        box-shadow: var(--ha-card-box-shadow, 0 8px 26px rgba(0, 0, 0, 0.28));
        color: #f8fafc;
        font-family: var(--paper-font-body1_-_font-family, system-ui, -apple-system, sans-serif);
      }

      .viewport {
        position: relative;
        width: 100%;
        background: #0b1120;
      }

      .map-canvas {
        position: absolute;
        inset: 0;
      }

      /* Top-left Solar Cloud Nowcast HUD */
      .solar-hud {
        position: absolute;
        top: 10px;
        left: 10px;
        z-index: 6;
        max-width: min(340px, calc(100% - 130px));
        background: rgba(15, 23, 42, 0.84);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(148, 163, 184, 0.26);
        border-radius: 11px;
        padding: 8px 11px;
        cursor: pointer;
        transition: border-color 0.15s ease, background 0.15s ease;
      }

      .solar-hud:hover {
        border-color: rgba(56, 189, 248, 0.65);
        background: rgba(15, 23, 42, 0.92);
      }

      .hud-header {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .regime-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .regime-clear_reliable {
        background: #10b981;
        box-shadow: 0 0 8px rgba(16, 185, 129, 0.8);
      }
      .regime-thin_high_cloud,
      .regime-partly_cloudy {
        background: #38bdf8;
        box-shadow: 0 0 8px rgba(56, 189, 248, 0.75);
      }
      .regime-patchy_unreliable {
        background: #f59e0b;
        box-shadow: 0 0 8px rgba(245, 158, 11, 0.8);
      }
      .regime-storm_approaching,
      .regime-storm_overhead {
        background: #c084fc;
        box-shadow: 0 0 10px rgba(192, 132, 252, 0.9);
      }
      .regime-overcast_low,
      .regime-unknown {
        background: #94a3b8;
      }

      .hud-title {
        font-size: 12.5px;
        font-weight: 700;
        line-height: 1.25;
        color: #f8fafc;
      }

      .hud-metrics {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 4px;
        font-size: 11px;
        color: #cbd5e1;
        font-variant-numeric: tabular-nums;
      }

      .hud-metric strong {
        color: #f8fafc;
      }

      .hud-expanded {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid rgba(148, 163, 184, 0.2);
        font-size: 11.5px;
        color: #cbd5e1;
        line-height: 1.4;
      }

      .forecast-strip {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 4px;
        margin-top: 7px;
      }

      .fc-cell {
        background: rgba(30, 41, 59, 0.8);
        border-radius: 6px;
        padding: 4px 3px;
        text-align: center;
        font-size: 10px;
        font-variant-numeric: tabular-nums;
      }

      .fc-bar-bg {
        height: 4px;
        border-radius: 2px;
        background: rgba(100, 116, 139, 0.35);
        margin: 3px 2px;
        overflow: hidden;
      }

      .fc-bar-fill {
        height: 100%;
        background: linear-gradient(90deg, #f59e0b, #38bdf8);
      }

      /* Top-right Quick Layer Switcher */
      .layer-dock {
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 6;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 5px;
      }

      .chip-group {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 4px;
        max-width: 245px;
      }

      button.chip {
        appearance: none;
        border: 1px solid rgba(148, 163, 184, 0.3);
        background: rgba(15, 23, 42, 0.8);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        color: #cbd5e1;
        border-radius: 999px;
        padding: 4px 9px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.14s ease;
        white-space: nowrap;
      }

      button.chip:hover {
        border-color: rgba(148, 163, 184, 0.65);
        color: #ffffff;
      }

      button.chip.active {
        background: rgba(2, 132, 199, 0.86);
        border-color: #38bdf8;
        color: #ffffff;
      }

      button.chip.sub-mode {
        background: rgba(30, 41, 59, 0.9);
        border-color: rgba(251, 191, 36, 0.55);
        color: #fde68a;
      }

      /* Opacity Mixer Popover */
      .mixer-panel {
        background: rgba(15, 23, 42, 0.93);
        backdrop-filter: blur(14px);
        border: 1px solid rgba(148, 163, 184, 0.3);
        border-radius: 10px;
        padding: 9px 11px;
        width: 196px;
        display: flex;
        flex-direction: column;
        gap: 7px;
        font-size: 11px;
      }

      .mixer-row {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .mixer-row input[type="range"] {
        width: 100%;
        accent-color: #38bdf8;
      }

      /* Map zoom & recenter stack */
      .nav-stack {
        position: absolute;
        right: 10px;
        bottom: 12px;
        z-index: 6;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      button.nav-btn {
        appearance: none;
        width: 30px;
        height: 30px;
        border-radius: 8px;
        border: 1px solid rgba(148, 163, 184, 0.3);
        background: rgba(15, 23, 42, 0.84);
        color: #f1f5f9;
        font-size: 15px;
        font-weight: 700;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      button.nav-btn:hover {
        border-color: #38bdf8;
        background: rgba(30, 41, 59, 0.95);
      }

      /* Bottom-left Legend Strip */
      .legend-strip {
        position: absolute;
        left: 10px;
        bottom: 10px;
        z-index: 5;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        padding: 5px 9px;
        border-radius: 8px;
        background: rgba(15, 23, 42, 0.78);
        backdrop-filter: blur(8px);
        border: 1px solid rgba(148, 163, 184, 0.22);
        font-size: 10.5px;
        color: #cbd5e1;
        max-width: calc(100% - 62px);
      }

      .legend-item {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .swatch {
        width: 9px;
        height: 9px;
        border-radius: 2px;
      }

      .radar-ramp {
        width: 58px;
        height: 7px;
        border-radius: 999px;
        background: linear-gradient(
          90deg,
          #38bdf8 0%,
          #22c55e 35%,
          #facc15 62%,
          #ef4444 84%,
          #c026d3 100%
        );
      }

      /* Loading & Error Banners */
      .status-banner {
        position: absolute;
        left: 50%;
        bottom: 48px;
        transform: translateX(-50%);
        z-index: 7;
        background: rgba(15, 23, 42, 0.9);
        border: 1px solid rgba(56, 189, 248, 0.45);
        border-radius: 999px;
        padding: 5px 13px;
        font-size: 11.5px;
        color: #e0f2fe;
        pointer-events: none;
      }

      .status-error {
        border-color: rgba(248, 113, 113, 0.65);
        color: #fecaca;
      }

      @media (max-width: 560px) {
        .solar-hud {
          max-width: calc(100% - 20px);
          position: relative;
          top: 0;
          left: 0;
          border-radius: 0;
          border-left: none;
          border-right: none;
          border-top: none;
        }
        .chip-group {
          max-width: 205px;
        }
      }
    `,
  ];

  static getConfigElement(): HTMLElement {
    return document.createElement("solar-sky-radar-card-editor");
  }

  static getStubConfig(): SolarSkyRadarCardConfig {
    return { ...DEFAULT_CONFIG };
  }

  setConfig(config: SolarSkyRadarCardConfig): void {
    if (!config) {
      throw new Error("Invalid configuration");
    }
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.speed = this.config.playback_speed ?? 1;
    this.mapController?.updateConfig(this.config);
    this.framePlayer?.setLayerFlags({
      trueColour: this.config.show_true_colour ?? true,
      cloudOverlay: this.config.show_cloud_overlay ?? true,
      cloudMode: this.config.cloud_mode ?? "cloud_mask",
      radar: this.config.show_radar ?? true,
    });
    this.framePlayer?.setSpeed(this.speed);
  }

  getCardSize(): number {
    return Math.ceil(((this.config.map_height ?? 490) + 74) / 50);
  }

  protected firstUpdated(): void {
    const mapEl = this.renderRoot.querySelector(".map-canvas") as HTMLElement | null;
    if (!mapEl) return;

    this.mapController = new MapController(mapEl, () => this.hass);
    this.mapController.init(this.config);

    this.framePlayer = new FramePlayer(
      () => this.hass,
      (frame: ResolvedFrameUrls) => {
        this.currentIndex = frame.index;
        this.mapController?.applyFrame(frame);
      },
      (ready: boolean[]) => {
        this.readySlots = ready;
      }
    );
    this.framePlayer.setLayerFlags({
      trueColour: this.config.show_true_colour ?? true,
      cloudOverlay: this.config.show_cloud_overlay ?? true,
      cloudMode: this.config.cloud_mode ?? "cloud_mask",
      radar: this.config.show_radar ?? true,
    });
    this.framePlayer.setSpeed(this.speed);

    void this.refreshAllData(true);

    // Refresh every 3 minutes while mounted
    this.pollTimer = window.setInterval(() => {
      void this.refreshAllData(false);
    }, 180_000);

    this.visibilityObserver = new IntersectionObserver((entries) => {
      const visible = entries.some((e) => e.isIntersecting);
      if (!visible && this.playing) {
        this.framePlayer?.pause();
        this.playing = false;
      }
    });
    this.visibilityObserver.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.pollTimer !== null) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.visibilityObserver?.disconnect();
    this.framePlayer?.destroy();
    this.mapController?.destroy();
  }

  private apiBase(): string {
    return (this.config.api_base ?? "/api/solar_sky_radar").replace(/\/$/, "");
  }

  private async apiGetJson<T>(url: string): Promise<T> {
    const resp =
      this.hass?.fetchWithAuth && url.startsWith("/api/")
        ? await this.hass.fetchWithAuth(url)
        : await fetch(url, { credentials: "same-origin" });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status} loading ${url}`);
    }
    return (await resp.json()) as T;
  }

  async refreshAllData(initial = false): Promise<void> {
    if (initial) this.loading = true;
    this.errorMessage = null;

    const entryParam = this.config.entry_id
      ? `?entry_id=${encodeURIComponent(this.config.entry_id)}`
      : "";
    const base = this.apiBase();

    try {
      const manifest = await this.apiGetJson<ManifestPayload>(
        `${base}/manifest${entryParam}`
      );
      this.manifest = manifest;
      this.timeline = manifest.timeline ?? [];
      this.mapController?.setManifest(manifest);

      await this.framePlayer?.loadManifest(manifest, !initial);
      this.currentIndex = this.framePlayer?.index ?? 0;

      const [windRes, hazardsRes] = await Promise.allSettled([
        this.apiGetJson<WindPayload>(`${manifest.endpoints.wind}${entryParam}`),
        this.apiGetJson<HazardsPayload>(`${manifest.endpoints.hazards}${entryParam}`),
      ]);

      if (windRes.status === "fulfilled") {
        this.wind = windRes.value;
        this.mapController?.setWind(windRes.value);
      }
      if (hazardsRes.status === "fulfilled") {
        this.hazards = hazardsRes.value;
        this.mapController?.setHazards(hazardsRes.value);
      }

      if (initial && this.config.autoplay && this.timeline.length > 1) {
        this.framePlayer?.play();
        this.playing = true;
      }
    } catch (err) {
      this.errorMessage =
        err instanceof Error ? err.message : "Failed to load Solar Sky Radar feed";
    } finally {
      this.loading = false;
    }
  }

  private toggleFlag(key: keyof SolarSkyRadarCardConfig, currentDefault = true): void {
    const cur = Boolean(this.config[key] ?? currentDefault);
    this.setConfig({ ...this.config, [key]: !cur });
  }

  private cycleCloudMode(): void {
    const next: CloudRenderMode =
      (this.config.cloud_mode ?? "cloud_mask") === "cloud_mask"
        ? "solar_cloud"
        : "cloud_mask";
    this.setConfig({ ...this.config, show_cloud_overlay: true, cloud_mode: next });
  }

  private cycleWindLevel(): void {
    const next: WindAltitudeMode =
      (this.config.wind_level ?? "850hPa") === "850hPa" ? "10m" : "850hPa";
    this.setConfig({ ...this.config, show_wind: true, wind_level: next });
  }

  private renderSolarHud() {
    if (!(this.config.show_solar_hud ?? true)) return nothing;
    const solar = this.manifest?.solar;
    const titlePrefix = this.config.title ? `${this.config.title} · ` : "";

    if (!solar) {
      return html`
        <div class="solar-hud">
          <div class="hud-header">
            <span class="regime-dot regime-unknown"></span>
            <span class="hud-title">${titlePrefix}Scanning Geostationary Sky...</span>
          </div>
        </div>
      `;
    }

    return html`
      <div
        class="solar-hud"
        title="Tap to toggle 60-minute upwind solar forecast"
        @click=${() => {
          this.hudExpanded = !this.hudExpanded;
        }}
      >
        <div class="hud-header">
          <span class="regime-dot regime-${solar.regime}"></span>
          <span class="hud-title">${titlePrefix}${solar.regime_label}</span>
        </div>
        <div class="hud-metrics">
          <span class="hud-metric">
            Solar <strong>~${solar.estimated_transmittance_pct}%</strong>
          </span>
          <span class="hud-metric">
            Cloud <strong>${Math.round(solar.local_cloud_cover_pct)}%</strong>
          </span>
          <span class="hud-metric">
            Patchiness <strong>${Math.round(solar.patchiness_index)}</strong>/100
          </span>
          ${solar.approaching_cloud_eta_min !== null
            ? html`<span class="hud-metric" style="color:#fcd34d;">
                Drop ETA <strong>~${solar.approaching_cloud_eta_min}m</strong>
              </span>`
            : nothing}
        </div>

        ${this.hudExpanded
          ? html`
              <div class="hud-expanded">
                <div>${solar.summary}</div>
                <div style="margin-top:4px;font-size:10.5px;color:#94a3b8;">
                  850 hPa Cloud Steering: ${Math.round(solar.cloud_wind_speed_kmh)} km/h
                  from ${Math.round(solar.cloud_wind_from_deg)}° · Sat:
                  ${this.manifest?.providers.satellite.label ?? ""}
                </div>
                ${solar.forecast_60m?.length
                  ? html`
                      <div class="forecast-strip">
                        ${solar.forecast_60m.map(
                          (st) => html`
                            <div class="fc-cell">
                              <div>+${st.minutes_ahead}m</div>
                              <div class="fc-bar-bg">
                                <div
                                  class="fc-bar-fill"
                                  style="width:${st.est_solar_pct}%;"
                                ></div>
                              </div>
                              <div>${st.est_solar_pct}%</div>
                            </div>
                          `
                        )}
                      </div>
                    `
                  : nothing}
              </div>
            `
          : nothing}
      </div>
    `;
  }

  private renderLegend() {
    if (!(this.config.show_legend ?? true)) return nothing;
    const isSolarMode =
      (this.config.show_cloud_overlay ?? true) &&
      this.config.cloud_mode === "solar_cloud";
    const fireCount = this.hazards?.fires?.features?.length ?? 0;
    const ltgCount = this.hazards?.lightning?.meta?.count_2h ?? 0;

    return html`
      <div class="legend-strip">
        ${this.config.show_radar ?? true
          ? html`
              <span class="legend-item">
                <span>Rain</span>
                <span class="radar-ramp"></span>
              </span>
            `
          : nothing}
        ${isSolarMode
          ? html`
              <span class="legend-item">
                <span class="swatch" style="background:#7de2ff;"></span>Cirrus
              </span>
              <span class="legend-item">
                <span class="swatch" style="background:#ffc44d;"></span>Patchy
              </span>
              <span class="legend-item">
                <span class="swatch" style="background:#c05cff;"></span>Storm Deck
              </span>
            `
          : nothing}
        ${(this.config.show_fires ?? true) && fireCount > 0
          ? html`
              <span class="legend-item">
                <span
                  class="swatch"
                  style="background:#fb923c;border-radius:50%;"
                ></span
                >Fires (${fireCount})
              </span>
            `
          : nothing}
        ${(this.config.show_lightning ?? true) && ltgCount > 0
          ? html`
              <span class="legend-item">
                <span
                  class="swatch"
                  style="background:#fde047;border-radius:50%;"
                ></span
                >Strikes (${ltgCount})
              </span>
            `
          : nothing}
      </div>
    `;
  }

  render() {
    const height = this.config.map_height ?? 490;
    const cloudModeLabel =
      this.config.cloud_mode === "solar_cloud" ? "Solar Class" : "Visual Mask";
    const windLevel = this.config.wind_level ?? "850hPa";

    return html`
      <div class="card">
        <div class="viewport" style="height: ${height}px;">
          <div class="map-canvas"></div>

          ${this.renderSolarHud()}

          <div class="layer-dock">
            <div class="chip-group">
              <button
                class="chip ${(this.config.show_true_colour ?? true) ? "active" : ""}"
                title="Toggle Himawari-9 / GeoColor Visible True Colour"
                @click=${() => this.toggleFlag("show_true_colour", true)}
              >
                True Colour
              </button>
              <button
                class="chip ${(this.config.show_cloud_overlay ?? true) ? "active" : ""}"
                title="Toggle Visual Cloud Overlay"
                @click=${() => this.toggleFlag("show_cloud_overlay", true)}
              >
                Clouds
              </button>
              ${this.config.show_cloud_overlay ?? true
                ? html`
                    <button
                      class="chip sub-mode"
                      title="Switch between Clean Cloud Mask and Solar Cloud Classification"
                      @click=${this.cycleCloudMode}
                    >
                      ${cloudModeLabel}
                    </button>
                  `
                : nothing}
              <button
                class="chip ${(this.config.show_radar ?? true) ? "active" : ""}"
                title="Toggle Rain Radar"
                @click=${() => this.toggleFlag("show_radar", true)}
              >
                Rain
              </button>
              <button
                class="chip ${(this.config.show_wind ?? true) ? "active" : ""}"
                title="Toggle Animated Wind Streamlines"
                @click=${() => this.toggleFlag("show_wind", true)}
              >
                Wind
              </button>
              ${this.config.show_wind ?? true
                ? html`
                    <button
                      class="chip sub-mode"
                      title="Switch between 850 hPa Cloud-Steering Wind and 10 m Surface Wind"
                      @click=${this.cycleWindLevel}
                    >
                      ${windLevel}
                    </button>
                  `
                : nothing}
              <button
                class="chip ${(this.config.show_lightning ?? true) ? "active" : ""}"
                title="Toggle Blitzortung Lightning"
                @click=${() => this.toggleFlag("show_lightning", true)}
              >
                Lightning
              </button>
              <button
                class="chip ${(this.config.show_fires ?? true) ? "active" : ""}"
                title="Toggle NASA FIRMS & DEA Bushfire Hotspots"
                @click=${() => this.toggleFlag("show_fires", true)}
              >
                FIRMS
              </button>
              <button
                class="chip ${(this.config.show_solar_rings ?? true) ? "active" : ""}"
                title="Toggle 15m / 30m / 60m Upwind Cloud Arrival Arcs"
                @click=${() => this.toggleFlag("show_solar_rings", true)}
              >
                ETA Rings
              </button>
              <button
                class="chip ${this.mixerOpen ? "active" : ""}"
                title="Adjust Layer Opacities"
                @click=${() => {
                  this.mixerOpen = !this.mixerOpen;
                }}
              >
                Opacity
              </button>
            </div>

            ${this.mixerOpen
              ? html`
                  <div class="mixer-panel">
                    <div class="mixer-row">
                      <span
                        >True Colour
                        (${Math.round((this.config.true_colour_opacity ?? 0.84) * 100)}%)</span
                      >
                      <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.05"
                        .value=${String(this.config.true_colour_opacity ?? 0.84)}
                        @input=${(e: Event) =>
                          this.setConfig({
                            ...this.config,
                            true_colour_opacity: Number(
                              (e.target as HTMLInputElement).value
                            ),
                          })}
                      />
                    </div>
                    <div class="mixer-row">
                      <span
                        >Cloud Overlay
                        (${Math.round((this.config.cloud_opacity ?? 0.78) * 100)}%)</span
                      >
                      <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.05"
                        .value=${String(this.config.cloud_opacity ?? 0.78)}
                        @input=${(e: Event) =>
                          this.setConfig({
                            ...this.config,
                            cloud_opacity: Number(
                              (e.target as HTMLInputElement).value
                            ),
                          })}
                      />
                    </div>
                    <div class="mixer-row">
                      <span
                        >Rain Radar
                        (${Math.round((this.config.radar_opacity ?? 0.85) * 100)}%)</span
                      >
                      <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.05"
                        .value=${String(this.config.radar_opacity ?? 0.85)}
                        @input=${(e: Event) =>
                          this.setConfig({
                            ...this.config,
                            radar_opacity: Number(
                              (e.target as HTMLInputElement).value
                            ),
                          })}
                      />
                    </div>
                  </div>
                `
              : nothing}
          </div>

          <div class="nav-stack">
            <button
              class="nav-btn"
              title="Zoom in"
              @click=${() => this.mapController?.zoomBy(1)}
            >
              +
            </button>
            <button
              class="nav-btn"
              title="Zoom out"
              @click=${() => this.mapController?.zoomBy(-1)}
            >
              &minus;
            </button>
            <button
              class="nav-btn"
              title="Recenter on Home / Solar Array"
              @click=${() => this.mapController?.recenter()}
            >
              &#8982;
            </button>
          </div>

          ${this.renderLegend()}
          ${this.loading
            ? html`<div class="status-banner">
                Loading 2-hour Himawari / Radar frames...
              </div>`
            : nothing}
          ${this.errorMessage
            ? html`<div class="status-banner status-error">
                ${this.errorMessage}
              </div>`
            : nothing}
        </div>

        <solar-sky-jog-slider
          .timeline=${this.timeline}
          .readySlots=${this.readySlots}
          .currentIndex=${this.currentIndex}
          .playing=${this.playing}
          .speed=${this.speed}
          .timeZone=${this.hass?.config?.time_zone ?? ""}
          @jog-seek=${(e: CustomEvent<{ index: number; pause: boolean }>) => {
            this.framePlayer?.seek(e.detail.index, e.detail.pause);
            this.playing = this.framePlayer?.isPlaying ?? false;
          }}
          @jog-step=${(e: CustomEvent<{ delta: number }>) => {
            this.framePlayer?.step(e.detail.delta);
            this.playing = false;
          }}
          @jog-toggle=${() => {
            this.playing = this.framePlayer?.togglePlay() ?? false;
          }}
          @jog-speed=${(e: CustomEvent<{ speed: number }>) => {
            this.speed = e.detail.speed;
            this.framePlayer?.setSpeed(this.speed);
          }}
        ></solar-sky-jog-slider>
      </div>
    `;
  }
}

if (!customElements.get("solar-sky-radar-card")) {
  customElements.define("solar-sky-radar-card", SolarSkyRadarCard);
}
