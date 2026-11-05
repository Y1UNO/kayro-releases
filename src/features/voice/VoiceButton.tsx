import { useWindowVisible } from "../../app/windowVisible";
import { IconButton, MicIcon } from "../../design";
import { t, type MessageKey } from "../../i18n";
import { voiceIpc } from "../../ipc/commands";
import { useHub } from "../../store";
import { micOpen, useVoice } from "./voiceStore";
import styles from "./VoiceButton.module.css";

/**
 * Step 21: the microphone button of the top bar and the dock (a place the art direction kept for
 * it, round 5). Shown while the voice is on: it lights while the microphone listens, and a click
 * mutes or resumes it (« coupure facile »).
 */
export function VoiceButton({ size = "md" }: { size?: "md" | "sm" }) {
  const mode = useHub((s) => s.settings?.voice.mode ?? "off");
  const status = useVoice((s) => s.state.status);
  // Its halo breathes only on screen (soft sleep: nothing runs for a hidden hub).
  const visible = useWindowVisible();
  if (mode === "off") return null;
  const muted = status === "muted";
  const mic = micOpen(status) ? "open" : muted ? "muted" : "idle";
  return (
    <IconButton
      label={t(`voice.button.${status}` as MessageKey)}
      size={size}
      glass
      className={styles.mic}
      data-mic={mic}
      data-still={!visible || undefined}
      aria-pressed={!muted}
      onClick={() => void voiceIpc.mute(!muted)}
    >
      <MicIcon size={size === "sm" ? 16 : 20} />
      {muted && <span className={styles.slash} aria-hidden="true" />}
    </IconButton>
  );
}
