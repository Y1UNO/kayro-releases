import { useEffect, useRef } from "react";
import { playSound } from "../../sound";

/**
 * Step 17b: the home's sounds. Another card selected → « step »; another category → « tab »
 * (the round of the cards). Nothing on the first render.
 */
export function useHomeSounds(category: string, focus: number): void {
  const last = useRef<{ category: string; focus: number } | null>(null);
  useEffect(() => {
    const before = last.current;
    last.current = { category, focus };
    if (!before) return;
    if (before.category !== category) playSound("tab");
    else if (before.focus !== focus) playSound("step");
  }, [category, focus]);
}
