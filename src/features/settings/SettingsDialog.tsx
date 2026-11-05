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
import { VoiceSection } from "./VoiceSection";
import { HandsSection } from "./HandsSection";
import styles from "./Settings.module.css";

const TABS = [
  "general",
  "startup",
  "shortcuts",
  "island",
  "visual",
  "sounds",
  "themes",
  "voice",
  "hands",
] as const;
type Tab = (typeof TABS)[number];

/** The category shown last, while the app runs (the dialog reopens where it was left). */
let lastTab: Tab = "general";

interface Props {
  open: boolean;
  onClose: () => void;
  /** A category to show now (the voice: « ouvre les réglages de la voix »). */
  tab?: Tab | null;
}

/** The pages as the voice names them (brain/prompt.rs `SETTINGS_PAGES`) → the categories. */
export function pageTab(page: string | null): Tab | null {
  const pages: Record<string, Tab> = {
    general: "general",
    demarrage: "startup",
    raccourcis: "shortcuts",
    kysland: "island",
    visuel: "visual",
    sons: "sounds",
    themes: "themes",
    voix: "voice",
    mains: "hands",
  };
  return page ? (pages[page] ?? null) : null;
}

/**
 * Réglages (round 5): a side column of categories — Général · Démarrage · Raccourcis clavier · Île
 * dynamique (Kysland, 2026-11-02) · Visuel · Sons · Thèmes · Assistant vocal et IA (step 21) · Mains (step 22) — and the chosen
 * one in a body that scrolls (the panel never outgrows the screen).
 */
export function SettingsDialog({ open, onClose, tab: wanted }: Props) {
  const [tab, setTab] = useState<Tab>(lastTab);
  const ids = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    lastTab = tab;
  }, [tab]);

  // A category asked from outside (the voice): shown once; the user may then move on.
  const [asked, setAsked] = useState<Tab | null | undefined>(null);
  if (wanted !== asked) {
    setAsked(wanted);
    if (wanted) setTab(wanted);
  }

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
          {tab === "voice" && <VoiceSection />}
          {tab === "hands" && <HandsSection />}
        </div>
      </div>
    </Dialog>
  );
}
