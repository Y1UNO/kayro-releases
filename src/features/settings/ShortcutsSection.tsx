import { useState } from "react";
import { t } from "../../i18n";
import { desktopIpc } from "../../ipc/commands";
import { errorText } from "../../ipc/errors";
import { useDesktop, useHub, useScenes } from "../../store";
import { HotkeyField } from "../scenes/HotkeyField";
import styles from "./Settings.module.css";

type Message = { text: string; kind: "ok" | "error" } | null;

/** What the last change of a shortcut gave. */
function Said({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <p className={message.kind === "error" ? styles.warn : styles.help} role="status">
      {message.text}
    </p>
  );
}

/**
 * Réglages › Raccourcis clavier (2026-11-02): the shortcut that shows or hides Kayro (moved from
 * Général), how it brings a hidden island out, « Écrire dans Kysland » (2026-11-04, removable),
 * and the scenes' shortcuts (read only: each is chosen in its scene's editor).
 */
export function ShortcutsSection() {
  const settings = useHub((s) => s.settings);
  const scenes = useScenes((s) => s.scenes);
  const sceneKeys = useDesktop((s) => s.hotkeys?.scenes);
  const toggleStatus = useDesktop((s) => s.hotkeys?.toggle ?? null);
  const searchStatus = useDesktop((s) => s.hotkeys?.search ?? null);
  const [message, setMessage] = useState<Message>(null);
  const [searchMessage, setSearchMessage] = useState<Message>(null);
  if (!settings) return null;

  async function changeHotkey(hotkey: string | null) {
    if (!hotkey) return; // the shortcut cannot be removed, only replaced
    const result = await desktopIpc.setHotkey(hotkey);
    setMessage(
      result.ok
        ? { text: t("settings.shortcuts.hotkey.saved"), kind: "ok" }
        : { text: errorText(result.error), kind: "error" },
    );
  }

  async function changeSearchHotkey(hotkey: string | null) {
    const result = await desktopIpc.setSearchHotkey(hotkey ?? "");
    const done = t(
      hotkey ? "settings.shortcuts.hotkey.saved" : "settings.shortcuts.search.removed",
    );
    setSearchMessage(
      result.ok ? { text: done, kind: "ok" } : { text: errorText(result.error), kind: "error" },
    );
  }

  const sceneHotkeys = sceneKeys?.map((s) => s.hotkey) ?? [];

  const named = (sceneKeys ?? []).flatMap((k) => {
    const scene = scenes.find((s) => s.id === k.sceneId);
    return scene ? [{ ...k, name: scene.name }] : [];
  });

  return (
    <div className={styles.rows} data-cascade="">
      <section className={styles.row} data-row="">
        <h3 className={styles.label}>{t("settings.shortcuts.hotkey.label")}</h3>
        <HotkeyField
          value={settings.hotkey}
          taken={[...sceneHotkeys, settings.searchHotkey]}
          onChange={(hotkey) => void changeHotkey(hotkey)}
        />
        {toggleStatus?.problem != null && (
          <p className={styles.warn} role="status">
            {t("settings.shortcuts.hotkey.failedAtStart", { hotkey: settings.hotkey })}
          </p>
        )}
        <Said message={message} />
        <p className={styles.help}>{t("settings.shortcuts.island")}</p>
      </section>
      <section className={styles.row} data-row="">
        <h3 className={styles.label}>{t("settings.shortcuts.search.label")}</h3>
        <HotkeyField
          value={settings.searchHotkey || null}
          taken={[...sceneHotkeys, settings.hotkey]}
          onChange={(hotkey) => void changeSearchHotkey(hotkey)}
        />
        {searchStatus?.problem != null && (
          <p className={styles.warn} role="status">
            {t("settings.shortcuts.search.failedAtStart", { hotkey: settings.searchHotkey })}
          </p>
        )}
        <Said message={searchMessage} />
        <p className={styles.help}>{t("settings.shortcuts.search.help")}</p>
      </section>
      <section className={styles.row} data-row="">
        <h3 className={styles.label}>{t("settings.shortcuts.scenes.label")}</h3>
        <p className={styles.help}>{t("settings.shortcuts.scenes.help")}</p>
        {named.length === 0 ? (
          <p className={styles.help}>{t("settings.shortcuts.scenes.none")}</p>
        ) : (
          <ul className={styles.keyList}>
            {named.map((k) => (
              <li key={k.sceneId} className={styles.keyRow}>
                <span>{k.name}</span>
                <kbd className={styles.key}>{k.hotkey}</kbd>
                {k.problem != null && (
                  <span className={styles.warn}>{t("settings.shortcuts.scenes.taken")}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
