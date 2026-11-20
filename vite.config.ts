import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: resolve(__dirname, "custom_components/solar_sky_radar/www"),
    emptyOutDir: false,
    sourcemap: false,
    minify: "esbuild",
    chunkSizeWarningLimit: 2500,
    lib: {
      entry: resolve(__dirname, "frontend/src/index.ts"),
      name: "SolarSkyRadarCard",
      formats: ["es"],
      fileName: () => "solar-sky-radar-card.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
