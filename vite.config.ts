import { readFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { atelier } from "./vite/atelier";

// Single source of truth for the display name: productName in tauri.conf.json.
const tauriConf = JSON.parse(readFileSync("./src-tauri/tauri.conf.json", "utf-8")) as {
  productName: string;
};

export default defineConfig({
  // atelier(): dev server only (`apply: "serve"`), art direction workshop (step 12b).
  plugins: [react(), atelier()],
  define: { __APP_NAME__: JSON.stringify(tauriConf.productName) },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**", "**/spikes/**", "**/target/**"] },
  },
  build: { target: "es2022", sourcemap: false },
});
