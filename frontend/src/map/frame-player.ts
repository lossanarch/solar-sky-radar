import type {
  CloudRenderMode,
  HomeAssistantLike,
  ManifestPayload,
  TimelineSlot,
} from "../types";

export interface ResolvedFrameUrls {
  slot: TimelineSlot;
  index: number;
  trueColourBlobUrl: string | null;
  cloudOverlayBlobUrl: string | null;
  radarBlobUrl: string | null;
}

/**
 * Preloads 2 hours of satellite, cloud, and radar WebP frames into local Blob URLs
 * via Home Assistant's authenticated fetch so scrubbing runs at 60fps and MapLibre
 * workers never hit 401 errors on `/api/solar_sky_radar/frame/...`.
 */
export class FramePlayer {
  private blobCache = new Map<string, string>();
  private inFlight = new Map<string, Promise<string | null>>();
  private timeline: TimelineSlot[] = [];
  private satUrlMap = new Map<
    string,
    { true_colour: string; cloud_mask: string; solar_cloud: string }
  >();
  private radarUrlMap = new Map<string, string>();

  private currentIndex = 0;
  private playing = false;
  private singleLoop = false;
  private speed = 1.0;
  private timerId: number | null = null;
  private destroyed = false;
  private entryId?: string;

  private activeFlags = {
    trueColour: true,
    cloudOverlay: true,
    cloudMode: "solar_cloud" as CloudRenderMode,
    radar: true,
  };

  constructor(
    private getHass: () => HomeAssistantLike | undefined,
    private onFrameChange: (resolved: ResolvedFrameUrls) => void,
    private onLoadProgress: (readySlots: boolean[]) => void,
    private onPlayStateChange?: (playing: boolean) => void
  ) {}

  get length(): number {
    return this.timeline.length;
  }

