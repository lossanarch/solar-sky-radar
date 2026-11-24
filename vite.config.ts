import { readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { defineConfig, type Plugin } from "vite";

const outDir = resolve(__dirname, "custom_components/solar_sky_radar/www");

/**
 * Pre-compresses built `.js` bundles into `.js.gz` sidecars so Home Assistant's
 * `CachingStaticResource` (`aiohttp.web.FileResponse`) serves gzipped bytes zero-copy
 * over both `http://` LAN and `https://` remote iOS Companion App connections.
 */
function precompressGzipPlugin(targetDir: string): Plugin {
  return {
    name: "solar-sky-radar-precompress-gzip",
    closeBundle() {
      for (const name of readdirSync(targetDir)) {
        if (name.endsWith(".gz") || name.endsWith(".br")) {
          unlinkSync(join(targetDir, name));
        }
      }
      for (const name of readdirSync(targetDir)) {
        if (!name.endsWith(".js")) continue;
        const fullPath = join(targetDir, name);
        const raw = readFileSync(fullPath);
        const gz = gzipSync(raw, { level: 9 });
        writeFileSync(`${fullPath}.gz`, gz);
      }
    },
  };
}

export default defineConfig({
  plugins: [precompressGzipPlugin(outDir)],
  build: {
    outDir,
    emptyOutDir: true,
    sourcemap: false,
    minify: "esbuild",
    chunkSizeWarningLimit: 2500,
    lib: {
      entry: resolve(__dirname, "frontend/src/index.ts"),
      formats: ["es"],
      fileName: () => "solar-sky-radar-card.js",
    },
    rollupOptions: {
      output: {
        entryFileNames: "solar-sky-radar-card.js",
        chunkFileNames: "solar-sky-radar-[name]-[hash].js",
        manualChunks(id) {
          if (
            id.includes("node_modules/") &&
            !id.includes("node_modules/lit") &&
            !id.includes("node_modules/@lit") &&
            !id.endsWith(".css?inline") &&
            !id.endsWith(".css")
          ) {
            return "maplibre";
          }
          return undefined;
        },
      },
    },
  },
});
