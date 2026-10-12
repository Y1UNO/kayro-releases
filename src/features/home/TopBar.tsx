import { useRef, useState } from "react";
import { APP_NAME } from "../../app/appName";
import { FEATURES } from "../../app/features";
import { Logo } from "../../brand";
import {
  ChevronLeftIcon,
  DisplayModeIcon,
  HandIcon,
  IconButton,
  MicIcon,
  Pill,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  Surface,
} from "../../design";
import { t } from "../../i18n";
import type { DisplayMode } from "../../ipc/bindings";
import { hubStore, useHub } from "../../store";
import { PopMenu } from "./PopMenu";
import styles from "./TopBar.module.css";

const MODES: readonly DisplayMode[] = ["immersive", "window", "widget"];

/**
 * The display mode (round 5, proposal 6): a rare action, one round button that opens a small menu
 * (Immersif · Fenêtre · Widget), instead of three segments in the middle of the bar.
 */
function ModeButton() {
  const mode = useHub((s) => s.settings?.displayMode ?? "immersive");
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  // The press that closes the menu (a click outside it) must not open it again.
  const wasOpen = useRef(false);
  return (
    <>
      <IconButton
        label={t("home.modes.label")}
        size="sm"
        glass
        aria-haspopup="menu"
        aria-expanded={menu !== null}
        onPointerDown={() => (wasOpen.current = menu !== null)}
        onClick={(e) => {
          if (wasOpen.current) return void (wasOpen.current = false);
          const r = e.currentTarget.getBoundingClientRect();
          setMenu({ x: r.right, y: r.bottom + 8 });
        }}
      >
        <DisplayModeIcon />
      </IconButton>
      {menu && (
        <PopMenu
          x={menu.x}
          y={menu.y}
          align="end"
          label={t("home.modes.label")}
          onClose={() => setMenu(null)}
          items={MODES.map((m) => ({
            id: m,
            label: t(`home.modes.${m}`),
            checked: m === mode,
            onSelect: () => void hubStore.getState().setSettings({ displayMode: m }),
          }))}
        />
      )}
    </>
  );
}

interface Props {
  onSearch: () => void;
  onAdd: () => void;
  onSettings: () => void;
  /** "All categories": back to the category fan (round 3b). */
  onAllCategories: () => void;
  /** False on the fan itself: the button is faded out by the sequence and not reachable. */
  allCategories: boolean;
  /** The button, faded by the category sequences (linkDirector.ts). */
  backRef: (el: HTMLElement | null) => void;
}

/**
 * Glass top bar: logo and name, search field (opens the Ctrl+K palette), add apps, display mode
 * (a menu), settings. Voice and hands are hidden until those extensions exist (app/features.ts).
 */
export function TopBar({
  onSearch,
  onAdd,
  onSettings,
  onAllCategories,
  allCategories,
  backRef,
}: Props) {
  return (
    <Surface
      as="header"
      glassKind="bar"
      radius="var(--da-bar-radius, var(--radius-pill))"
      className={styles.bar}
    >
      <div className={styles.left}>
        <div className={styles.brand}>
          <Logo size={30} className={styles.logo} />
          <span>{APP_NAME}</span>
        </div>
        <button
          ref={backRef}
          type="button"
          className={styles.back}
          onClick={onAllCategories}
          inert={!allCategories}
          aria-hidden={!allCategories || undefined}
        >
          <ChevronLeftIcon size={14} />
          {t("home.allCategories")}
        </button>
      </div>
      <button
        type="button"
        className={styles.search}
        onClick={onSearch}
        aria-label={t("home.search.open")}
        aria-keyshortcuts="Control+K"
      >
        <SearchIcon size={16} />
        <span className={styles.placeholder}>{t("home.search.placeholder")}</span>
        <Pill tone="key">{t("home.search.shortcut")}</Pill>
      </button>
      <div className={styles.tools}>
        <IconButton label={t("home.addApps.open")} size="sm" glass onClick={onAdd}>
          <PlusIcon />
        </IconButton>
        <ModeButton />
        <IconButton label={t("home.settings.open")} size="sm" glass onClick={onSettings}>
          <SettingsIcon />
        </IconButton>
        {FEATURES.voice && (
          <IconButton label={t("home.voice")} size="sm" glass>
            <MicIcon />
          </IconButton>
        )}
        {FEATURES.hands && (
          <IconButton label={t("home.hands")} size="sm" glass>
            <HandIcon />
          </IconButton>
        )}
      </div>
    </Surface>
  );
}
