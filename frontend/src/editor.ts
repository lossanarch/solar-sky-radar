import { LitElement, css, html } from "lit";
import { property, state } from "lit/decorators.js";
import type {
  BasemapTheme,
  CloudRenderMode,
  HomeAssistantLike,
  SolarSkyRadarCardConfig,
  WindAltitudeMode,
} from "./types";

export class SolarSkyRadarCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistantLike;
  @state() private config: SolarSkyRadarCardConfig = {
    type: "custom:solar-sky-radar-card",
  };

  static styles = css`
    :host {
      display: block;
      font-family: var(--paper-font-body1_-_font-family, system-ui, sans-serif);
      color: var(--primary-text-color, #e2e8f0);
    }

    .section {
      margin-bottom: 16px;
      padding: 12px;
      border-radius: 10px;
      background: rgba(30, 41, 59, 0.45);
      border: 1px solid rgba(148, 163, 184, 0.2);
    }

    .section-title {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 10px;
      color: #38bdf8;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 10px;
    }

    label.field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12.5px;
    }

    label.toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 0;
      font-size: 13px;
      cursor: pointer;
    }

    input[type="text"],
    input[type="number"],
    select {
      padding: 7px 9px;
      border-radius: 7px;
      border: 1px solid rgba(148, 163, 184, 0.35);
      background: rgba(15, 23, 42, 0.8);
      color: inherit;
      font-size: 13px;
    }

    input[type="range"] {
      width: 100%;
      accent-color: #38bdf8;
    }
  `;

  setConfig(config: SolarSkyRadarCardConfig): void {
    this.config = { ...config };
  }

  private updateField<K extends keyof SolarSkyRadarCardConfig>(
    key: K,
    value: SolarSkyRadarCardConfig[K]
  ): void {
    const next = { ...this.config, [key]: value };
    this.config = next;
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: next },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    const c = this.config;
    return html`
      <div class="section">
        <div class="section-title">Map & Location</div>
        <div class="grid">
          <label class="field">
            <span>Card Title (optional)</span>
            <input
              type="text"
              .value=${c.title ?? ""}
              placeholder="Melbourne Solar Sky"
              @input=${(e: Event) =>
                this.updateField("title", (e.target as HTMLInputElement).value)}
            />
          </label>
          <label class="field">
            <span>Basemap Style</span>
            <select
              .value=${c.basemap_theme ?? "auto"}
              @change=${(e: Event) =>
                this.updateField(
                  "basemap_theme",
                  (e.target as HTMLSelectElement).value as BasemapTheme
                )}
            >
              <option value="auto">Auto (Follow HA Dark/Light)</option>
              <option value="dark">Vector Dark (Labels Above Clouds)</option>
              <option value="light">Vector Light (Labels Above Clouds)</option>
              <option value="bom_dark">BOM Native Dark (Australia)</option>
              <option value="bom_light">BOM Native Light (Australia)</option>
            </select>
          </label>
          <label class="field">
            <span>Initial Zoom (4 - 11)</span>
            <input
              type="number"
              min="4"
              max="11"
              step="0.2"
              .value=${String(c.zoom_level ?? 7.2)}
              @change=${(e: Event) =>
                this.updateField(
                  "zoom_level",
                  Number((e.target as HTMLInputElement).value)
                )}
            />
          </label>
          <label class="field">
            <span>Map Height (px)</span>
            <input
              type="number"
              min="280"
              max="960"
              step="10"
              .value=${String(c.map_height ?? 480)}
              @change=${(e: Event) =>
                this.updateField(
                  "map_height",
                  Number((e.target as HTMLInputElement).value)
                )}
            />
          </label>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Satellite, Solar Cloud & Weather Overlays</div>
        <label class="toggle">
          <span>Satellite Visible True Colour (Himawari-9 / Global GeoColor)</span>
          <input
            type="checkbox"
            .checked=${c.show_true_colour ?? true}
            @change=${(e: Event) =>
              this.updateField("show_true_colour", (e.target as HTMLInputElement).checked)}
          />
        </label>
        <label class="field">
          <span>True Colour Opacity (${Math.round((c.true_colour_opacity ?? 0.85) * 100)}%)</span>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            .value=${String(c.true_colour_opacity ?? 0.85)}
            @input=${(e: Event) =>
              this.updateField(
                "true_colour_opacity",
                Number((e.target as HTMLInputElement).value)
              )}
          />
        </label>

        <label class="toggle">
          <span>Visual Cloud Overlay (Solar Prediction Layer)</span>
          <input
            type="checkbox"
            .checked=${c.show_cloud_overlay ?? true}
            @change=${(e: Event) =>
              this.updateField(
                "show_cloud_overlay",
                (e.target as HTMLInputElement).checked
              )}
          />
        </label>
        <div class="grid">
          <label class="field">
            <span>Cloud Overlay Mode</span>
            <select
              .value=${c.cloud_mode ?? "cloud_mask"}
              @change=${(e: Event) =>
                this.updateField(
                  "cloud_mode",
                  (e.target as HTMLSelectElement).value as CloudRenderMode
                )}
            >
              <option value="cloud_mask">Clean Visual Cloud Mask</option>
              <option value="solar_cloud">
                Solar Classification (Cirrus / Patchy / Storm)
              </option>
            </select>
          </label>
          <label class="field">
            <span>Cloud Opacity (${Math.round((c.cloud_opacity ?? 0.78) * 100)}%)</span>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              .value=${String(c.cloud_opacity ?? 0.78)}
              @input=${(e: Event) =>
                this.updateField(
                  "cloud_opacity",
                  Number((e.target as HTMLInputElement).value)
                )}
            />
          </label>
        </div>

        <label class="toggle">
          <span>Rain Radar Overlay (BOM 5-min / RainViewer)</span>
          <input
            type="checkbox"
            .checked=${c.show_radar ?? true}
            @change=${(e: Event) =>
              this.updateField("show_radar", (e.target as HTMLInputElement).checked)}
          />
        </label>

        <label class="toggle">
          <span>Animated Wind Streamlines</span>
          <input
            type="checkbox"
            .checked=${c.show_wind ?? true}
            @change=${(e: Event) =>
              this.updateField("show_wind", (e.target as HTMLInputElement).checked)}
          />
        </label>
        <label class="field">
          <span>Wind Streamline Altitude</span>
          <select
            .value=${c.wind_level ?? "850hPa"}
            @change=${(e: Event) =>
              this.updateField(
                "wind_level",
                (e.target as HTMLSelectElement).value as WindAltitudeMode
              )}
          >
            <option value="850hPa">
              850 hPa Cloud-Steering Wind (~1.5 km, best for approaching clouds)
            </option>
            <option value="10m">10 m Surface Wind</option>
          </select>
        </label>

        <label class="toggle">
          <span>Time-Synced Blitzortung Lightning Strikes</span>
          <input
            type="checkbox"
            .checked=${c.show_lightning ?? true}
            @change=${(e: Event) =>
              this.updateField("show_lightning", (e.target as HTMLInputElement).checked)}
          />
        </label>

        <label class="toggle">
          <span>NASA FIRMS & DEA Bushfire Hotspots</span>
          <input
            type="checkbox"
            .checked=${c.show_fires ?? true}
            @change=${(e: Event) =>
              this.updateField("show_fires", (e.target as HTMLInputElement).checked)}
          />
        </label>

        <label class="toggle">
          <span>Upwind Solar Arrival Arcs (15m / 30m / 60m)</span>
          <input
            type="checkbox"
            .checked=${c.show_solar_rings ?? true}
            @change=${(e: Event) =>
              this.updateField(
                "show_solar_rings",
                (e.target as HTMLInputElement).checked
              )}
          />
        </label>

        <label class="toggle">
          <span>Solar Sky Nowcast HUD Banner</span>
          <input
            type="checkbox"
            .checked=${c.show_solar_hud ?? true}
            @change=${(e: Event) =>
              this.updateField("show_solar_hud", (e.target as HTMLInputElement).checked)}
          />
        </label>

        <label class="toggle">
          <span>Autoplay 2-Hour Loop on Open</span>
          <input
            type="checkbox"
            .checked=${c.autoplay ?? false}
            @change=${(e: Event) =>
              this.updateField("autoplay", (e.target as HTMLInputElement).checked)}
          />
        </label>
      </div>
    `;
  }
}

if (!customElements.get("solar-sky-radar-card-editor")) {
  customElements.define("solar-sky-radar-card-editor", SolarSkyRadarCardEditor);
}
