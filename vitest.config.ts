import { defineConfig } from "vitest/config";

export default defineConfig({
  // Step 22: the tutorial's hand model (inlined, as in vite.config.ts).
  assetsInclude: ["**/*.glb"],
  define: { __APP_NAME__: JSON.stringify("Kayro"), __APP_VERSION__: JSON.stringify("0.14.0") },
  test: { environment: "node", include: ["src/**/*.test.ts", "installer/ui/**/*.test.ts"] },
});
