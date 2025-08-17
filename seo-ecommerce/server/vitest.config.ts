import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tools/**/__tests__/**/*.test.ts"],
    environment: "node",
  },
});
