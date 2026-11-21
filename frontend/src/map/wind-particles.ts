import type { Map as MapLibreMap } from "maplibre-gl";
import type { WindAltitudeMode, WindPayload } from "../types";

interface Streamline {
  lon: number;
  lat: number;
  age: number;
  maxAge: number;
  trail: Array<[number, number]>;
  lastSpeedKmh: number;
}

const MAX_TRAIL_POINTS = 24;

/**
 * Renders smooth, curved meteorological wind streamlines (never short blue rain-like streaks)
 * over the MapLibre viewport, supporting 850 hPa cloud-steering and 10 m surface wind fields.
 */
export class WindStreamlineRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private map: MapLibreMap | null = null;
  private windData: WindPayload | null = null;
  private level: WindAltitudeMode = "850hPa";
  private visible = true;
  private opacity = 0.85;
  private darkTheme = true;
  private streamlines: Streamline[] = [];
  private animId: number | null = null;
  private isMoving = false;
  private destroyed = false;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement("canvas");
    this.canvas.style.position = "absolute";
    this.canvas.style.inset = "0";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.pointerEvents = "none";
    this.canvas.style.zIndex = "3";
    container.appendChild(this.canvas);
    const context = this.canvas.getContext("2d");
    if (!context) {
      throw new Error("2D canvas context unavailable");
    }
    this.ctx = context;
  }

  attachMap(map: MapLibreMap): void {
    this.map = map;
    this.resize();
    map.on("movestart", this.handleMoveStart);
    map.on("moveend", this.handleMoveEnd);
    map.on("resize", this.handleResize);
    this.seedStreamlines();
    this.updateLoopState();
  }

  private handleMoveStart = (): void => {
    this.isMoving = true;
    this.clearCanvas();
  };

  private handleMoveEnd = (): void => {
    this.isMoving = false;
    this.seedStreamlines();
  };

  private handleResize = (): void => {
    this.resize();
    this.seedStreamlines();
  };

  resize(): void {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  setWindData(data: WindPayload | null): void {
    this.windData = data;
    this.seedStreamlines();
    this.updateLoopState();
  }

  setOptions(
    visible: boolean,
    level: WindAltitudeMode,
    opacity: number,
    darkTheme = true
  ): void {
    const levelChanged = this.level !== level || this.darkTheme !== darkTheme;
    this.visible = visible;
    this.level = level;
    this.opacity = opacity;
    this.darkTheme = darkTheme;
    this.canvas.style.opacity = String(opacity);
    this.canvas.style.display = visible ? "block" : "none";
    if (levelChanged) {
      this.clearCanvas();
      this.seedStreamlines();
    }
    this.updateLoopState();
  }

  private clearCanvas(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.ctx.clearRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);
  }

  private seedStreamlines(): void {
    if (!this.map || !this.windData) return;
    const bounds = this.map.getBounds();
    const w = Math.max(bounds.getWest(), this.windData.bbox.west);
    const e = Math.min(bounds.getEast(), this.windData.bbox.east);
    const s = Math.max(bounds.getSouth(), this.windData.bbox.south);
    const n = Math.min(bounds.getNorth(), this.windData.bbox.north);
    if (w >= e || s >= n) {
      this.streamlines = [];
      return;
    }

    const rect = this.canvas.parentElement?.getBoundingClientRect();
    const area = (rect?.width ?? 500) * (rect?.height ?? 360);
    // Sparse, graceful airflow ribbons (~90-155 streamlines) instead of dense rain-like streaks
    const count = Math.max(85, Math.min(155, Math.round(area / 3200)));

    this.streamlines = Array.from({ length: count }, () =>
      this.spawnStreamline(w, s, e, n, true)
    );
  }

  private spawnStreamline(
    w: number,
    s: number,
    e: number,
    n: number,
    prewarm = false
  ): Streamline {
    let lon = w + Math.random() * (e - w);
    let lat = s + Math.random() * (n - s);
    const maxAge = 95 + Math.floor(Math.random() * 65);
    const age = prewarm ? Math.floor(Math.random() * maxAge) : 0;
    const trail: Array<[number, number]> = [[lon, lat]];
    let lastSpeedKmh = 20;

    // Pre-integrate a short curved ribbon on initial spawn so streamlines start as smooth curves
    if (prewarm && this.map && this.windData) {
      const zoom = this.map.getZoom();
      const stepScale = 0.000105 * Math.pow(2, 7 - zoom);
      const warmupSteps = Math.min(MAX_TRAIL_POINTS - 1, age);
      for (let k = 0; k < warmupSteps; k++) {
        const uv = this.sampleUV(lon, lat);
        if (!uv) break;
        const [u, v] = uv;
        const speedMs = Math.hypot(u, v);
        if (speedMs < 0.15) break;
        lastSpeedKmh = speedMs * 3.6;
        const cosLat = Math.max(0.35, Math.cos((lat * Math.PI) / 180));
        lon += (u * stepScale) / cosLat;
        lat += v * stepScale;
        trail.push([lon, lat]);
      }
    }

    return { lon, lat, age, maxAge, trail, lastSpeedKmh };
  }

  sampleUV(lon: number, lat: number): [number, number] | null {
    if (!this.windData) return null;
    return sampleWindUV(this.windData, this.level, lon, lat);
  }

  private updateLoopState(): void {
    const shouldRun = Boolean(
      this.visible && this.map && this.windData && !this.destroyed
    );
    if (shouldRun && this.animId === null) {
      this.tick();
    } else if (!shouldRun && this.animId !== null) {
      window.cancelAnimationFrame(this.animId);
      this.animId = null;
      this.clearCanvas();
    }
  }

  private resolveRibbonRgb(speedKmh: number): string {
    // Neutral pearl/charcoal airflow palette (avoids rain-radar blue!)
    if (this.darkTheme) {
      if (speedKmh >= 55) return "253, 224, 71"; // Gale gold
      return this.level === "850hPa" ? "241, 245, 249" : "167, 243, 208";
    }
    if (speedKmh >= 55) return "180, 83, 9";
    return this.level === "850hPa" ? "51, 65, 85" : "15, 118, 110";
  }

  private tick = (): void => {
    if (this.destroyed || !this.visible || !this.map || !this.windData) {
      this.animId = null;
      return;
    }

    if (!this.isMoving && this.streamlines.length > 0) {
      this.clearCanvas();

      const bounds = this.map.getBounds();
      const w = Math.max(bounds.getWest(), this.windData.bbox.west);
      const e = Math.min(bounds.getEast(), this.windData.bbox.east);
      const s = Math.max(bounds.getSouth(), this.windData.bbox.south);
      const n = Math.min(bounds.getNorth(), this.windData.bbox.north);

      const zoom = this.map.getZoom();
      // Calm atmospheric drift (~2.6x gentler than rain-like streaks)
      const degPerMeterScale = 0.000105 * Math.pow(2, 7 - zoom);

      this.ctx.lineCap = "round";
      this.ctx.lineJoin = "round";

      for (let i = 0; i < this.streamlines.length; i++) {
        const sl = this.streamlines[i];
        if (sl.age >= sl.maxAge) {
          this.streamlines[i] = this.spawnStreamline(w, s, e, n, false);
          continue;
        }

        const uv = this.sampleUV(sl.lon, sl.lat);
        if (!uv) {
          this.streamlines[i] = this.spawnStreamline(w, s, e, n, false);
          continue;
        }

        const [u, v] = uv;
        const speedMs = Math.hypot(u, v);
        if (speedMs < 0.15) {
          sl.age += 2;
          continue;
        }

        sl.lastSpeedKmh = speedMs * 3.6;
        const cosLat = Math.max(0.35, Math.cos((sl.lat * Math.PI) / 180));
        sl.lon += (u * degPerMeterScale) / cosLat;
        sl.lat += v * degPerMeterScale;
        sl.age += 1;

        sl.trail.push([sl.lon, sl.lat]);
        if (sl.trail.length > MAX_TRAIL_POINTS) {
          sl.trail.shift();
        }
        if (sl.trail.length < 3) continue;

        // Smooth life envelope (fade in over first 14 frames, fade out over final 18 frames)
        const fadeIn = Math.min(1, sl.age / 14);
        const fadeOut = Math.min(1, (sl.maxAge - sl.age) / 18);
        const lifeAlpha = fadeIn * fadeOut;
        if (lifeAlpha <= 0.03) continue;

        const pts = sl.trail.map((coord) => this.map!.project(coord));
        const rgb = this.resolveRibbonRgb(sl.lastSpeedKmh);
        const midIdx = Math.floor(pts.length * 0.45);

        // Tail half: thin, soft fade
        this.ctx.strokeStyle = `rgba(${rgb}, ${(0.22 * lifeAlpha).toFixed(3)})`;
        this.ctx.lineWidth = 0.9;
        this.ctx.beginPath();
        this.ctx.moveTo(pts[0].x, pts[0].y);
        for (let k = 1; k <= midIdx; k++) {
          this.ctx.lineTo(pts[k].x, pts[k].y);
        }
        this.ctx.stroke();

        // Fore-body: crisp curved wind ribbon
        const headAlpha = (this.darkTheme ? 0.58 : 0.62) * lifeAlpha;
        this.ctx.strokeStyle = `rgba(${rgb}, ${headAlpha.toFixed(3)})`;
        this.ctx.lineWidth = this.level === "850hPa" ? 1.45 : 1.25;
        this.ctx.beginPath();
        this.ctx.moveTo(pts[midIdx].x, pts[midIdx].y);
        for (let k = midIdx + 1; k < pts.length; k++) {
          this.ctx.lineTo(pts[k].x, pts[k].y);
        }
        this.ctx.stroke();

        // Subtle directional airflow chevron at the leading tip so direction is unmistakable
        const head = pts[pts.length - 1];
        const prev = pts[Math.max(0, pts.length - 4)];
        const dx = head.x - prev.x;
        const dy = head.y - prev.y;
        const segLen = Math.hypot(dx, dy);
        if (segLen >= 3.5) {
          const angle = Math.atan2(dy, dx);
          const wingLen = 4.2;
          const wingSpread = 0.52;
          this.ctx.beginPath();
          this.ctx.moveTo(
            head.x - wingLen * Math.cos(angle - wingSpread),
            head.y - wingLen * Math.sin(angle - wingSpread)
          );
          this.ctx.lineTo(head.x, head.y);
          this.ctx.lineTo(
            head.x - wingLen * Math.cos(angle + wingSpread),
            head.y - wingLen * Math.sin(angle + wingSpread)
          );
          this.ctx.stroke();
        }
      }
    }

    this.animId = window.requestAnimationFrame(this.tick);
  };

  destroy(): void {
    this.destroyed = true;
    if (this.animId !== null) {
      window.cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    if (this.map) {
      this.map.off("movestart", this.handleMoveStart);
      this.map.off("moveend", this.handleMoveEnd);
      this.map.off("resize", this.handleResize);
    }
    this.canvas.remove();
  }
}

