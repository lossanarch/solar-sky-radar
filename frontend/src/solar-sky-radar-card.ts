import { LitElement, css, html, nothing, type PropertyValues, unsafeCSS } from "lit";
import { property, state } from "lit/decorators.js";
import maplibreCss from "maplibre-gl/dist/maplibre-gl.css?inline";

import "./components/jog-slider";
import "./editor";
import { FramePlayer, type ResolvedFrameUrls } from "./map/frame-player";
import { MapController, preloadMapLibre, resolveIsDark } from "./map/map-controller";
import {
  resolveAutoplayMode,
  type CloudRenderMode,
  type HazardsPayload,
  type HomeAssistantLike,
  type ManifestPayload,
  type SolarSkyRadarCardConfig,
  type TimelineSlot,
  type WindAltitudeMode,
  type WindPayload,
} from "./types";
import { defineCustomElementSafely } from "./utils/register-custom-element";

const DEFAULT_CONFIG: SolarSkyRadarCardConfig = {
  type: "custom:solar-sky-radar-card",
  basemap_theme: "auto",
  zoom_level: 7.2,
  map_height: 490,
  lock_map: true,
  show_true_colour: true,
  true_colour_opacity: 1.0,
  show_cloud_overlay: false,
  cloud_mode: "solar_cloud",
  cloud_opacity: 0.58,
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
  autoplay_mode: "off",
  autoplay: false,
  playback_speed: 1,
};

