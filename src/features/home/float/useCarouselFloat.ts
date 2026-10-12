import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import { useDa } from "../../../design/da";
import { AMBIENT_FPS, ECO_MAX_FPS } from "../../../fx/budget";
import { useReducedMotion } from "../../../fx/useReducedMotion";
import { useHub } from "../../../store";
import { CarouselFloat, type CarouselFloatConfig } from "./carouselFloat";
import { floatLevel } from "./cardFloat";

/**
 * The carousel's floating (round 5) at the settings' level (`categoryHover.float`, shared with the
 * fan): none with reduced motion, 30 i/s in Eco or while the cards only float. The instance
 * follows every render of the carousel.
 */
export function useCarouselFloat(
  stage: RefObject<HTMLElement | null>,
  dragging: boolean,
): RefObject<CarouselFloat | null> {
  const name = useDa((s) => s.values.categoryHover?.float);
  const eco = useHub((s) => s.settings?.quality === "eco");
  const reduced = useReducedMotion();
  const config = useMemo<CarouselFloatConfig>(() => {
    const level = floatLevel(name);
    return {
      amp: reduced ? 0 : level.carousel,
      tilt: level.tilt,
      period: level.period,
      fps: eco ? ECO_MAX_FPS : AMBIENT_FPS,
      // Round 5: the floating alone at 30 i/s (the sine is slow, the eye does not see it).
      idleFps: ECO_MAX_FPS,
    };
  }, [name, eco, reduced]);
  const float = useRef<CarouselFloat | null>(null);
  useLayoutEffect(() => {
    if (!stage.current) return;
    const f = new CarouselFloat(stage.current, config);
    float.current = f;
    return () => {
      f.dispose();
      float.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one instance; config follows below
  }, []);
  useEffect(() => float.current?.setConfig(config), [config]);
  useEffect(() => {
    if (float.current) float.current.dragging = dragging;
  }, [dragging]);
  // The mounted cards change with the selection and the category.
  useLayoutEffect(() => float.current?.refresh());
  return float;
}
