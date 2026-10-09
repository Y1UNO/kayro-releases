import { APP_NAME } from "../../app/appName";
import {
  HandIcon,
  IconButton,
  MicIcon,
  Pill,
  PlusIcon,
  SearchIcon,
  SegmentedControl,
  Surface,
} from "../../design";
import { t } from "../../i18n";
import styles from "./TopBar.module.css";

interface Props {
  onSearch: () => void;
  onAdd: () => void;
}

const NOOP = () => {};

/**
 * Glass top bar: name, search field (opens the Ctrl+K palette), display modes, voice, hands.
 * Modes, voice and hands are in place but disabled: they arrive in steps 12, and in the voice and
 * hands extensions.
 */
export function TopBar({ onSearch, onAdd }: Props) {
  return (
    <Surface as="header" radius="29px" className={styles.bar}>
      <div className={styles.brand}>{APP_NAME}</div>
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
        <IconButton label={t("home.addApps.open")} size="sm" onClick={onAdd}>
          <PlusIcon />
        </IconButton>
        <SegmentedControl
          label={t("home.modes.label")}
          disabled
          value="immersive"
          onChange={NOOP}
          options={[
            { value: "immersive", label: t("home.modes.immersive") },
            { value: "window", label: t("home.modes.window") },
            { value: "widget", label: t("home.modes.widget") },
          ]}
        />
        <IconButton label={t("home.voice")} size="sm" disabled>
          <MicIcon />
        </IconButton>
        <IconButton label={t("home.hands")} size="sm" disabled>
          <HandIcon />
        </IconButton>
      </div>
    </Surface>
  );
}
