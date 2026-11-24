/**
 * Resolve Vite's emitted worker URL relative to the MapLibre chunk's `import.meta.url`
 * so the worker `.js` always loads from the exact same directory (`/solar_sky_radar/www/`,
 * `/hacsfiles/solar-sky-radar/`, or reverse-proxy subpaths) with a standard `.js` MIME type.
 */
export function resolveBundledWorkerUrl(
  workerUrl: string,
  moduleMetaUrl: string
): string {
  if (!workerUrl) return "";
  if (
    workerUrl.startsWith("http://") ||
    workerUrl.startsWith("https://") ||
    workerUrl.startsWith("blob:") ||
    workerUrl.startsWith("data:")
  ) {
    return workerUrl;
  }
  const cleanFile = workerUrl
    .replace(/^(?:\.\/|\/)+/, "")
    .replace(/^assets\//, "");
  try {
    return new URL(`./${cleanFile}`, moduleMetaUrl).href;
  } catch {
    return workerUrl;
  }
}
