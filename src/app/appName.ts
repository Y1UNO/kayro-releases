// The only TypeScript constant for the display name; its value comes from
// productName in src-tauri/tauri.conf.json (injected by Vite's `define`).
export const APP_NAME: string = __APP_NAME__;

/** « 0.14 » from `version` in tauri.conf.json (the patch number is not shown). */
export const APP_VERSION: string = __APP_VERSION__.split(".").slice(0, 2).join(".");
