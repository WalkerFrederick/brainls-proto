import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    exclude: ["packages/**", "node_modules/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@brainls/fsrs": path.resolve(__dirname, "./packages/fsrs/src/index.ts"),
    },
  },
});
