import { useEffect, useState } from "react";
import notes from "../../../installer/ui/patchNotes.json";
import { t } from "../../i18n";
import { useHub } from "../../store";
import { CapriSheet } from "./CapriSheet";

/** The version whose « Nouveautés » were seen (a per-PC convenience: lost, it shows once more). */
const SEEN = "kayro.whatsNew";

/** The newest entry of the patch notes: this version. */
const latest = notes[notes.length - 1];

function seen(): string | null {
  try {
    return localStorage.getItem(SEEN);
  } catch {
    return null;
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(SEEN, latest?.version ?? "");
  } catch {
    // no storage: it may show again next time, nothing more
  }
}

/**
 * Step 20: after an update, the first time Kayro opens, what is new in this version, in the
 * Capri look; once per version. A fresh install has nothing to show (the installer told it all).
 * `ready`: the opening animation is over.
 */
export function WhatsNew({ ready }: { ready: boolean }) {
  const fresh = useHub((s) => s.apps.length === 0);
  const [open, setOpen] = useState(
    () => latest !== undefined && seen() !== latest.version && !fresh,
  );
  useEffect(() => {
    if (fresh) markSeen();
  }, [fresh]);
  if (!latest) return null;
  const close = () => {
    markSeen();
    setOpen(false);
  };
  return (
    <CapriSheet
      open={open && ready}
      eyebrow={t("whatsNew.eyebrow")}
      title={t("whatsNew.title", { version: latest.version })}
      sub={`${latest.title} · ${latest.date}`}
      points={latest.points}
      primary={t("whatsNew.go")}
      onPrimary={close}
      onClose={close}
    />
  );
}
