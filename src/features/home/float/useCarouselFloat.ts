import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import { useDa } from "../../../design/da";
import { isEco } from "../../../design/quality";
import { useReducedMotion } from "../../../fx/useReducedMotion";
import { useHub } from "../../../store";
import { CarouselFloat, carouselFloatConfig } from "./carouselFloat";

/**
 * The carousel's floating (round 5) at the settings' level (`categoryHover.float`, shared with the
 * fan): none with reduced motion, 30 i/s in Eco or while the cards only float, none while the
 * category fan is shown (`active` false). The instance follows every render of the carousel.
 */
export function useCarouselFloat(
  stage: RefObject<HTMLElement | null>,
  dragging: boolean,
  active = true,
): RefObject<CarouselFloat | null> {
  const name = useDa((s) => s.values.categoryHover?.float);
  const eco = useHub((s) => isEco(s.settings?.quality));
  const reduced = useReducedMotion();
  const config = useMemo(
    () => carouselFloatConfig(name, eco, reduced, active),
    [name, eco, reduced, active],
  );
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