export function sampleWindUV(
  wd: WindPayload,
  level: WindAltitudeMode,
  lon: number,
  lat: number
): [number, number] | null {
  const grid = wd.levels?.[level] ?? wd.levels?.["850hPa"] ?? wd.levels?.["10m"];
  if (!grid || !grid.u?.length) return null;

  const { bbox, rows, cols } = wd;
  if (lon < bbox.west || lon > bbox.east || lat < bbox.south || lat > bbox.north) {
    return null;
  }

  const fx = ((lon - bbox.west) / Math.max(1e-5, bbox.east - bbox.west)) * (cols - 1);
  const fy = ((lat - bbox.south) / Math.max(1e-5, bbox.north - bbox.south)) * (rows - 1);

  const c0 = Math.max(0, Math.min(cols - 1, Math.floor(fx)));
  const r0 = Math.max(0, Math.min(rows - 1, Math.floor(fy)));
  const c1 = Math.min(cols - 1, c0 + 1);
  const r1 = Math.min(rows - 1, r0 + 1);
  const wx = fx - c0;
  const wy = fy - r0;

  const idx = (r: number, c: number) => r * cols + c;
  const u =
    (grid.u[idx(r0, c0)] * (1 - wx) + grid.u[idx(r0, c1)] * wx) * (1 - wy) +
    (grid.u[idx(r1, c0)] * (1 - wx) + grid.u[idx(r1, c1)] * wx) * wy;
  const v =
    (grid.v[idx(r0, c0)] * (1 - wx) + grid.v[idx(r0, c1)] * wx) * (1 - wy) +
    (grid.v[idx(r1, c0)] * (1 - wx) + grid.v[idx(r1, c1)] * wx) * wy;

  return [u, v];
}
