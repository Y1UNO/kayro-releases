import { APP_NAME } from "../../app/appName";
import { Logo } from "../../brand";
import {
  ChevronLeftIcon,
  HandIcon,
  IconButton,
  MicIcon,
  Pill,
  PlusIcon,
  SearchIcon,
  SegmentedControl,
  SettingsIcon,
  Surface,
} from "../../design";
import { t } from "../../i18n";
import type { DisplayMode } from "../../ipc/bindings";
import { hubStore, useHub } from "../../store";
import styles from "./TopBar.module.css";

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
 * Glass top bar: logo and name, search field (opens the Ctrl+K palette), display modes, display
 * settings, voice, hands. Voice and hands are in place but disabled: they come with the voice
 * and hands extensions.
 */
export function TopBar({
  onSearch,
  onAdd,
  onSettings,
  onAllCategories,
  allCategories,
  backRef,
}: Props) {
  const mode = useHub((s) => s.settings?.displayMode ?? "immersive");
  return (
    <Surface as="header" glassKind="bar" radius="var(--da-bar-radius, 29px)" className={styles.bar}>
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
        <SegmentedControl<DisplayMode>
          glassPill
          label={t("home.modes.label")}
          value={mode}
          onChange={(displayMode) => void hubStore.getState().setSettings({ displayMode })}
          options={[
            { value: "immersive", label: t("home.modes.immersive") },
            { value: "window", label: t("home.modes.window") },
            { value: "widget", label: t("home.modes.widget") },
          ]}
        />
        <IconButton label={t("home.settings.open")} size="sm" glass onClick={onSettings}>
          <SettingsIcon />
        </IconButton>
        <IconButton label={t("home.voice")} size="sm" glass disabled>
          <MicIcon />
        </IconButton>
        <IconButton label={t("home.hands")} size="sm" glass disabled>
          <HandIcon />
        </IconButton>
      </div>
    </Surface>
  );
}
