import "@fontsource-variable/fraunces/opsz.css"; // wght + opsz axes (optical size, as in the mock-ups)
import "@fontsource-variable/dm-sans";
import { StrictMode, Suspense, lazy } from "react";
import type { ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ThemeProvider, applyQuality } from "./design";
import { applyDefaultLogoColours } from "./brand";
import { Atmosphere } from "./fx";
import { WidgetApp } from "./features/widget/WidgetApp";
import { desktopStore, hubStore, sceneStore } from "./store";
import "./index.css";

applyDefaultLogoColours();

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

// Design-system catalogue: development builds only (the branch is removed from production bundles).
const Catalogue: ComponentType | null =
  import.meta.env.DEV && location.pathname === "/dev/catalogue"
    ? lazy(() => import("./dev/Catalogue"))
    : null;

// Launcher test bench (step 6): development builds only, like the catalogue.
const LauncherBench: ComponentType | null =
  import.meta.env.DEV && location.pathname === "/dev/launcher"
    ? lazy(() => import("./dev/Launcher"))
    : null;

// Home screen with fake data and a frame-time bench (step 7): development builds, and the
// `vite build --mode bench` build used to measure with production React (never in a normal build).
const HomeDev: ComponentType | null =
  (import.meta.env.DEV || import.meta.env.MODE === "bench") && location.pathname === "/dev/home"
    ? lazy(() => import("./dev/Home"))
    : null;

// Scene screens with fake data (step 11): development builds only.
const ScenesDev: ComponentType | null =
  import.meta.env.DEV && location.pathname === "/dev/scenes"
    ? lazy(() => import("./dev/Scenes"))
    : null;

const appRoot = createRoot(root);
const DevPage = Catalogue ?? LauncherBench ?? HomeDev ?? ScenesDev;

if (DevPage) {
  appRoot.render(
    <StrictMode>
      <Suspense fallback={null}>
        <DevPage />
      </Suspense>
    </StrictMode>,
  );
} else if (new URLSearchParams(location.search).get("w") === "widget") {
  // The widget window: a transparent page with no atmosphere, its own bar and panel.
  document.documentElement.dataset.window = "widget";
  void Promise.all([
    hubStore.getState().init(),
    sceneStore.getState().init(),
    desktopStore.getState().init(),
  ]).finally(() => {
    appRoot.render(
      <StrictMode>
        <ThemeProvider initialThemeId={hubStore.getState().settings?.themeId}>
          <WidgetApp />
        </ThemeProvider>
      </StrictMode>,
    );
  });
} else {
  // Load the user's data first (a few ms, local): the first paint already has the right theme
  // and quality level. A failed load still renders the app (defaults, error shown by <App />).
  void hubStore
    .getState()
    .init()
    .finally(() => {
      const settings = hubStore.getState().settings;
      if (settings) applyQuality(settings.quality);
      hubStore.subscribe((s, prev) => {
        if (s.settings && s.settings.quality !== prev.settings?.quality) {
          applyQuality(s.settings.quality);
        }
      });
      appRoot.render(
        <StrictMode>
          <ThemeProvider
            initialThemeId={settings?.themeId}
            onThemeChange={(themeId) => void hubStore.getState().setSettings({ themeId })}
          >
            <Atmosphere />
            <App />
          </ThemeProvider>
        </StrictMode>,
      );
    });
}