function clampFinite(val: unknown, fallback: number, min: number, max: number): number {
  const num = typeof val === "number" ? val : Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

function sanitizeCardConfig(raw: SolarSkyRadarCardConfig): SolarSkyRadarCardConfig {
  const merged: SolarSkyRadarCardConfig = { ...DEFAULT_CONFIG, ...raw };
  merged.zoom_level = clampFinite(merged.zoom_level, 7.2, 3, 12);
  merged.map_height = clampFinite(merged.map_height, 490, 240, 1400);
  merged.true_colour_opacity = clampFinite(merged.true_colour_opacity, 1.0, 0.05, 1.0);
  merged.cloud_opacity = clampFinite(merged.cloud_opacity, 0.58, 0.05, 1.0);
  merged.radar_opacity = clampFinite(merged.radar_opacity, 0.85, 0.05, 1.0);
  merged.wind_opacity = clampFinite(merged.wind_opacity, 0.85, 0.05, 1.0);
  merged.playback_speed = clampFinite(merged.playback_speed, 1, 0.25, 4);
  if (merged.center_latitude !== undefined) {
    const lat = Number(merged.center_latitude);
    merged.center_latitude = Number.isFinite(lat) ? Math.max(-85, Math.min(85, lat)) : undefined;
  }
  if (merged.center_longitude !== undefined) {
    const lon = Number(merged.center_longitude);
    merged.center_longitude = Number.isFinite(lon) ? Math.max(-180, Math.min(180, lon)) : undefined;
  }
  return merged;
}

export class SolarSkyRadarCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistantLike;
  @property({ attribute: false }) layout?: string;
  @property({ type: Boolean }) preview = false;
  @property({ type: Boolean }) editMode = false;
  @property({ type: Boolean }) isPanel = false;

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
  @state() private mapEngineError: string | null = null;
  @state() private hudExpanded = false;
  @state() private layersOpen = false;
  @state() private attribOpen = false;
  @state() private mapLocked = true;

  private mapController: MapController | null = null;
  private framePlayer: FramePlayer | null = null;
  private pollTimer: number | null = null;
  private disconnectTimer: number | null = null;
  private visibilityObserver: IntersectionObserver | null = null;

  private isUncovered75 = false;
  private hasPlayedSingleOnReveal = false;
  private userPausedWhileVisible = false;
  private lastDarkResolved: boolean | null = null;

  static styles = [
    unsafeCSS(maplibreCss),
    css`
      :host {
        display: block;
      }

      .card {
        --surface-bg: rgba(15, 23, 42, 0.86);
        --surface-bg-hover: rgba(15, 23, 42, 0.95);
        --surface-elevated: rgba(30, 41, 59, 0.9);
        --surface-border: rgba(148, 163, 184, 0.28);
        --text-strong: #f8fafc;
        --text-body: #cbd5e1;
        --text-muted: #94a3b8;
        --eta-accent: #fbbf24;
        --subchip-bg: rgba(245, 158, 11, 0.2);
        --subchip-border: rgba(251, 191, 36, 0.6);
        --subchip-text: #fde68a;

        background: #0b1120;
        border-radius: var(--ha-card-border-radius, 14px);
        overflow: hidden;
        border: 1px solid var(--divider-color, rgba(148, 163, 184, 0.2));
        box-shadow: var(--ha-card-box-shadow, 0 6px 24px rgba(0, 0, 0, 0.22));
        position: relative;
        font-family: var(
          --paper-font-body1_-_font-family,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          Roboto,
          sans-serif
        );
        color: var(--text-strong);
      }

      .card[data-theme="light"] {
        --surface-bg: rgba(255, 255, 255, 0.9);
        --surface-bg-hover: rgba(255, 255, 255, 0.98);
        --surface-elevated: rgba(241, 245, 249, 0.95);
        --surface-border: rgba(15, 23, 42, 0.16);
        --text-strong: #0f172a;
        --text-body: #334155;
        --text-muted: #64748b;
        --eta-accent: #b45309;
        --subchip-bg: rgba(254, 243, 199, 0.95);
        --subchip-border: rgba(217, 119, 6, 0.5);
        --subchip-text: #92400e;
        background: #e2e8f0;
      }

      .viewport {
        position: relative;
        width: 100%;
      }

      .map-canvas {
        position: absolute;
        inset: 0;
      }

      /* When locked to centre, pass single-finger vertical swipes straight through to mobile page scroll */
      .viewport[data-locked="true"] .map-canvas,
      .viewport[data-locked="true"] .maplibregl-map,
      .viewport[data-locked="true"] .maplibregl-canvas-container,
      .viewport[data-locked="true"] .maplibregl-canvas {
        touch-action: pan-y !important;
      }

      .viewport[data-locked="true"] .maplibregl-canvas-container {
        cursor: default;
      }

      /* Top-left Solar HUD — never collides with the single top-right Layers pill */
      .solar-hud {
        position: absolute;
        top: 10px;
        left: 10px;
        max-width: min(350px, calc(100% - 118px));
        z-index: 6;
        background: var(--surface-bg);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid var(--surface-border);
        border-radius: 12px;
        padding: 7px 11px;
        cursor: pointer;
        user-select: none;
        transition: border-color 0.15s ease, background 0.15s ease;
        box-shadow: 0 3px 12px rgba(15, 23, 42, 0.18);
      }

      .solar-hud:hover {
        border-color: #0284c7;
        background: var(--surface-bg-hover);
      }

      .hud-header {
        display: flex;
        align-items: center;
        gap: 7px;
      }

      .regime-dot {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        flex-shrink: 0;
      }

      .regime-clear_reliable {
        background: #16a34a;
        box-shadow: 0 0 8px rgba(22, 163, 74, 0.6);
      }
      .regime-mostly_clear {
        background: #65a30d;
      }
      .regime-thin_high_cirrus {
        background: #0284c7;
      }
      .regime-patchy_unreliable {
        background: #f59e0b;
        box-shadow: 0 0 8px rgba(245, 158, 11, 0.6);
      }
      .regime-overcast_steady {
        background: #64748b;
      }
      .regime-storm_approaching {
        background: #c026d3;
        box-shadow: 0 0 8px rgba(192, 38, 211, 0.65);
      }
      .regime-unknown {
        background: #94a3b8;
      }

      .hud-title {
        font-size: 12px;
        font-weight: 700;
        line-height: 1.25;
        color: var(--text-strong);
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .hud-chevron {
        font-size: 10px;
        color: var(--text-muted);
        flex-shrink: 0;
      }

      .hud-metrics {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        margin-top: 3px;
        font-size: 11px;
        color: var(--text-body);
        font-variant-numeric: tabular-nums;
      }

      .hud-metric strong {
        color: var(--text-strong);
      }

      .hud-eta {
        color: var(--eta-accent);
        font-weight: 600;
      }

      .hud-expanded {
        margin-top: 7px;
        padding-top: 7px;
        border-top: 1px solid var(--surface-border);
        font-size: 11.5px;
        color: var(--text-body);
        line-height: 1.4;
      }

      .hud-submeta {
        margin-top: 4px;
        font-size: 10.5px;
        color: var(--text-muted);
      }

      .forecast-strip {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 4px;
        margin-top: 7px;
      }

      .fc-cell {
        background: var(--surface-elevated);
        border: 1px solid var(--surface-border);
        border-radius: 6px;
        padding: 4px 3px;
        text-align: center;
        font-size: 10px;
        color: var(--text-strong);
        font-variant-numeric: tabular-nums;
      }

      .fc-bar-bg {
        height: 4px;
        border-radius: 2px;
        background: rgba(148, 163, 184, 0.32);
        margin: 3px 2px;
        overflow: hidden;
      }

      .fc-bar-fill {
        height: 100%;
        background: linear-gradient(90deg, #f59e0b, #0ea5e9);
      }

      /* Top-right single Layers pill + collapsible popover */
      .layer-dock {
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 7;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 6px;
      }

      button.layers-pill {
        appearance: none;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border: 1px solid var(--surface-border);
        background: var(--surface-bg);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        color: var(--text-strong);
        border-radius: 999px;
        padding: 6px 12px;
        font-size: 11.5px;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 3px 10px rgba(15, 23, 42, 0.18);
        transition: all 0.14s ease;
      }

      button.layers-pill:hover {
        border-color: #0284c7;
        background: var(--surface-bg-hover);
      }

      button.layers-pill.open {
        background: rgba(2, 132, 199, 0.92);
        border-color: #0284c7;
        color: #ffffff;
      }

      .layers-count {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 17px;
        height: 17px;
        padding: 0 5px;
        border-radius: 999px;
        font-size: 10.5px;
        font-weight: 700;
        background: rgba(14, 165, 233, 0.22);
        color: var(--text-strong);
        font-variant-numeric: tabular-nums;
      }

      button.layers-pill.open .layers-count {
        background: rgba(255, 255, 255, 0.24);
        color: #ffffff;
      }

      .layers-popover {
        width: min(268px, calc(100vw - 24px));
        background: var(--surface-bg-hover);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        border: 1px solid var(--surface-border);
        border-radius: 12px;
        padding: 10px 11px;
        box-shadow: 0 10px 28px rgba(15, 23, 42, 0.28);
        display: flex;
        flex-direction: column;
        gap: 9px;
      }

      .popover-section-label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--text-muted);
      }

      .chip-group {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }

      button.chip {
        appearance: none;
        border: 1px solid var(--surface-border);
        background: var(--surface-elevated);
        color: var(--text-body);
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.14s ease;
        white-space: nowrap;
      }

      button.chip:hover {
        border-color: #0284c7;
        color: var(--text-strong);
      }

      button.chip.active {
        background: rgba(2, 132, 199, 0.9);
        border-color: #0284c7;
        color: #ffffff;
      }

      button.chip.sub-mode {
        background: var(--subchip-bg);
        border-color: var(--subchip-border);
        color: var(--subchip-text);
      }

      .mixer-group {
        border-top: 1px solid var(--surface-border);
        padding-top: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .mixer-row {
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: 11px;
        color: var(--text-body);
      }

      .mixer-row input[type="range"] {
        width: 100%;
        accent-color: #0284c7;
        height: 4px;
        cursor: pointer;
      }

      /* Bottom-left Legend Strip — stays flush at bottom without being bumped up */
      .legend-strip {
        position: absolute;
        left: 10px;
        bottom: 10px;
        max-width: calc(100% - 54px);
        z-index: 5;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 7px;
        background: var(--surface-bg);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid var(--surface-border);
        border-radius: 9px;
        padding: 4px 8px;
        font-size: 10.5px;
        color: var(--text-body);
        pointer-events: none;
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.14);
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
        width: 38px;
        height: 7px;
        border-radius: 3px;
        background: linear-gradient(
          90deg,
          #38bdf8 0%,
          #22c55e 34%,
          #facc15 62%,
          #ef4444 84%,
          #c084fc 100%
        );
      }

      /* Bottom-right compact Zoom/Recenter stack + minimal collapsed-by-default attribution */
      .nav-stack {
        position: absolute;
        right: 8px;
        bottom: 34px;
        z-index: 5;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      button.nav-btn {
        appearance: none;
        width: 28px;
        height: 28px;
        border-radius: 8px;
        border: 1px solid var(--surface-border);
        background: var(--surface-bg);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        color: var(--text-strong);
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.15);
      }

      button.nav-btn:hover {
        border-color: #0284c7;
        background: var(--surface-bg-hover);
      }

      button.nav-btn.lock-btn {
        transition: border-color 0.16s ease, background 0.16s ease, color 0.16s ease,
          box-shadow 0.16s ease;
      }

      button.nav-btn.lock-btn.unlocked {
        border-color: #38bdf8;
        background: rgba(14, 165, 233, 0.24);
        color: #38bdf8;
        box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.22),
          0 2px 8px rgba(15, 23, 42, 0.18);
      }

      .card[data-theme="light"] button.nav-btn.lock-btn.unlocked {
        border-color: #0284c7;
        background: rgba(2, 132, 199, 0.16);
        color: #0284c7;
        box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.18),
          0 2px 8px rgba(15, 23, 42, 0.12);
      }

      .attrib-box {
        position: absolute;
        right: 8px;
        bottom: 8px;
        z-index: 6;
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }

      .attrib-links {
        background: var(--surface-bg-hover);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid var(--surface-border);
        border-radius: 999px;
        padding: 2px 8px;
        font-size: 10px;
        color: var(--text-muted);
        white-space: nowrap;
        box-shadow: 0 2px 6px rgba(15, 23, 42, 0.14);
      }

      .attrib-links a {
        color: var(--text-body);
        text-decoration: none;
      }

      .attrib-links a:hover {
        text-decoration: underline;
      }

      button.attrib-btn {
        appearance: none;
        width: 20px;
        height: 20px;
        border-radius: 999px;
        border: 1px solid var(--surface-border);
        background: var(--surface-bg);
        color: var(--text-muted);
        font-size: 11px;
        font-weight: 700;
        font-style: italic;
        font-family: Georgia, serif;
        line-height: 1;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        opacity: 0.72;
        transition: opacity 0.14s ease, border-color 0.14s ease;
      }

      button.attrib-btn:hover,
      button.attrib-btn.open {
        opacity: 1;
        border-color: #0284c7;
        color: var(--text-strong);
      }

      /* Loading & Error Banners */
      .status-banner {
        position: absolute;
        left: 50%;
        top: 56px;
        transform: translateX(-50%);
        z-index: 7;
        background: var(--surface-bg-hover);
        border: 1px solid #0284c7;
        border-radius: 999px;
        padding: 5px 13px;
        font-size: 11.5px;
        font-weight: 600;
        color: var(--text-strong);
        pointer-events: none;
        box-shadow: 0 4px 12px rgba(15, 23, 42, 0.2);
      }

      .status-error {
        border-color: #ef4444;
        color: #dc2626;
      }

      .card[data-theme="dark"] .status-error {
        color: #fecaca;
      }

      @media (max-width: 520px) {
        .solar-hud {
          max-width: calc(100% - 108px);
          padding: 6px 9px;
        }
        .hud-metrics {
          gap: 5px;
          font-size: 10.5px;
        }
      }

      /* Fire Hotspot & Bushfire Incident Hover / Click Popups */
      .ssr-map-popup .maplibregl-popup-content {
        background: var(--surface-bg-hover);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid var(--surface-border);
        border-radius: 10px;
        padding: 10px 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.36);
        color: var(--text-strong);
        font-family: inherit;
        pointer-events: none;
      }

      .ssr-map-popup-pinned .maplibregl-popup-content {
        pointer-events: auto;
        padding-right: 24px;
      }

      .ssr-map-popup .maplibregl-popup-close-button {
        color: var(--text-muted);
        font-size: 16px;
        padding: 4px 7px;
        line-height: 1;
      }

      .ssr-map-popup .maplibregl-popup-close-button:hover {
        color: var(--text-strong);
        background: transparent;
      }

      .ssr-map-popup.maplibregl-popup-anchor-bottom .maplibregl-popup-tip {
        border-top-color: var(--surface-bg-hover);
      }
      .ssr-map-popup.maplibregl-popup-anchor-top .maplibregl-popup-tip {
        border-bottom-color: var(--surface-bg-hover);
      }
      .ssr-map-popup.maplibregl-popup-anchor-left .maplibregl-popup-tip {
        border-right-color: var(--surface-bg-hover);
      }
      .ssr-map-popup.maplibregl-popup-anchor-right .maplibregl-popup-tip {
        border-left-color: var(--surface-bg-hover);
      }

      .ssr-fire-tooltip {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 215px;
      }

      .ssr-fire-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 8px;
      }

      .ssr-fire-title {
        font-size: 12.5px;
        font-weight: 700;
        line-height: 1.3;
        color: var(--text-strong);
      }

      .ssr-fire-badge {
        flex-shrink: 0;
        padding: 2px 6px;
        border-radius: 9999px;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.02em;
        white-space: nowrap;
      }

      .ssr-fire-badge-emergency {
        background: rgba(220, 38, 38, 0.24);
        color: #fca5a5;
        border: 1px solid rgba(239, 68, 68, 0.55);
      }
      .card[data-theme="light"] .ssr-fire-badge-emergency {
        background: rgba(220, 38, 38, 0.14);
        color: #b91c1c;
      }

      .ssr-fire-badge-watch,
      .ssr-fire-badge-bushfire {
        background: rgba(249, 115, 22, 0.22);
        color: #fdba74;
        border: 1px solid rgba(249, 115, 22, 0.48);
      }
      .card[data-theme="light"] .ssr-fire-badge-watch,
      .card[data-theme="light"] .ssr-fire-badge-bushfire {
        background: rgba(234, 88, 12, 0.14);
        color: #c2410c;
      }

      .ssr-fire-badge-burn,
      .ssr-fire-badge-advice {
        background: rgba(245, 158, 11, 0.20);
        color: #fcd34d;
        border: 1px solid rgba(245, 158, 11, 0.45);
      }
      .card[data-theme="light"] .ssr-fire-badge-burn,
      .card[data-theme="light"] .ssr-fire-badge-advice {
        background: rgba(217, 119, 6, 0.14);
        color: #92400e;
      }

      .ssr-fire-badge-hotspot {
        background: rgba(251, 146, 60, 0.18);
        color: #fed7aa;
        border: 1px solid rgba(251, 146, 60, 0.38);
      }
      .card[data-theme="light"] .ssr-fire-badge-hotspot {
        background: rgba(234, 88, 12, 0.12);
        color: #9a3412;
      }

      .ssr-fire-sub {
        font-size: 11px;
        font-weight: 600;
        color: #38bdf8;
        padding-bottom: 4px;
        border-bottom: 1px solid var(--surface-border);
      }
      .card[data-theme="light"] .ssr-fire-sub {
        color: #0284c7;
      }

      .ssr-fire-grid {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .ssr-fire-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 10px;
        font-size: 11.2px;
        line-height: 1.35;
      }

      .ssr-fire-k {
        color: var(--text-muted);
        flex-shrink: 0;
      }

      .ssr-fire-v {
        color: var(--text-strong);
        font-weight: 600;
        text-align: right;
      }

      .ssr-fire-hint {
        margin-top: 2px;
        font-size: 10px;
        color: var(--text-muted);
        text-align: right;
      }

      .ssr-fire-link {
        margin-top: 3px;
        display: inline-block;
        font-size: 11px;
        font-weight: 600;
        color: #38bdf8;
        text-decoration: none;
      }
      .card[data-theme="light"] .ssr-fire-link {
        color: #0284c7;
      }

      .ssr-fire-link:hover {
        text-decoration: underline;
      }
    `,
  ];

  static getConfigElement(): HTMLElement {
    return document.createElement("solar-sky-radar-card-editor");
  }

  static getStubConfig(): SolarSkyRadarCardConfig {
    return { ...DEFAULT_CONFIG };
  }

  connectedCallback(): void {
    super.connectedCallback();
    preloadMapLibre();
    this.hasPlayedSingleOnReveal = false;
    this.userPausedWhileVisible = false;

    // Cancel pending teardown if Lovelace reparented this card across masonry columns / sections
    if (this.disconnectTimer !== null) {
      globalThis.clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }

    if (this.mapController) {
      this.mapController.handleReconnect();
      this.ensurePollTimer();
      this.ensureVisibilityObserver();
    } else if (this.hasUpdated) {
      this.ensureRuntimeMounted();
    }
  }

  protected updated(changedProps: PropertyValues<this>): void {
    if (changedProps.has("hass")) {
      const nowDark = resolveIsDark(this.config.basemap_theme, this.hass);
      if (this.lastDarkResolved !== null && nowDark !== this.lastDarkResolved) {
        this.mapController?.updateConfig(this.config);
      }
      this.lastDarkResolved = nowDark;
    }
  }

  setConfig(config: SolarSkyRadarCardConfig): void {
    if (!config || typeof config !== "object") {
      throw new Error("Invalid configuration");
    }
    const prevLockCfg = this.config.lock_map;
    const prevMode = resolveAutoplayMode(this.config);
    this.config = sanitizeCardConfig(config);
    const nextLockCfg = this.config.lock_map ?? true;
    if (prevLockCfg !== config.lock_map || !this.mapController) {
      this.mapLocked = nextLockCfg;
      this.mapController?.setLocked(nextLockCfg, nextLockCfg);
    }
    const nextMode = resolveAutoplayMode(this.config);
    if (prevMode !== nextMode) {
      this.hasPlayedSingleOnReveal = false;
      this.userPausedWhileVisible = false;
    }

    this.speed = this.config.playback_speed ?? 1;
    this.mapController?.updateConfig(this.config);
    this.framePlayer?.setEntryId(this.config.entry_id);
    this.framePlayer?.setLayerFlags({
      trueColour: this.config.show_true_colour ?? true,
      cloudOverlay: this.config.show_cloud_overlay ?? false,
      cloudMode: this.config.cloud_mode ?? "solar_cloud",
      radar: this.config.show_radar ?? true,
    });
    this.framePlayer?.setSpeed(this.speed);

    if (nextMode === "off" && this.playing) {
      this.framePlayer?.pause();
    } else {
      this.maybeTriggerVisibilityPlayback();
    }
  }

  getCardSize(): number {
    return Math.ceil(((this.config.map_height ?? 490) + 74) / 50);
  }

  getGridOptions(): { columns: number; min_columns: number } {
    return { columns: 12, min_columns: 6 };
  }

  protected firstUpdated(): void {
    if (this.isConnected) {
      this.ensureRuntimeMounted();
    }
  }

  private ensurePollTimer(): void {
    if (this.pollTimer !== null) return;
    this.pollTimer = globalThis.setInterval(() => {
      void this.refreshAllData(false);
    }, 180_000) as unknown as number;
  }

  private ensureVisibilityObserver(): void {
    if (this.visibilityObserver || typeof IntersectionObserver === "undefined") {
      return;
    }
    // Observe card visibility so autoplay triggers when scrolling uncovers >=75% of the map
    this.visibilityObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;

        const viewportH =
          window.innerHeight || document.documentElement.clientHeight || 800;
        const requiredHeight = Math.min(
          entry.boundingClientRect.height * 0.75,
          viewportH * 0.75
        );
        const uncovered75 =
          entry.isIntersecting &&
          entry.intersectionRect.height >= Math.max(1, requiredHeight - 2);

        this.isUncovered75 = uncovered75;

        if (!entry.isIntersecting || entry.intersectionRatio < 0.1) {
          this.userPausedWhileVisible = false;
          if (this.playing) {
            this.framePlayer?.pause();
          }
          return;
        }

        if (uncovered75) {
          this.maybeTriggerVisibilityPlayback();
        }
      },
      { threshold: [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1.0] }
    );
    this.visibilityObserver.observe(this);
  }

  private ensureRuntimeMounted(): void {
    if (!this.isConnected || this.mapController) return;
    const mapEl = this.renderRoot.querySelector(".map-canvas") as HTMLElement | null;
    if (!mapEl) return;

    this.mapEngineError = null;
    this.lastDarkResolved = resolveIsDark(this.config.basemap_theme, this.hass);
    this.mapController = new MapController(
      mapEl,
      () => this.hass,
      () => {
        if (this.layersOpen) this.layersOpen = false;
        if (this.attribOpen) this.attribOpen = false;
      },
      (msg) => {
        this.mapEngineError = msg;
      }
    );
    this.mapController.init(this.config);
    this.mapController.setLocked(this.mapLocked, false);

    if (this.manifest) {
      this.mapController.setManifest(this.manifest);
    }
    if (this.wind) {
      this.mapController.setWind(this.wind);
    }
    if (this.hazards) {
      this.mapController.setHazards(this.hazards);
    }

    this.framePlayer = new FramePlayer(
      () => this.hass,
      (frame: ResolvedFrameUrls) => {
        this.currentIndex = frame.index;
        this.mapController?.applyFrame(frame);
      },
      (ready: boolean[]) => {
        this.readySlots = ready;
      },
      (isPlaying: boolean) => {
        this.playing = isPlaying;
      }
    );
    this.framePlayer.setEntryId(this.config.entry_id);
    this.framePlayer.setLayerFlags({
      trueColour: this.config.show_true_colour ?? true,
      cloudOverlay: this.config.show_cloud_overlay ?? false,
      cloudMode: this.config.cloud_mode ?? "solar_cloud",
      radar: this.config.show_radar ?? true,
    });
    this.framePlayer.setSpeed(this.speed);

    void this.refreshAllData(this.manifest === null);
    this.ensurePollTimer();
    this.ensureVisibilityObserver();
  }

  private teardownRuntime(): void {
    if (this.pollTimer !== null) {
      globalThis.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.visibilityObserver?.disconnect();
    this.visibilityObserver = null;
    this.framePlayer?.destroy();
    this.framePlayer = null;
    this.mapController?.destroy();
    this.mapController = null;
    this.playing = false;
  }

  private maybeTriggerVisibilityPlayback(): void {
    if (!this.isUncovered75 || this.loading || this.timeline.length <= 1) {
      return;
    }
    const mode = resolveAutoplayMode(this.config);
    if (mode === "once") {
      if (!this.hasPlayedSingleOnReveal && !this.playing) {
        this.hasPlayedSingleOnReveal = true;
        this.framePlayer?.play(true);
      }
    } else if (mode === "loop") {
      if (!this.playing && !this.userPausedWhileVisible) {
        this.framePlayer?.play(false);
      }
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.pollTimer !== null) {
      globalThis.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.visibilityObserver?.disconnect();
    this.visibilityObserver = null;

    // Defer full WebGL & Blob URL teardown briefly so Lovelace column/section reparenting
    // (e.g. hui-masonry-view rebuilding columns on iOS WebKit viewport settle) preserves the live map.
    if (this.disconnectTimer !== null) {
      globalThis.clearTimeout(this.disconnectTimer);
    }
    this.disconnectTimer = globalThis.setTimeout(() => {
      this.disconnectTimer = null;
      if (!this.isConnected) {
        this.teardownRuntime();
      }
    }, 120) as unknown as number;
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
    } catch (err) {
      this.errorMessage =
        err instanceof Error ? err.message : "Failed to load Solar Sky Radar feed";
    } finally {
      this.loading = false;
      if (initial) {
        this.maybeTriggerVisibilityPlayback();
      }
    }
  }

  private toggleFlag(key: keyof SolarSkyRadarCardConfig, currentDefault = true): void {
    const cur = Boolean(this.config[key] ?? currentDefault);
    this.setConfig({ ...this.config, [key]: !cur });
  }

  private cycleCloudMode(): void {
    const next: CloudRenderMode =
      (this.config.cloud_mode ?? "solar_cloud") === "cloud_mask"
        ? "solar_cloud"
        : "cloud_mask";
    this.setConfig({ ...this.config, show_cloud_overlay: true, cloud_mode: next });
  }

  private cycleWindLevel(): void {
    const next: WindAltitudeMode =
      (this.config.wind_level ?? "850hPa") === "850hPa" ? "10m" : "850hPa";
    this.setConfig({ ...this.config, show_wind: true, wind_level: next });
  }

  private toggleMapLock = (): void => {
    const nextLocked = !this.mapLocked;
    this.mapLocked = nextLocked;
    this.mapController?.setLocked(nextLocked, true);
  };

  private activeLayerCount(): number {
    const flags = [
      this.config.show_true_colour ?? true,
      this.config.show_cloud_overlay ?? false,
      this.config.show_radar ?? true,
      this.config.show_wind ?? true,
      this.config.show_lightning ?? true,
      this.config.show_fires ?? true,
      this.config.show_solar_rings ?? true,
    ];
    return flags.filter(Boolean).length;
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
          <span class="hud-chevron">${this.hudExpanded ? "▴" : "▾"}</span>
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
            ? html`<span class="hud-metric hud-eta">
                Drop ETA <strong>~${solar.approaching_cloud_eta_min}m</strong>
              </span>`
            : nothing}
        </div>

        ${this.hudExpanded
          ? html`
              <div class="hud-expanded">
                <div>${solar.summary}</div>
                <div class="hud-submeta">
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
      (this.config.show_cloud_overlay ?? false) &&
      (this.config.cloud_mode ?? "solar_cloud") === "solar_cloud";
    const fireCount = this.hazards?.fires?.features?.length ?? 0;
    const ltgCount = this.hazards?.lightning?.meta?.count_2h ?? 0;
    const hasRadar = this.config.show_radar ?? true;

    if (!hasRadar && !isSolarMode && fireCount === 0 && ltgCount === 0) {
      return nothing;
    }

    return html`
      <div class="legend-strip">
        ${hasRadar
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
                <span class="swatch" style="background:#38d9ff;"></span>Cirrus
              </span>
              <span class="legend-item">
                <span class="swatch" style="background:#ffb418;"></span>Patchy
              </span>
              <span class="legend-item">
                <span class="swatch" style="background:#f96620;"></span>Thick
              </span>
              <span class="legend-item">
                <span class="swatch" style="background:#c444ff;"></span>Storm
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

  private renderAttribution() {
    const bm = this.config.basemap_theme ?? "auto";
    const isBom = bm === "bom_dark" || bm === "bom_light";

    return html`
      <div class="attrib-box">
        ${this.attribOpen
          ? html`
              <span class="attrib-links">
                ${isBom
                  ? html`© Australian Bureau of Meteorology`
                  : html`<a
                        href="https://openfreemap.org"
                        target="_blank"
                        rel="noopener noreferrer"
                        >OpenFreeMap</a
                      >
                      · ©
                      <a
                        href="https://openmaptiles.org"
                        target="_blank"
                        rel="noopener noreferrer"
                        >OpenMapTiles</a
                      >
                      · ©
                      <a
                        href="https://www.openstreetmap.org/copyright"
                        target="_blank"
                        rel="noopener noreferrer"
                        >OpenStreetMap</a
                      >`}
              </span>
            `
          : nothing}
        <button
          class="attrib-btn ${this.attribOpen ? "open" : ""}"
          type="button"
          title="Map & satellite data attribution"
          aria-label="Map attribution"
          @click=${() => {
            this.attribOpen = !this.attribOpen;
          }}
        >
          i
        </button>
      </div>
    `;
  }

  render() {
    const height = this.config.map_height ?? 490;
    const cloudMode = this.config.cloud_mode ?? "solar_cloud";
    const cloudModeLabel =
      cloudMode === "solar_cloud" ? "Mode: Solar Impact" : "Mode: Clean Mask";
    const windLevel = this.config.wind_level ?? "850hPa";
    const isDark = resolveIsDark(this.config.basemap_theme, this.hass);
    const activeCount = this.activeLayerCount();

    return html`
      <div class="card" data-theme=${isDark ? "dark" : "light"}>
        <div
          class="viewport"
          data-locked=${this.mapLocked ? "true" : "false"}
          style="height: ${height}px;"
        >
          <div class="map-canvas"></div>

          ${this.renderSolarHud()}

          <div class="layer-dock">
            <button
              class="layers-pill ${this.layersOpen ? "open" : ""}"
              type="button"
              title="Show or hide map overlay controls"
              @click=${() => {
                this.layersOpen = !this.layersOpen;
              }}
            >
              <span>Layers</span>
              <span class="layers-count">${activeCount}</span>
            </button>

            ${this.layersOpen
              ? html`
                  <div class="layers-popover">
                    <div class="popover-section-label">Active Overlays</div>
                    <div class="chip-group">
                      <button
                        class="chip ${(this.config.show_true_colour ?? true) ? "active" : ""}"
                        title="Toggle Himawari-9 / GeoColor Visible True Colour"
                        @click=${() => this.toggleFlag("show_true_colour", true)}
                      >
                        True Colour
                      </button>
                      <button
                        class="chip ${(this.config.show_cloud_overlay ?? false) ? "active" : ""}"
                        title="Toggle Visual / Solar Cloud Overlay"
                        @click=${() => this.toggleFlag("show_cloud_overlay", false)}
                      >
                        Clouds
                      </button>
                      ${this.config.show_cloud_overlay ?? false
                        ? html`
                            <button
                              class="chip sub-mode"
                              title="Switch between Solar Cloud Classification and Clean Cloud Mask"
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
                        title="Toggle Curved Wind Streamlines"
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
                        title="Toggle 15m (blue) / 30m (amber) / 60m (red) Upwind Cloud Arrival Arcs"
                        @click=${() => this.toggleFlag("show_solar_rings", true)}
                      >
                        ETA Rings
                      </button>
                    </div>

                    <div class="mixer-group">
                      <div class="popover-section-label">Layer Opacity</div>
                      <div class="mixer-row">
                        <span
                          >True Colour
                          (${Math.round((this.config.true_colour_opacity ?? 1.0) * 100)}%)</span
                        >
                        <input
                          type="range"
                          min="0.1"
                          max="1"
                          step="0.05"
                          .value=${String(this.config.true_colour_opacity ?? 1.0)}
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
                          (${Math.round((this.config.cloud_opacity ?? 0.58) * 100)}%)</span
                        >
                        <input
                          type="range"
                          min="0.1"
                          max="1"
                          step="0.05"
                          .value=${String(this.config.cloud_opacity ?? 0.58)}
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
                  </div>
                `
              : nothing}
          </div>

          ${this.renderLegend()}

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
              class="nav-btn lock-btn ${this.mapLocked ? "locked" : "unlocked"}"
              type="button"
              aria-pressed=${!this.mapLocked}
              title=${this.mapLocked
                ? "Map locked to centre (tap to unlock panning)"
                : "Panning unlocked (tap to recenter & lock)"}
              @click=${this.toggleMapLock}
            >
              ${this.mapLocked
                ? html`<svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="5" y="11" width="14" height="10" rx="2.5"></rect>
                    <path d="M8 11V7a4 4 0 0 1 8 0v4"></path>
                    <circle cx="12" cy="16" r="1.2" fill="currentColor"></circle>
                  </svg>`
                : html`<svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="7"></circle>
                    <circle cx="12" cy="12" r="2" fill="currentColor"></circle>
                    <line x1="12" y1="2" x2="12" y2="5"></line>
                    <line x1="12" y1="19" x2="12" y2="22"></line>
                    <line x1="2" y1="12" x2="5" y2="12"></line>
                    <line x1="19" y1="12" x2="22" y2="12"></line>
                  </svg>`}
            </button>
          </div>

          ${this.renderAttribution()}

          ${this.loading
            ? html`<div class="status-banner">
                Loading 2-hour Himawari / Radar frames...
              </div>`
            : nothing}
          ${this.errorMessage || this.mapEngineError
            ? html`<div class="status-banner status-error">
                ${this.errorMessage ?? this.mapEngineError}
              </div>`
            : nothing}
        </div>

        <solar-sky-jog-slider
          .timeline=${this.timeline}
          .readySlots=${this.readySlots}
          .currentIndex=${this.currentIndex}
          .playing=${this.playing}
          .speed=${this.speed}
          .dark=${isDark}
          .timeZone=${this.hass?.config?.time_zone ?? ""}
          @jog-seek=${(e: CustomEvent<{ index: number; pause: boolean }>) => {
            if (e.detail.pause) {
              this.userPausedWhileVisible = true;
            }
            this.framePlayer?.seek(e.detail.index, e.detail.pause);
            this.playing = this.framePlayer?.isPlaying ?? false;
          }}
          @jog-step=${(e: CustomEvent<{ delta: number }>) => {
            this.userPausedWhileVisible = true;
            this.framePlayer?.step(e.detail.delta);
            this.playing = false;
          }}
          @jog-toggle=${() => {
            const nextPlaying = this.framePlayer?.togglePlay() ?? false;
            this.playing = nextPlaying;
            this.userPausedWhileVisible = !nextPlaying;
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

defineCustomElementSafely("solar-sky-radar-card", SolarSkyRadarCard);
