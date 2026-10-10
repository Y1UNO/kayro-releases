import { getCurrentWindow } from "@tauri-apps/api/window";
import { GLYPH_PATH, SYMBOL_VIEWBOX, TILE_PATH } from "./symbol";
import { DEFAULT_LOGO_VARIANT, LOGO_VARS, findVariant } from "./variants";
import type { LogoVariant } from "./variants";

const WINDOW_ICON_PX = 256;

function applyVars(v: LogoVariant, root: HTMLElement): void {
  root.style.setProperty(LOGO_VARS.haut, v.haut);
  root.style.setProperty(LOGO_VARS.bas, v.bas);
  root.style.setProperty(LOGO_VARS.symbole, v.symbole);
}

/** Standalone SVG of the symbol in one variant (no CSS variables: it is drawn off-page). */
export function variantSvg(v: LogoVariant): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${SYMBOL_VIEWBOX}" width="${WINDOW_ICON_PX}" height="${WINDOW_ICON_PX}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${v.haut}"/><stop offset="1" stop-color="${v.bas}"/></linearGradient></defs>` +
    `<path d="${TILE_PATH}" fill="url(#g)"/><path d="${GLYPH_PATH}" fill="${v.symbole}"/></svg>`
  );
}

/** Draws the variant on a canvas and returns it as PNG bytes. */
export async function renderVariantPng(v: LogoVariant): Promise<Uint8Array> {
  const img = new Image();
  img.src = `data:image/svg+xml;base64,${btoa(variantSvg(v))}`;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = WINDOW_ICON_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d canvas unavailable");
  ctx.drawImage(img, 0, 0, WINDOW_ICON_PX, WINDOW_ICON_PX);
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/png"));
  if (!blob) throw new Error("PNG encoding failed");
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Switches the logo colours: CSS variables for every <Logo /> on the page, and the window icon
 * (taskbar) regenerated as a 256 px PNG. The .exe and shortcut icons stay the neutral ones.
 * Resolves false for an unknown id. The window icon is best effort (absent outside Tauri).
 */
export async function setLogoVariant(
  id: string,
  root: HTMLElement = document.documentElement,
): Promise<boolean> {
  const variant = findVariant(id);
  if (!variant) return false;
  applyVars(variant, root);
  try {
    await getCurrentWindow().setIcon(await renderVariantPng(variant));
  } catch (e) {
    console.warn("window icon not updated", e);
  }
  return true;
}

/** Colours only (first paint): the default variant, no window icon to change yet. */
export function applyDefaultLogoColours(root: HTMLElement = document.documentElement): void {
  applyVars(DEFAULT_LOGO_VARIANT, root);
}
