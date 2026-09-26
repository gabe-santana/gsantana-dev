import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  server: {
    // tests/ lives one level up from this config (a sibling of src/), so
    // Vite's dev-server file-system guard needs to be widened to reach it.
    fs: { allow: [path.resolve(__dirname, "..")] },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["../tests/setup.ts"],
    include: ["../tests/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
