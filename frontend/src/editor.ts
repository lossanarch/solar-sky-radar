import { LitElement, css, html } from "lit";
import { property, state } from "lit/decorators.js";
import {
  resolveAutoplayMode,
  type AutoplayMode,
  type BasemapTheme,
  type CloudRenderMode,
  type HomeAssistantLike,
  type SolarSkyRadarCardConfig,
  type WindAltitudeMode,
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
      color: var(--primary-text-color, #1e293b);
    }

    .section {
      margin-bottom: 16px;
      padding: 14px;
      border-radius: 12px;
      background: var(--secondary-background-color, rgba(148, 163, 184, 0.12));
      border: 1px solid var(--divider-color, rgba(148, 163, 184, 0.3));
    }

    .section-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 12px;
      padding-left: 8px;
      border-left: 3px solid var(--primary-color, #0284c7);
      color: var(--primary-text-color, #0f172a);
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 12px;
    }

    label.field {
      display: flex;
      flex-direction: column;
      gap: 5px;
      font-size: 12.5px;
      font-weight: 500;
      color: var(--primary-text-color, #1e293b);
    }

    .field-hint {
      font-size: 11px;
      font-weight: 400;
      color: var(--secondary-text-color, #64748b);
    }

    label.toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 7px 0;
      font-size: 13px;
      color: var(--primary-text-color, #1e293b);
      cursor: pointer;
    }

    input[type="text"],
    input[type="number"],
    select {
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid var(--divider-color, rgba(100, 116, 139, 0.45));
      background: var(--card-background-color, var(--ha-card-background, #ffffff));
      color: var(--primary-text-color, #0f172a);
      font-size: 13px;
      outline: none;
      transition: border-color 0.14s ease, box-shadow 0.14s ease;
    }

    input[type="text"]::placeholder {
      color: var(--secondary-text-color, #64748b);
      opacity: 0.85;
    }

    input[type="text"]:focus,
    input[type="number"]:focus,
    select:focus {
      border-color: var(--primary-color, #0284c7);
      box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.18);
    }

    select option {
      background: var(--card-background-color, var(--ha-card-background, #ffffff));
      color: var(--primary-text-color, #0f172a);
    }

    input[type="checkbox"] {
      width: 16px;
      height: 16px;
      accent-color: var(--primary-color, #0284c7);
      cursor: pointer;
      flex-shrink: 0;
    }

    input[type="range"] {
      width: 100%;
      accent-color: var(--primary-color, #0284c7);
    }
  `;

  setConfig(config: SolarSkyRadarCardConfig): void {
    this.config = { ...config };
  }

  private emitConfig(next: SolarSkyRadarCardConfig): void {
    this.config = next;
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: next },
        bubbles: true,
        composed: true,
      })
    );
  }

  private updateField<K extends keyof SolarSkyRadarCardConfig>(
    key: K,
    value: SolarSkyRadarCardConfig[K]
  ): void {
    this.emitConfig({ ...this.config, [key]: value });
  }

  private updateAutoplayMode(mode: AutoplayMode): void {
    const next: SolarSkyRadarCardConfig = {
      ...this.config,
      autoplay_mode: mode,
      autoplay: mode === "loop",
      autoplay_once: mode === "once",
    };
    this.emitConfig(next);
  }

  render() {
    const c = this.config;
    const autoplayMode = resolveAutoplayMode(c);

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
              .value=${String(c.map_height ?? 490)}
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
        <label class="field" style="margin-bottom: 8px;">
          <span>True Colour Opacity (${Math.round((c.true_colour_opacity ?? 1.0) * 100)}%)</span>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            .value=${String(c.true_colour_opacity ?? 1.0)}
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
            .checked=${c.show_cloud_overlay ?? false}
            @change=${(e: Event) =>
              this.updateField(
                "show_cloud_overlay",
                (e.target as HTMLInputElement).checked
              )}
          />
        </label>
        <div class="grid" style="margin-bottom: 8px;">
          <label class="field">
            <span>Cloud Overlay Mode</span>
            <select
              .value=${c.cloud_mode ?? "solar_cloud"}
              @change=${(e: Event) =>
                this.updateField(
                  "cloud_mode",
                  (e.target as HTMLSelectElement).value as CloudRenderMode
                )}
            >
              <option value="solar_cloud">
                Solar Classification (Cirrus / Patchy / Storm)
              </option>
              <option value="cloud_mask">Clean Visual Cloud Mask</option>
            </select>
          </label>
          <label class="field">
            <span>Cloud Opacity (${Math.round((c.cloud_opacity ?? 0.58) * 100)}%)</span>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              .value=${String(c.cloud_opacity ?? 0.58)}
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
        <label class="field" style="margin-bottom: 8px;">
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

        <label class="field" style="margin-top: 8px;">
          <span>2-Hour Playback When Visible (&ge;75% on Screen)</span>
          <select
            .value=${autoplayMode}
            @change=${(e: Event) =>
              this.updateAutoplayMode(
                (e.target as HTMLSelectElement).value as AutoplayMode
              )}
          >
            <option value="off">Off (Manual Play / Scrub)</option>
            <option value="once">
              Single Play 2-Hour Loop When Shown (Plays Once to Live)
            </option>
            <option value="loop">
              Continuous 2-Hour Loop While Visible
            </option>
          </select>
          <span class="field-hint">
            Triggers automatically once scrolling uncovers at least 75% of the map, and pauses when scrolled off-screen.
          </span>
        </label>
      </div>
    `;
  }
}

if (!customElements.get("solar-sky-radar-card-editor")) {
  customElements.define("solar-sky-radar-card-editor", SolarSkyRadarCardEditor);
}
