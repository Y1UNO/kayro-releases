import { useWindowVisible } from "../../app/windowVisible";
import { HandIcon, IconButton } from "../../design";
import { t } from "../../i18n";
import { handsIpc } from "../../ipc/commands";
import { useHub } from "../../store";
import { useHands } from "./handsStore";
import styles from "../voice/VoiceButton.module.css";

/**
 * Step 22: the hands' button in the top bar (its place was kept since round 5): lit while the
 * camera is on (the microphone button's look), a click turns it on or off. Shown once the hands
 * are set up.
 */
export function HandsButton({ size = "md" }: { size?: "md" | "sm" }) {
  const enabled = useHub((s) => s.settings?.hands.enabled ?? false);
  const on = useHands((s) => s.state.on);
  // Its halo breathes only on screen (soft sleep: nothing runs for a hidden hub).
  const visible = useWindowVisible();
  if (!enabled) return null;
  return (
    <IconButton
      label={t(on ? "hands.button.on" : "hands.button.off")}
      size={size}
      glass
      className={styles.mic}
      data-mic={on ? "open" : "idle"}
      data-still={!visible || undefined}
      aria-pressed={on}
      onClick={() => void handsIpc.setOn(!on)}
    >
      <HandIcon size={size === "sm" ? 16 : 20} />
    </IconButton>
  );
}
