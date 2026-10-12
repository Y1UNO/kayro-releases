import { useEffect, useState } from "react";
import { Button, CloseIcon, IconButton, Surface } from "../../design";
import { useMotionTokens } from "../../design/motion/current";
import { durOf } from "../../design/motion/tokens";
import { usePresence } from "../../design/motion/usePresence";
import { prefersReducedMotion } from "../../fx/motionPref";
import { t } from "../../i18n";
import styles from "./LaunchToast.module.css";

export interface MessageContent {
  /** A new identity = a new message (it replaces the one shown and comes in again). */
  id: object;
  text: string;
  action?: { label: string; run: () => void };
}

/**
 * The one short message of the app (round 4b, R4b-Etats.txt): it rises 14 px on the "liaison"
 * spring (moyen), stays 6 s, leaves in 0.7 × moyen. One at a time: the next replaces it. Never a
 * blocking popup. `onClose` clears its source.
 */
export function Message({
  content,
  onClose,
}: {
  content: MessageContent | null;
  onClose: () => void;
}) {
  const motion = useMotionTokens();
  const presence = usePresence(
    content !== null,
    durOf(motion, 2, "moyen", prefersReducedMotion(), true),
  );
  // Shown while it leaves (its source is already cleared).
  const [shown, setShown] = useState(content);
  if (content && content !== shown) setShown(content);

  useEffect(() => {
    if (!content) return;
    const id = window.setTimeout(onClose, motion.states.noticeMs);
    return () => window.clearTimeout(id);
  }, [content, onClose, motion.states.noticeMs]);

  if (presence === null || !shown) return null;
  return (
    // Keyed by message: a new one replaces the shown one and comes in again.
    <Surface
      key={keyOf(shown.id)}
      flat
      radius="var(--radius-panel)"
      className={styles.toast}
      role="alert"
      data-closing={presence === "out" || undefined}
    >
      <p className={styles.text}>{shown.text}</p>
      {shown.action && (
        <Button size="sm" variant="primary" onClick={shown.action.run}>
          {shown.action.label}
        </Button>
      )}
      <IconButton label={t("home.error.close")} size="sm" onClick={onClose}>
        <CloseIcon size={16} />
      </IconButton>
    </Surface>
  );
}

const keys = new WeakMap<object, number>();
let next = 0;
function keyOf(id: object): number {
  let k = keys.get(id);
  if (k === undefined) keys.set(id, (k = ++next));
  return k;
}
