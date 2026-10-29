import { useState } from "react";
import { Button, PlusIcon, useTheme } from "../../design";
import type { Theme } from "../../design/theme";
import { PICKER_THEMES } from "../../design/themes";
import { useCustomThemes } from "../../design/themes/custom";
import { t } from "../../i18n";
import { themesIpc } from "../../ipc/commands";
import { useFileDrop } from "../add-app/useFileDrop";
import { ThemeCard } from "./ThemeCard";
import { ThemeEditor } from "./ThemeEditor";
import { useThemeSwap } from "./useThemeSwap";
import styles from "./Settings.module.css";

/** Same limit as the core (`config/themes.rs`, MAX_THEMES). */
const MAX_PERSONAL = 20;

/**
 * Réglages › Thèmes (R5-Reglages-Themes.txt §1): the six logo themes as cards (3 columns of
 * 240 × 150, 18 px apart). A click applies the theme with its wave; no « Appliquer » button.
 * Step 15: « Mes thèmes » below them (made here from two colours, or a `.json` dropped on the
 * section), each with « Modifier », then « Créer mon thème ».
 */
export function ThemesSection() {
  const { theme } = useTheme();
  const choose = useThemeSwap();
  const mine = useCustomThemes();
  const [editing, setEditing] = useState<Theme | "new" | null>(null);
  const [status, setStatus] = useState<{ text: string; kind: "ok" | "error" } | null>(null);

  const drop = useFileDrop((paths) => {
    if (editing) return;
    void (async () => {
      for (const path of paths) {
        const file = path.split(/[\\/]/).pop() ?? path;
        if (mine.length >= MAX_PERSONAL) {
          setStatus({ text: t("settings.themes.full", { max: MAX_PERSONAL }), kind: "error" });
          return;
        }
        const r = await themesIpc.importFile(path);
        setStatus(
          r.ok
            ? { text: t("settings.themes.imported", { name: r.value.name }), kind: "ok" }
            : { text: t("settings.themes.importFailed", { file }), kind: "error" },
        );
      }
    })();
  });

  if (editing)
    return (
      <ThemeEditor
        theme={editing === "new" ? null : editing}
        onClose={() => {
          setEditing(null);
          setStatus(null);
        }}
      />
    );

  return (
    <div className={styles.themesPage}>
      <div className={styles.themes} data-cascade="">
        {PICKER_THEMES.map((th) => (
          <ThemeCard key={th.id} theme={th} active={th.id === theme.id} onChoose={choose} />
        ))}
      </div>
      <section
        className={styles.mine}
        data-drop={drop.hovering ? "" : undefined}
        aria-labelledby="themes-mine"
      >
        <h3 className={styles.label} id="themes-mine">
          {t("settings.themes.mine")}
        </h3>
        <p className={styles.help}>{t("settings.themes.mineHelp")}</p>
        <div className={styles.themes}>
          {mine.map((th) => (
            <div key={th.id} className={styles.personal}>
              <ThemeCard theme={th} active={th.id === theme.id} onChoose={choose} />
              <Button
                size="sm"
                aria-label={t("settings.themes.edit", { name: th.name })}
                onClick={() => setEditing(th)}
              >
                {t("settings.themes.editShort")}
              </Button>
            </div>
          ))}
          {mine.length < MAX_PERSONAL && (
            <button type="button" className={styles.create} onClick={() => setEditing("new")}>
              <PlusIcon size={22} aria-hidden="true" />
              {t("settings.themes.create")}
            </button>
          )}
        </div>
        {status && (
          <p className={status.kind === "error" ? styles.warn : styles.help} role="status">
            {status.text}
          </p>
        )}
      </section>
    </div>
  );
}
