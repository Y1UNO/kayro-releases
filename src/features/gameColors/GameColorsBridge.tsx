import { memo } from "react";
import { useHomeGameColors } from "./useHomeGameColors";

/**
 * Step 14: the game colours of the home screen, in a leaf that renders nothing. The colours, the
 * theme and the settings they read re-render this leaf only, never the whole home screen (measured
 * 14/10: inside `HomeScreen`, they re-rendered it 180 ms after each selection, mid-animation).
 */
export const GameColorsBridge = memo(function GameColorsBridge({
  activeId,
}: {
  /** The selected app; null on the fan. */
  activeId: string | null;
}) {
  useHomeGameColors(activeId);
  return null;
});
