import { defineConfig } from "vitest/config";

export default defineConfig({
  define: { __APP_NAME__: JSON.stringify("Kayro") },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