  get index(): number {
    return this.currentIndex;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  get playbackSpeed(): number {
    return this.speed;
  }

  setEntryId(entryId?: string): void {
    this.entryId = entryId;
  }

  private withEntryParam(url: string): string {
    if (!this.entryId || !url.startsWith("/api/") || url.includes("entry_id=")) {
      return url;
    }
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}entry_id=${encodeURIComponent(this.entryId)}`;
  }

  setLayerFlags(flags: {
    trueColour: boolean;
    cloudOverlay: boolean;
    cloudMode: CloudRenderMode;
    radar: boolean;
  }): void {
    const changed =
      this.activeFlags.trueColour !== flags.trueColour ||
      this.activeFlags.cloudOverlay !== flags.cloudOverlay ||
      this.activeFlags.cloudMode !== flags.cloudMode ||
      this.activeFlags.radar !== flags.radar;
    this.activeFlags = { ...flags };
    if (changed && this.timeline.length > 0) {
      const targetIdx = this.currentIndex;
      // Preload the currently displayed slot FIRST so mode switches (e.g. Solar Mode) appear immediately
      void this.preloadSlot(targetIdx).then(() => {
        if (!this.destroyed && this.currentIndex === targetIdx) {
          this.emitCurrent();
        }
        void this.preloadAllActive();
      });
      this.emitCurrent();
    }
  }

  async loadManifest(manifest: ManifestPayload, preserveRelativePosition = true): Promise<void> {
    const wasAtEnd =
      this.timeline.length === 0 || this.currentIndex >= this.timeline.length - 1;
    const prevEpoch = this.timeline[this.currentIndex]?.epoch ?? null;

    this.satUrlMap.clear();
    for (const sf of manifest.providers.satellite.frames) {
      this.satUrlMap.set(sf.key, {
        true_colour: this.withEntryParam(sf.true_colour_url),
        cloud_mask: this.withEntryParam(sf.cloud_mask_url),
        solar_cloud: this.withEntryParam(sf.solar_cloud_url),
      });
    }

    this.radarUrlMap.clear();
    for (const rf of manifest.providers.radar.frames) {
      this.radarUrlMap.set(rf.key, this.withEntryParam(rf.url));
    }

    this.timeline = manifest.timeline ?? [];
    this.pruneEvictedBlobs();

    if (this.timeline.length === 0) {
      this.currentIndex = 0;
      this.onLoadProgress([]);
      return;
    }

    if (wasAtEnd || !preserveRelativePosition || prevEpoch === null) {
      this.currentIndex = this.timeline.length - 1;
    } else {
      let bestIdx = this.timeline.length - 1;
      let bestDiff = Infinity;
      this.timeline.forEach((slot, idx) => {
        const d = Math.abs(slot.epoch - prevEpoch);
        if (d < bestDiff) {
          bestDiff = d;
          bestIdx = idx;
        }
      });
      this.currentIndex = bestIdx;
    }

    // Load newest/current frame first so map renders immediately with decoded blob URLs
    await this.preloadSlot(this.currentIndex);
    this.emitCurrent();
    void this.preloadAllActive();
  }

  private getNeededUrlsForSlot(slot: TimelineSlot): string[] {
    const urls: string[] = [];
    if (slot.satellite_key) {
      const sat = this.satUrlMap.get(slot.satellite_key);
      if (sat) {
        if (this.activeFlags.trueColour) urls.push(sat.true_colour);
        if (this.activeFlags.cloudOverlay) {
          urls.push(
            this.activeFlags.cloudMode === "solar_cloud" ? sat.solar_cloud : sat.cloud_mask
          );
        }
      }
    }
    if (this.activeFlags.radar && slot.radar_key) {
      const rUrl = this.radarUrlMap.get(slot.radar_key);
      if (rUrl) urls.push(rUrl);
    }
    return urls;
  }

  isSlotReady(idx: number): boolean {
    const slot = this.timeline[idx];
    if (!slot) return false;
    const urls = this.getNeededUrlsForSlot(slot);
    return urls.every((u) => this.blobCache.has(u));
  }

  getReadyArray(): boolean[] {
    return this.timeline.map((_, idx) => this.isSlotReady(idx));
  }

  private async fetchAsBlobUrl(url: string): Promise<string | null> {
    const cached = this.blobCache.get(url);
    if (cached) return cached;

    const existing = this.inFlight.get(url);
    if (existing) return existing;

    const promise = (async () => {
      try {
        const hass = this.getHass();
        const resp =
          hass?.fetchWithAuth && url.startsWith("/api/")
            ? await hass.fetchWithAuth(url)
            : await fetch(url, { credentials: "same-origin" });
        if (!resp.ok) return null;
        const blob = await resp.blob();
        if (this.destroyed) return null;
        const objUrl = URL.createObjectURL(blob);
        this.blobCache.set(url, objUrl);
        return objUrl;
      } catch {
        return null;
      } finally {
        this.inFlight.delete(url);
      }
    })();

    this.inFlight.set(url, promise);
    return promise;
  }

  private async preloadSlot(idx: number): Promise<void> {
    const slot = this.timeline[idx];
    if (!slot) return;
    const urls = this.getNeededUrlsForSlot(slot);
    await Promise.all(urls.map((u) => this.fetchAsBlobUrl(u)));
    if (!this.destroyed) {
      this.onLoadProgress(this.getReadyArray());
    }
  }

  async preloadAllActive(): Promise<void> {
    // Prioritize newest -> oldest so recent frames become scrubbable first
    const indices = this.timeline.map((_, i) => i).reverse();
    const batchSize = 4;
    for (let i = 0; i < indices.length; i += batchSize) {
      if (this.destroyed) return;
      const chunk = indices.slice(i, i + batchSize);
      await Promise.all(chunk.map((idx) => this.preloadSlot(idx)));
    }
  }

  seek(index: number, pausePlayback = false): void {
    if (this.timeline.length === 0) return;
    if (pausePlayback && this.playing) {
      this.pause();
    }
    const clamped = Math.max(0, Math.min(this.timeline.length - 1, index));
    if (clamped === this.currentIndex && !pausePlayback) {
      this.emitCurrent();
      return;
    }
    this.currentIndex = clamped;
    if (!this.isSlotReady(clamped)) {
      void this.preloadSlot(clamped).then(() => {
        if (!this.destroyed && this.currentIndex === clamped) {
          this.emitCurrent();
        }
      });
    }
    this.emitCurrent();
  }

  step(delta: number): void {
    if (this.timeline.length === 0) return;
    this.pause();
    const next = (this.currentIndex + delta + this.timeline.length) % this.timeline.length;
    this.seek(next, false);
  }

  play(once = false): void {
    if (this.timeline.length <= 1) return;
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.singleLoop = once;
    if (once || this.currentIndex >= this.timeline.length - 1) {
      this.currentIndex = 0;
      if (!this.isSlotReady(0)) {
        void this.preloadSlot(0).then(() => {
          if (!this.destroyed && this.currentIndex === 0) {
            this.emitCurrent();
          }
        });
      }
      this.emitCurrent();
    }
    this.playing = true;
    this.onPlayStateChange?.(true);
    this.scheduleNextTick();
  }

  pause(): void {
    const wasPlaying = this.playing;
    this.playing = false;
    this.singleLoop = false;
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (wasPlaying) {
      this.onPlayStateChange?.(false);
    }
  }

  togglePlay(): boolean {
    if (this.playing) {
      this.pause();
    } else {
      this.play(false);
    }
    return this.playing;
  }

  setSpeed(multiplier: number): void {
    this.speed = Math.max(0.25, Math.min(4.0, multiplier));
    if (this.playing) {
      if (this.timerId !== null) window.clearTimeout(this.timerId);
      this.scheduleNextTick();
    }
  }

  private scheduleNextTick(): void {
    if (!this.playing || this.destroyed || this.timeline.length <= 1) return;
    const isAtLatest = this.currentIndex >= this.timeline.length - 1;
    if (this.singleLoop && isAtLatest) {
      this.pause();
      return;
    }

    // Preload the upcoming frame ahead of the tick so playback never stalls on network
    const upcomingIdx = (this.currentIndex + 1) % this.timeline.length;
    if (!this.isSlotReady(upcomingIdx)) {
      void this.preloadSlot(upcomingIdx);
    }

    // Dwell longer on the latest ("Now") frame before looping back 2 hours
    const delayMs = isAtLatest ? Math.round(1350 / this.speed) : Math.round(420 / this.speed);

    this.timerId = window.setTimeout(() => {
      if (!this.playing || this.destroyed) return;
      const nextIdx = (this.currentIndex + 1) % this.timeline.length;
      this.currentIndex = nextIdx;
      if (!this.isSlotReady(nextIdx)) {
        void this.preloadSlot(nextIdx).then(() => {
          if (!this.destroyed && this.currentIndex === nextIdx) {
            this.emitCurrent();
          }
        });
      }
      this.emitCurrent();
      if (this.singleLoop && nextIdx >= this.timeline.length - 1) {
        this.pause();
        return;
      }
      this.scheduleNextTick();
    }, delayMs);
  }

  private resolveSafeUrl(url: string): string | null {
    const cached = this.blobCache.get(url);
    if (cached) return cached;
    // Never pass raw authenticated `/api/` paths to MapLibre's Web Worker (avoids 401);
    // `preloadSlot` fetches them via `hass.fetchWithAuth` on the main thread and re-emits.
    if (url.startsWith("/api/") && this.getHass()?.fetchWithAuth) {
      return null;
    }
    return url;
  }

  emitCurrent(): void {
    const slot = this.timeline[this.currentIndex];
    if (!slot) return;

    let trueColourBlobUrl: string | null = null;
    let cloudOverlayBlobUrl: string | null = null;
    let radarBlobUrl: string | null = null;

    if (slot.satellite_key) {
      const sat = this.satUrlMap.get(slot.satellite_key);
      if (sat) {
        trueColourBlobUrl = this.resolveSafeUrl(sat.true_colour);
        const cUrl =
          this.activeFlags.cloudMode === "solar_cloud" ? sat.solar_cloud : sat.cloud_mask;
        cloudOverlayBlobUrl = this.resolveSafeUrl(cUrl);
      }
    }

    if (slot.radar_key) {
      const rUrl = this.radarUrlMap.get(slot.radar_key);
      if (rUrl) {
        radarBlobUrl = this.resolveSafeUrl(rUrl);
      }
    }

    this.onFrameChange({
      slot,
      index: this.currentIndex,
      trueColourBlobUrl,
      cloudOverlayBlobUrl,
      radarBlobUrl,
    });
  }

  private pruneEvictedBlobs(): void {
    const validUrls = new Set<string>();
    for (const v of this.satUrlMap.values()) {
      validUrls.add(v.true_colour);
      validUrls.add(v.cloud_mask);
      validUrls.add(v.solar_cloud);
    }
    for (const u of this.radarUrlMap.values()) {
      validUrls.add(u);
    }
    for (const [url, blobUrl] of this.blobCache.entries()) {
      if (!validUrls.has(url)) {
        URL.revokeObjectURL(blobUrl);
        this.blobCache.delete(url);
      }
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.pause();
    for (const blobUrl of this.blobCache.values()) {
      URL.revokeObjectURL(blobUrl);
    }
    this.blobCache.clear();
  }
}
