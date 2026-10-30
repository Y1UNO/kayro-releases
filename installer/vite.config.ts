import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// Kayro's installer page (installer/ui) → installer/dist, embedded by the installer crate.
// Dev: `npx vite --config installer/vite.config.ts` (fake core, `?screen=…`, see ui/backend.ts).
export default defineConfig({
  root: fileURLToPath(new URL("./ui", import.meta.url)),
  base: "./",
  clearScreen: false,
  server: {
    port: 1430,
    strictPort: true,
    fs: { allow: [fileURLToPath(new URL("..", import.meta.url))] },
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    target: "es2022",
    sourcemap: false,
  },
});
