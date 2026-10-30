/**
 * The glyphs of an ambience in one picture (steps 16–17): up to 8 cells of 128 px (4 × 2), each
 * glyph's path (0–100 box) stroked in white with a soft glow baked in, once per ambience. The
 * engine uploads it as a texture; the Canvas 2D fallback cuts its sprites from it. The paths were
 * checked by the core (numbers and path commands only) before they get here.
 */
export const ATLAS_CELL = 128;
export const ATLAS_COLS = 4;
export const ATLAS_ROWS = 2;
/** Stroke width in the 0–100 box. */
const STROKE = 5.5;

export function drawAtlas(paths: readonly string[]): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_CELL * ATLAS_COLS;
  canvas.height = ATLAS_CELL * ATLAS_ROWS;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const k = (ATLAS_CELL - 24) / 100;
  ctx.strokeStyle = "#fff";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = STROKE;
  ctx.shadowColor = "rgba(255,255,255,.85)";
  ctx.shadowBlur = 9;
  paths.slice(0, ATLAS_COLS * ATLAS_ROWS).forEach((d, i) => {
    let path: Path2D;
    try {
      path = new Path2D(d);
    } catch {
      return;
    }
    ctx.save();
    ctx.translate((i % ATLAS_COLS) * ATLAS_CELL + 12, Math.floor(i / ATLAS_COLS) * ATLAS_CELL + 12);
    ctx.scale(k, k);
    ctx.stroke(path);
    ctx.restore();
  });
  return canvas;
}
