import type { Map as MapLibreMap } from "maplibre-gl";
import type { WindAltitudeMode, WindPayload } from "../types";

interface Particle {
  lon: number;
  lat: number;
  age: number;
  maxAge: number;
}

/**
 * Renders smooth 60fps animated wind streamlines over the MapLibre viewport,
 * supporting both 10m surface wind and 850hPa cloud-steering wind fields.
 */
export class WindStreamlineRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private map: MapLibreMap | null = null;
  private windData: WindPayload | null = null;
  private level: WindAltitudeMode = "850hPa";
  private visible = true;
  private opacity = 0.85;
  private particles: Particle[] = [];
  private animId: number | null = null;
  private isMoving = false;

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
    this.seedParticles();
    this.updateLoopState();
  }

  private handleMoveStart = (): void => {
    this.isMoving = true;
    this.clearCanvas();
  };

  private handleMoveEnd = (): void => {
    this.isMoving = false;
    this.seedParticles();
  };

  private handleResize = (): void => {
    this.resize();
    this.seedParticles();
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
    this.seedParticles();
    this.updateLoopState();
  }

  setOptions(visible: boolean, level: WindAltitudeMode, opacity: number): void {
    const levelChanged = this.level !== level;
    this.visible = visible;
    this.level = level;
    this.opacity = opacity;
    this.canvas.style.opacity = String(opacity);
    this.canvas.style.display = visible ? "block" : "none";
    if (levelChanged) {
      this.clearCanvas();
      this.seedParticles();
    }
    this.updateLoopState();
  }

  private clearCanvas(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.ctx.clearRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);
  }

  private seedParticles(): void {
    if (!this.map || !this.windData) return;
    const bounds = this.map.getBounds();
    const w = Math.max(bounds.getWest(), this.windData.bbox.west);
    const e = Math.min(bounds.getEast(), this.windData.bbox.east);
    const s = Math.max(bounds.getSouth(), this.windData.bbox.south);
    const n = Math.min(bounds.getNorth(), this.windData.bbox.north);
    if (w >= e || s >= n) {
      this.particles = [];
      return;
    }

    const rect = this.canvas.parentElement?.getBoundingClientRect();
    const area = (rect?.width ?? 500) * (rect?.height ?? 360);
    const count = Math.max(220, Math.min(950, Math.round(area / 520)));

    this.particles = Array.from({ length: count }, () => this.randomParticle(w, s, e, n));
  }

  private randomParticle(w: number, s: number, e: number, n: number): Particle {
    return {
      lon: w + Math.random() * (e - w),
      lat: s + Math.random() * (n - s),
      age: Math.floor(Math.random() * 75),
      maxAge: 65 + Math.floor(Math.random() * 45),
    };
  }

  /**
   * Bilinearly sample (u, v) in m/s at (lat, lon) from the active wind level grid.
   */
  sampleUV(lon: number, lat: number): [number, number] | null {
    if (!this.windData) return null;
    return sampleWindUV(this.windData, this.level, lon, lat);
  }

  private updateLoopState(): void {
    const shouldRun = Boolean(this.visible && this.map && this.windData && !this.destroyed);
    if (shouldRun && this.animId === null) {
      this.tick();
    } else if (!shouldRun && this.animId !== null) {
      window.cancelAnimationFrame(this.animId);
      this.animId = null;
      this.clearCanvas();
    }
  }

  private destroyed = false;

  private tick = (): void => {
    if (this.destroyed || !this.visible || !this.map || !this.windData) {
      this.animId = null;
      return;
    }

    if (!this.isMoving && this.particles.length > 0) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = this.canvas.width / dpr;
      const height = this.canvas.height / dpr;

      // Fade previous trails smoothly via destination-in alpha decay
      this.ctx.save();
      this.ctx.globalCompositeOperation = "destination-in";
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.91)";
      this.ctx.fillRect(0, 0, width, height);
      this.ctx.restore();

      const bounds = this.map.getBounds();
      const w = Math.max(bounds.getWest(), this.windData.bbox.west);
      const e = Math.min(bounds.getEast(), this.windData.bbox.east);
      const s = Math.max(bounds.getSouth(), this.windData.bbox.south);
      const n = Math.min(bounds.getNorth(), this.windData.bbox.north);

      const zoom = this.map.getZoom();
      // Scale step size smoothly with zoom so screen speed looks crisp from z=4..11
      const degPerMeterScale = 0.00028 * Math.pow(2, 7 - zoom);

      this.ctx.lineWidth = this.level === "850hPa" ? 1.55 : 1.35;
      this.ctx.lineCap = "round";

      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        if (p.age >= p.maxAge) {
          this.particles[i] = this.randomParticle(w, s, e, n);
          continue;
        }
        const uv = this.sampleUV(p.lon, p.lat);
        if (!uv) {
          this.particles[i] = this.randomParticle(w, s, e, n);
          continue;
        }
        const [u, v] = uv;
        const speedMs = Math.hypot(u, v);
        if (speedMs < 0.15) {
          p.age += 2;
          continue;
        }

        const cosLat = Math.max(0.35, Math.cos((p.lat * Math.PI) / 180));
        const nextLon = p.lon + (u * degPerMeterScale) / cosLat;
        const nextLat = p.lat + v * degPerMeterScale;

        const pt0 = this.map.project([p.lon, p.lat]);
        const pt1 = this.map.project([nextLon, nextLat]);

        // Colorize slightly by speed & altitude mode
        const speedKmh = speedMs * 3.6;
        if (speedKmh >= 55) {
          this.ctx.strokeStyle = "rgba(251, 191, 36, 0.88)";
        } else if (speedKmh >= 30) {
          this.ctx.strokeStyle =
            this.level === "850hPa"
              ? "rgba(125, 211, 252, 0.86)"
              : "rgba(167, 243, 208, 0.84)";
        } else {
          this.ctx.strokeStyle = "rgba(226, 232, 240, 0.72)";
        }

        this.ctx.beginPath();
        this.ctx.moveTo(pt0.x, pt0.y);
        this.ctx.lineTo(pt1.x, pt1.y);
        this.ctx.stroke();

        p.lon = nextLon;
        p.lat = nextLat;
        p.age += 1;
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
