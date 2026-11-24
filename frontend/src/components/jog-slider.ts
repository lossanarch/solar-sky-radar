import { LitElement, css, html } from "lit";
import { property } from "lit/decorators.js";
import type { TimelineSlot } from "../types";
import { defineCustomElementSafely } from "../utils/register-custom-element";

const SPEEDS = [0.5, 1, 1.5, 2];

export class SolarSkyJogSlider extends LitElement {
  @property({ type: Array }) timeline: TimelineSlot[] = [];
  @property({ type: Array }) readySlots: boolean[] = [];
  @property({ type: Number }) currentIndex = 0;
  @property({ type: Boolean }) playing = false;
  @property({ type: Number }) speed = 1;
  @property({ type: String }) timeZone = "";
  @property({ type: Boolean }) dark = true;

  private dragging = false;

  static styles = css`
    :host {
      display: block;
      user-select: none;
      -webkit-user-select: none;
    }

    .bar {
      --bar-bg: rgba(15, 23, 42, 0.92);
      --bar-border: rgba(148, 163, 184, 0.2);
      --bar-text: #f8fafc;
      --bar-muted: #94a3b8;
      --ctrl-bg: rgba(30, 41, 59, 0.88);
      --ctrl-hover: rgba(51, 65, 85, 0.95);
      --ctrl-border: rgba(148, 163, 184, 0.28);
      --ctrl-text: #f1f5f9;
      --track-bg: rgba(30, 41, 59, 0.95);
      --tick-empty: rgba(100, 116, 139, 0.35);
      --tick-ready: rgba(148, 163, 184, 0.58);
      --now-bg: rgba(16, 185, 129, 0.2);
      --now-text: #6ee7b7;
      --now-border: rgba(16, 185, 129, 0.45);
      --past-bg: rgba(245, 158, 11, 0.2);
      --past-text: #fcd34d;
      --past-border: rgba(245, 158, 11, 0.45);

      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px 12px 10px;
      background: var(--bar-bg);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-top: 1px solid var(--bar-border);
      color: var(--bar-text);
      font-family: var(--paper-font-body1_-_font-family, system-ui, -apple-system, sans-serif);
    }

    .bar[data-theme="light"] {
      --bar-bg: rgba(248, 250, 252, 0.96);
      --bar-border: rgba(15, 23, 42, 0.12);
      --bar-text: #0f172a;
      --bar-muted: #64748b;
      --ctrl-bg: #ffffff;
      --ctrl-hover: #f1f5f9;
      --ctrl-border: rgba(15, 23, 42, 0.18);
      --ctrl-text: #0f172a;
      --track-bg: rgba(226, 232, 240, 0.95);
      --tick-empty: rgba(148, 163, 184, 0.4);
      --tick-ready: rgba(100, 116, 139, 0.55);
      --now-bg: rgba(16, 185, 129, 0.15);
      --now-text: #047857;
      --now-border: rgba(16, 185, 129, 0.4);
      --past-bg: rgba(245, 158, 11, 0.16);
      --past-text: #b45309;
      --past-border: rgba(245, 158, 11, 0.42);
    }

    .top-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .transport {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    button.ctrl {
      appearance: none;
      border: 1px solid var(--ctrl-border);
      background: var(--ctrl-bg);
      color: var(--ctrl-text);
      border-radius: 8px;
      height: 30px;
      min-width: 30px;
      padding: 0 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      transition: background 0.14s ease, border-color 0.14s ease, transform 0.08s ease;
    }

    button.ctrl:hover {
      background: var(--ctrl-hover);
      border-color: rgba(2, 132, 199, 0.65);
    }

    button.ctrl:active {
      transform: scale(0.96);
    }

    button.play-btn {
      background: #0284c7;
      border-color: #0284c7;
      color: #ffffff;
      min-width: 36px;
    }

    button.play-btn:hover {
      background: #0369a1;
      border-color: #0369a1;
    }

    .time-readout {
      display: flex;
      align-items: center;
      gap: 8px;
      font-variant-numeric: tabular-nums;
      font-size: 12.5px;
      font-weight: 600;
      color: var(--bar-text);
    }

    .offset-badge {
      padding: 2px 7px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }

    .offset-now {
      background: var(--now-bg);
      color: var(--now-text);
      border: 1px solid var(--now-border);
    }

    .offset-past {
      background: var(--past-bg);
      color: var(--past-text);
      border: 1px solid var(--past-border);
    }

    .scrubber-wrap {
      position: relative;
      height: 24px;
      display: flex;
      align-items: center;
      cursor: ew-resize;
      touch-action: none;
    }

    .ticks {
      width: 100%;
      height: 7px;
      border-radius: 999px;
      background: var(--track-bg);
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: 1fr;
      gap: 2px;
      padding: 1px;
      overflow: hidden;
      border: 1px solid var(--bar-border);
    }

    .tick {
      height: 100%;
      border-radius: 3px;
      background: var(--tick-empty);
      transition: background 0.12s ease;
    }

    .tick.ready {
      background: var(--tick-ready);
    }

    .tick.past-active {
      background: rgba(2, 132, 199, 0.72);
    }

    .tick.current {
      background: #0ea5e9;
    }

    .thumb {
      position: absolute;
      top: 50%;
      width: 15px;
      height: 15px;
      border-radius: 50%;
      background: #ffffff;
      border: 2.5px solid #0284c7;
      box-shadow: 0 1px 6px rgba(15, 23, 42, 0.45);
      transform: translate(-50%, -50%);
      pointer-events: none;
    }

    .scale-labels {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: var(--bar-muted);
      font-variant-numeric: tabular-nums;
      margin-top: -2px;
    }
  `;

