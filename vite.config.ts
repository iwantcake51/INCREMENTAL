/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// The production build is one self-contained HTML file (dist/index.html) that opens straight from disk.
export default defineConfig({
  base: "./",
  plugins: [preact(), viteSingleFile()],
  build: { target: "es2022", chunkSizeWarningLimit: 2000 },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
