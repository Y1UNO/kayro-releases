import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

/** What the installer's core knows when the window opens (installer/src/main.rs, `info`). */
export interface Info {
  version: string;
  installed: string | null;
  newerInstalled: boolean;
  running: boolean;
  ready: boolean;
}

export type Outcome = { kind: "done" } | { kind: "failed"; code: number };

/** The installer's core, behind one interface (a fake one draws the screens in a browser, dev). */
export interface Backend {
  info(): Promise<Info>;
  closeKayro(): Promise<boolean>;
  install(desktop: boolean): Promise<Outcome>;
  launch(): Promise<boolean>;
  classic(): Promise<boolean>;
  quit(): Promise<void>;
  minimize(): Promise<void>;
  /** Called when the window is asked to close; returning false keeps it open. */
  onCloseRequested(allow: () => boolean): void;
}

export const tauriBackend: Backend = {
  info: () => invoke<Info>("info"),
  closeKayro: () => invoke<boolean>("close_kayro"),
  install: (desktop) => invoke<Outcome>("install", { desktop }),
  launch: () => invoke<boolean>("launch"),
  classic: () => invoke<boolean>("classic"),
  quit: () => invoke<void>("quit"),
  minimize: () => getCurrentWindow().minimize(),
  onCloseRequested(allow) {
    void getCurrentWindow().onCloseRequested((event) => {
      if (!allow()) event.preventDefault();
    });
  },
};

/**
 * Dev only (`npx vite --config installer/vite.config.ts`, no Tauri): `?screen=update`, `running`,
 * `stuck`, `failed`, `newer`, `missing`, `reinstall`; the install takes 2.5 s.
 */
export function fakeBackend(screen: string | null): Backend {
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let running = screen === "running" || screen === "stuck";
  return {
    info: async () => ({
      version: "0.16.0",
      installed: { update: "0.15.0", reinstall: "0.16.0", newer: "0.17.0" }[screen ?? ""] ?? null,
      newerInstalled: screen === "newer",
      running,
      ready: screen !== "missing",
    }),
    closeKayro: async () => {
      await wait(900);
      running = screen === "stuck";
      return !running;
    },
    install: async () => {
      await wait(2500);
      return screen === "failed" ? { kind: "failed", code: 2 } : { kind: "done" };
    },
    launch: async () => true,
    classic: async () => true,
    quit: async () => undefined,
    minimize: async () => undefined,
    onCloseRequested: () => undefined,
  };
}
