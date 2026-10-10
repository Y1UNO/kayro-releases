import { useEffect, useRef, useState } from "react";
import { t } from "../../i18n";
import { hotkeyFromEvent, hotkeyTaken } from "./hotkey";
import styles from "./Editor.module.css";

interface Props {
  value: string | null;
  /** Shortcuts already used by other scenes and by the app. */
  taken: readonly (string | null | undefined)[];
  onChange: (hotkey: string | null) => void;
  /** Another program already owns this combination: it is saved but will not work. */
  unregistered?: boolean;
}

/**
 * Press-a-combination field. The core registers the shortcut globally and says when it could
 * not (`unregistered`). Escape cancels, Backspace / Delete clears.
 */
export function HotkeyField({ value, taken, onChange, unregistered = false }: Props) {
  const [listening, setListening] = useState(false);
  const [hint, setHint] = useState<"invalid" | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const change = useRef(onChange);
  useEffect(() => {
    change.current = onChange;
  });

  useEffect(() => {
    if (!listening) return;
    function onKey(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") return stop();
      if (e.key === "Backspace" || e.key === "Delete") {
        change.current(null);
        return stop();
      }
      const got = hotkeyFromEvent(e);
      if (got.kind === "pending") return;
      if (got.kind === "invalid") return setHint("invalid");
      change.current(got.hotkey);
      stop();
    }
    function stop() {
      setListening(false);
      setHint(null);
      button.current?.focus();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [listening]);

  const conflict = value !== null && hotkeyTaken(value, taken);
  return (
    <div className={styles.hotkey}>
      <button
        ref={button}
        type="button"
        className={styles.hotkeyButton}
        data-listening={listening || undefined}
        aria-label={t("scenes.hotkey.label")}
        onClick={() => setListening(true)}
        onBlur={() => setListening(false)}
      >
        {listening ? t("scenes.hotkey.listening") : (value ?? t("scenes.hotkey.none"))}
      </button>
      {listening && (
        <span className={styles.hint} role="status">
          {hint === "invalid" ? t("scenes.hotkey.invalid") : t("scenes.hotkey.help")}
        </span>
      )}
      {!listening && conflict && (
        <span className={styles.warn} role="status">
          {t("scenes.hotkey.taken")}
        </span>
      )}
      {!listening && !conflict && unregistered && (
        <span className={styles.warn} role="status">
          {t("scenes.hotkey.registerFailed")}
        </span>
      )}
    </div>
  );
}
