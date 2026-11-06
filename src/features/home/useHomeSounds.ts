import { useEffect, useRef } from "react";
import { playSound } from "../../sound";

/**
 * Step 17b: another card selected on the home → « step », a note of the pentatonic scale that
 * climbs with the card's place (moving along the carousel plays a little run). The category
 * change has its own sounds, on the rhythm of its animation (linkDirector.ts). Nothing on the
 * first render, nor when the category changes.
 */
export function useHomeSounds(category: string, focus: number): void {
  const last = useRef<{ category: string; focus: number } | null>(null);
  useEffect(() => {
    const before = last.current;
    last.current = { category, focus };
    if (before && before.category === category && before.focus !== focus) {
      playSound("step", { degree: focus % 8 });
    }
  }, [category, focus]);
}
