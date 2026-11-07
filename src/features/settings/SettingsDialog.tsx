import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Dialog } from "../../design";
import { t } from "../../i18n";
import { GeneralSection } from "./GeneralSection";
import { IslandSection } from "./IslandSection";
import { ShortcutsSection } from "./ShortcutsSection";
import { SoundsSection } from "./SoundsSection";
import { StartupSection } from "./StartupSection";
import { ThemesSection } from "./ThemesSection";
import { VisualSection } from "./VisualSection";
import styles from "./Settings.module.css";

const TABS = [
  "general",
  "startup",
  "shortcuts",
  "island",
  "visual",
  "sounds",
  "themes",
] as const;
type Tab = (typeof TABS)[number];

/** The category shown last, while the app runs (the dialog reopens where it was left). */
let lastTab: Tab = "general";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Réglages (round 5): a side column of categories — Général · Démarrage · Raccourcis clavier · Île
 * dynamique (Kysland, 2026-11-02) · Visuel · Sons · Thèmes — and the chosen one in a body that scrolls (the panel never outgrows the screen).
 */
export function SettingsDialog({ open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>(lastTab);
  const ids = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    lastTab = tab;
  }, [tab]);

  function select(next: Tab, focus = false) {
    setTab(next);
    if (focus) refs.current[TABS.indexOf(next)]?.focus();
  }

  function onKeyDown(e: KeyboardEvent, index: number) {
    const last = TABS.length - 1;
    const to: Record<string, number> = {
      ArrowDown: index === last ? 0 : index + 1,
      ArrowUp: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    };
    const next = to[e.key];
    if (next === undefined) return;
    e.preventDefault();
    select(TABS[next] as Tab, true);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("settings.title")}
      closeLabel={t("settings.close")}
      size="settings"
    >
      <div className={styles.layout}>
        <nav
          className={styles.nav}
          role="tablist"
          aria-orientation="vertical"
          aria-label={t("settings.nav.label")}
        >
          {TABS.map((id, i) => (
            <button
              key={id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${ids}-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`${ids}-panel`}
              tabIndex={tab === id ? 0 : -1}
              className={styles.tab}
              onClick={() => select(id)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              {t(`settings.nav.${id}`)}
            </button>
          ))}
        </nav>
        <div
          className={styles.scroll}
          data-tab={tab}
          role="tabpanel"
          id={`${ids}-panel`}
          aria-labelledby={`${ids}-tab-${tab}`}
        >
          {tab === "general" && <GeneralSection />}
          {tab === "startup" && <StartupSection />}
          {tab === "shortcuts" && <ShortcutsSection />}
          {tab === "island" && <IslandSection />}
          {tab === "visual" && <VisualSection />}
          {tab === "sounds" && <SoundsSection />}
          {tab === "themes" && <ThemesSection />}
        </div>
      </div>
    </Dialog>
  );
}
