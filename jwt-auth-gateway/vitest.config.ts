import { defineConfig } from "vitest/config.js";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    coverage: {
      reporter: ["text", "json", "html"],
    },
  },
});
