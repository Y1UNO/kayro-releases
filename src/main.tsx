// Art direction fonts (docs/DESIGN.md): Cormorant Garamond (titles) + Manrope (interface).
import "@fontsource-variable/cormorant-garamond";
import "@fontsource-variable/manrope";
import { StrictMode, Suspense, lazy } from "react";
import type { ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { installUserPrefs } from "./app/userPrefs";
import { ThemeProvider } from "./design";
import { installDa } from "./design/da";
import { applyDefaultLogoColours } from "./brand";
import { GameAtmosphere } from "./features/gameColors/GameAtmosphere";
import { WidgetApp } from "./features/widget/WidgetApp";
import { artStore, desktopStore, hubStore, sceneStore } from "./store";
import "./index.css";
import "./design/themeSwap.css";

applyDefaultLogoColours();
installDa();

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

// Design-system catalogue: development builds only (the branch is removed from production bundles).
const Catalogue: ComponentType | null =
  import.meta.env.DEV && location.pathname === "/dev/catalogue"
    ? lazy(() => import("./dev/Catalogue"))
    : null;

// Home screen with fake data (step 7): development builds only.
const HomeDev: ComponentType | null =
  import.meta.env.DEV && location.pathname === "/dev/home"
    ? lazy(() => import("./dev/Home"))
    : null;

// Scene screens with fake data (step 11): development builds only.
const ScenesDev: ComponentType | null =
  import.meta.env.DEV && location.pathname === "/dev/scenes"
    ? lazy(() => import("./dev/Scenes"))
    : null;

// Motion language lab (art direction round 4a): every interaction of the three levels. Dev only.
const MotionDev: ComponentType | null =
  import.meta.env.DEV && location.pathname === "/dev/motion"
    ? lazy(() => import("./dev/MotionLab"))
    : null;

// The widget (art direction round 4b: its glass unrolls) with fake data. Dev only.
const WidgetDev: ComponentType | null =
  import.meta.env.DEV && location.pathname === "/dev/widget"
    ? lazy(() => import("./dev/Widget"))
    : null;

const appRoot = createRoot(root);

// A window built for a passage between display modes (round 4b, `?enter=1`): the page starts
// faded out and comes in on its first show (src/features/modes/usePassage.ts).
if (new URLSearchParams(location.search).get("enter") === "1") {
  document.documentElement.dataset.entering = "";
  document.body.style.opacity = "0";
}
const DevPage = Catalogue ?? HomeDev ?? ScenesDev ?? MotionDev ?? WidgetDev;

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
    artStore.getState().init(),
  ]).finally(() => {
    installUserPrefs({ quality: false });
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
  // The art index too (folder listings only, a few ms): posters are there on the first paint.
  void Promise.all([hubStore.getState().init(), artStore.getState().init()]).finally(() => {
    const settings = hubStore.getState().settings;
    installUserPrefs({ quality: true });
    appRoot.render(
      <StrictMode>
        <ThemeProvider
          initialThemeId={settings?.themeId}
          onThemeChange={(themeId) => void hubStore.getState().setSettings({ themeId })}
        >
          <GameAtmosphere />
          <App />
        </ThemeProvider>
      </StrictMode>,
    );
  });
}
