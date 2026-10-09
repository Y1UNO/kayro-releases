import "@fontsource-variable/fraunces/opsz.css"; // wght + opsz axes (optical size, as in the mock-ups)
import "@fontsource-variable/dm-sans";
import { StrictMode, Suspense, lazy } from "react";
import type { ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { Backdrop, ThemeProvider } from "./design";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

// Design-system catalogue: development builds only (the branch is removed from production bundles).
const Catalogue: ComponentType | null =
  import.meta.env.DEV && location.pathname === "/dev/catalogue"
    ? lazy(() => import("./dev/Catalogue"))
    : null;

createRoot(root).render(
  <StrictMode>
    {Catalogue ? (
      <Suspense fallback={null}>
        <Catalogue />
      </Suspense>
    ) : (
      <ThemeProvider>
        <Backdrop />
        <App />
      </ThemeProvider>
    )}
  </StrictMode>,
);
