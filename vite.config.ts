import { readFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Single source of truth for the display name and the version: tauri.conf.json.
const tauriConf = JSON.parse(readFileSync("./src-tauri/tauri.conf.json", "utf-8")) as {
  productName: string;
  version: string;
};

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_NAME__: JSON.stringify(tauriConf.productName),
    __APP_VERSION__: JSON.stringify(tauriConf.version),
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**", "**/spikes/**", "**/target/**"] },
  },
  build: { target: "es2022", sourcemap: false },
});