  private formatSlotTime(slot: TimelineSlot | undefined): string {
    if (!slot) return "--:--";
    const dt = new Date(slot.epoch * 1000);
    try {
      return new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
        timeZone: this.timeZone || undefined,
        timeZoneName: "short",
      }).format(dt);
    } catch {
      return new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }).format(dt);
    }
  }

  private formatRelative(offsetMin: number): string {
    if (offsetMin >= -2) return "LIVE";
    const abs = Math.abs(offsetMin);
    if (abs < 60) return `-${abs}m`;
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return m === 0 ? `-${h}h` : `-${h}h ${m}m`;
  }

  private scrubFromPointer(e: PointerEvent, isInitialDown: boolean): void {
    const track = e.currentTarget as HTMLElement;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0 || this.timeline.length === 0) return;
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const idx = Math.round(ratio * (this.timeline.length - 1));
    this.dispatchEvent(
      new CustomEvent("jog-seek", {
        detail: { index: idx, pause: isInitialDown },
        bubbles: true,
        composed: true,
      })
    );
  }

  private onPointerDown = (e: PointerEvent): void => {
    e.stopPropagation();
    this.dragging = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.scrubFromPointer(e, true);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.dragging) return;
    e.stopPropagation();
    this.scrubFromPointer(e, false);
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.dragging) return;
    this.dragging = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if capture already released
    }
  };

  private cycleSpeed(): void {
    const nextIdx = (SPEEDS.indexOf(this.speed) + 1) % SPEEDS.length;
    const nextSpeed = SPEEDS[nextIdx] ?? 1;
    this.dispatchEvent(
      new CustomEvent("jog-speed", {
        detail: { speed: nextSpeed },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    const count = this.timeline.length;
    const activeSlot = this.timeline[this.currentIndex];
    const pct = count > 1 ? (this.currentIndex / (count - 1)) * 100 : 100;
    const isNow = this.currentIndex >= count - 1;
    const oldestSlot = this.timeline[0];

    return html`
      <div class="bar" data-theme=${this.dark ? "dark" : "light"}>
        <div class="top-row">
          <div class="transport">
            <button
              class="ctrl"
              title="Previous frame"
              aria-label="Previous frame"
              @click=${() =>
                this.dispatchEvent(
                  new CustomEvent("jog-step", {
                    detail: { delta: -1 },
                    bubbles: true,
                    composed: true,
                  })
                )}
            >
              &#9664;
            </button>
            <button
              class="ctrl play-btn"
              title=${this.playing ? "Pause 2-hour loop" : "Play 2-hour loop"}
              aria-label=${this.playing ? "Pause" : "Play"}
              @click=${() =>
                this.dispatchEvent(
                  new CustomEvent("jog-toggle", { bubbles: true, composed: true })
                )}
            >
              ${this.playing ? "\u275A\u275A" : "\u25B6"}
            </button>
            <button
              class="ctrl"
              title="Next frame"
              aria-label="Next frame"
              @click=${() =>
                this.dispatchEvent(
                  new CustomEvent("jog-step", {
                    detail: { delta: 1 },
                    bubbles: true,
                    composed: true,
                  })
                )}
            >
              &#9654;
            </button>
            <button
              class="ctrl"
              title="Playback speed"
              @click=${this.cycleSpeed}
            >
              ${this.speed}x
            </button>
          </div>

          <div class="time-readout">
            <span>${this.formatSlotTime(activeSlot)}</span>
            <span class="offset-badge ${isNow ? "offset-now" : "offset-past"}">
              ${activeSlot ? this.formatRelative(activeSlot.offset_minutes) : "..."}
            </span>
          </div>
        </div>

        <div
          class="scrubber-wrap"
          role="slider"
          tabindex="0"
          aria-valuemin="0"
          aria-valuemax=${Math.max(0, count - 1)}
          aria-valuenow=${this.currentIndex}
          aria-label="Jog 2-hour radar and cloud history"
          @pointerdown=${this.onPointerDown}
          @pointermove=${this.onPointerMove}
          @pointerup=${this.onPointerUp}
          @pointercancel=${this.onPointerUp}
          @keydown=${(e: KeyboardEvent) => {
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              this.dispatchEvent(
                new CustomEvent("jog-step", { detail: { delta: -1 }, bubbles: true, composed: true })
              );
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              this.dispatchEvent(
                new CustomEvent("jog-step", { detail: { delta: 1 }, bubbles: true, composed: true })
              );
            }
          }}
        >
          <div class="ticks">
            ${this.timeline.map((_, idx) => {
              const cls =
                idx === this.currentIndex
                  ? "tick current"
                  : idx < this.currentIndex
                    ? "tick past-active"
                    : this.readySlots[idx]
                      ? "tick ready"
                      : "tick";
              return html`<div class=${cls}></div>`;
            })}
          </div>
          <div class="thumb" style="left: ${pct}%;"></div>
        </div>

        <div class="scale-labels">
          <span>${oldestSlot ? this.formatRelative(oldestSlot.offset_minutes) : "-2h"}</span>
          <span>-1h</span>
          <span>Now</span>
        </div>
      </div>
    `;
  }
}

defineCustomElementSafely("solar-sky-jog-slider", SolarSkyJogSlider);
