import type { FxParams } from "../FxLayer";
import type { StageFrame } from "./cues";
import type { BudgetWatch } from "./budgetWatch";
import type { GlassFrame, PosterPass } from "./glassFrame";
import { MAX_POSTERS, type PosterTextures } from "./posterTextures";
import type { Uniforms } from "./renderer";
import { posterK } from "./uniforms";

/** Posters drawn as textures this frame, or null (element off, fallen back on the ladder). */
export function posterPassOf(
  p: FxParams,
  t: PosterTextures | null,
  watch: BudgetWatch,
): PosterPass | null {
  if (!t || p.posterGlass?.on !== true || !watch.allows("poster")) {
    if (t && t.count > 0) {
      t.limit = 0; // free them all now
      t.end();
    }
    return null;
  }
  const c = p.glassCards;
  const max = p.posterGlass.maxTextures;
  t.limit = Math.min(MAX_POSTERS, typeof max === "number" ? Math.round(max) : MAX_POSTERS);
  return {
    textures: t,
    opacity: typeof c?.posterOpacity === "number" ? c.posterOpacity : 1,
    inset: typeof c?.posterInset === "number" ? c.posterInset : 3,
  };
}

/** The shapes of a glass frame as uniforms of the glass pass (+ the fan's hover, round 3b). */
export function shapeUniforms(f: GlassFrame, p: FxParams, stage: StageFrame | null): Uniforms {
  const hv = stage?.hover ?? null;
  return {
    // The hovered card of the fan casts a deeper shadow (round 3b).
    uHov: [hv !== null && f.hover >= 0 ? f.hover : -1, hv?.h ?? 0],
    uN: f.n,
    uNS: f.ns,
    uNested: f.nested > 0 ? 1 : 0,
    uR: f.R,
    uS: f.S,
    uT: f.T,
    uC: f.C,
    uPo: f.P,
    uX: f.X,
    uQ: f.Q,
    uPosterK: posterK(p),
  };
}
