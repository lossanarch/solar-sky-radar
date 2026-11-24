import * as maplibregl from "maplibre-gl";
import rawWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { resolveBundledWorkerUrl } from "../utils/resolve-worker-url";

let configuredWorkerUrl = "";

export function ensureMapLibreWorkerConfigured(): string {
  const resolved = resolveBundledWorkerUrl(rawWorkerUrl, import.meta.url);
  if (resolved && resolved !== configuredWorkerUrl) {
    maplibregl.setWorkerUrl(resolved);
    configuredWorkerUrl = resolved;
  }
  return resolved;
}

ensureMapLibreWorkerConfigured();

export { maplibregl };
export type MapLibreRuntimeModule = typeof maplibregl;
