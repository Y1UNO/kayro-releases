import { useId, useMemo, useState } from "react";
import { Button, ChevronLeftIcon, Slider, useTheme } from "../../design";
import type { Theme } from "../../design/theme";
import { DEFAULT_THEME } from "../../design/themes";
import { customThemes, setCustomThemes } from "../../design/themes/custom";
import { deriveTheme, recipeOf, TINT_DEFAULT, type ThemeRecipe } from "../../design/themes/derive";
import { t } from "../../i18n";
import type { ThemeFile } from "../../ipc/bindings";
import { themesIpc } from "../../ipc/commands";
import { ThemeCard } from "./ThemeCard";
import styles from "./ThemeEditor.module.css";

interface Props {
  /** The personal theme edited, or none for a new one. */
  theme: Theme | null;
  onClose: () => void;
}

const NEW: ThemeRecipe = { name: "", a: "#a3b0de", b: "#f6a98a", tint: TINT_DEFAULT };
const NAME_MAX = 40;

/** Puts a saved theme in this window's list at once (the core's event follows with the same). */
function keep(saved: ThemeFile | null, removedId?: string) {
  const list = customThemes.getState().list.filter((x) => x.id !== (saved?.id ?? removedId));
  setCustomThemes(saved ? [...list, saved] : list);
}

/**
 * « Créer mon thème » (step 15): a name, colour A, colour B and how tinted the background is; the
 * rest is derived (design/themes/derive.ts) and shown live on the theme's own card. Saving applies
 * it. A personal theme can also be exported (to share it) or deleted here.
 */
export function ThemeEditor({ theme, onClose }: Props) {
  const { theme: current, setThemeId } = useTheme();
  const [recipe, setRecipe] = useState<ThemeRecipe>(() => (theme ? recipeOf(theme) : NEW));
  const [status, setStatus] = useState<{ text: string; kind: "ok" | "error" } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const ids = { name: useId(), a: useId(), b: useId(), tint: useId() };
  const preview = useMemo(
    () =>
      deriveTheme(theme?.id ?? "perso-apercu", {
        ...recipe,
        name: recipe.name.trim() || t("settings.themes.namePlaceholder"),
      }),
    [recipe, theme?.id],
  );
  const set = (patch: Partial<ThemeRecipe>) => setRecipe((r) => ({ ...r, ...patch }));

  async function save() {
    const name = recipe.name.trim() || t("settings.themes.namePlaceholder");
    setBusy(true);
    let id = theme?.id;
    if (!id) {
      const r = await themesIpc.newId(name);
      id = r.ok ? r.value : undefined;
    }
    const saved = id ? await themesIpc.save(deriveTheme(id, { ...recipe, name })) : null;
    setBusy(false);
    if (!saved?.ok) {
      setStatus({ text: t("settings.themes.saveFailed"), kind: "error" });
      return;
    }
    keep(saved.value);
    setThemeId(saved.value.id);
    onClose();
  }

  async function exportIt() {
    if (!theme) return;
    const r = await themesIpc.exportFile(theme.id);
    const file = r.ok ? (r.value.split(/[\\/]/).pop() ?? r.value) : "";
    setStatus(
      r.ok
        ? { text: t("settings.themes.exported", { file }), kind: "ok" }
        : { text: t("settings.themes.exportFailed"), kind: "error" },
    );
  }

  async function remove() {
    if (!theme) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    const r = await themesIpc.remove(theme.id);
    if (!r.ok) {
      setStatus({ text: t("settings.themes.saveFailed"), kind: "error" });
      return;
    }
    keep(null, theme.id);
    if (current.id === theme.id) setThemeId(DEFAULT_THEME.id);
    onClose();
  }

  return (
    <div className={styles.editor} data-cascade="">
      <div className={styles.head}>
        <Button size="sm" onClick={onClose}>
          <ChevronLeftIcon size={14} aria-hidden="true" /> {t("settings.themes.back")}
        </Button>
        <h3 className={styles.title}>
          {t(theme ? "settings.themes.editTitle" : "settings.themes.newTitle")}
        </h3>
      </div>
      <div className={styles.body}>
        <div className={styles.preview} inert>
          <ThemeCard theme={preview} active={false} onChoose={() => {}} />
        </div>
        <div className={styles.fields}>
          <label className={styles.field} htmlFor={ids.name}>
            {t("settings.themes.name")}
            <input
              id={ids.name}
              className={styles.input}
              value={recipe.name}
              maxLength={NAME_MAX}
              placeholder={t("settings.themes.namePlaceholder")}
              onChange={(e) => set({ name: e.target.value })}
            />
          </label>
          <div className={styles.colours}>
            {(["a", "b"] as const).map((k) => (
              <label key={k} className={styles.colour} htmlFor={ids[k]}>
                <input
                  id={ids[k]}
                  type="color"
                  className={styles.swatch}
                  value={recipe[k]}
                  onChange={(e) => set({ [k]: e.target.value })}
                />
                {t(k === "a" ? "settings.themes.colorA" : "settings.themes.colorB")}
              </label>
            ))}
          </div>
          <label className={styles.field} htmlFor={ids.tint}>
            {t("settings.themes.tint")}
            <Slider id={ids.tint} value={recipe.tint} onChange={(tint) => set({ tint })} />
            <span className={styles.ends} aria-hidden="true">
              <span>{t("settings.themes.tintNeutral")}</span>
              <span>{t("settings.themes.tintTinted")}</span>
            </span>
          </label>
          <p className={styles.help}>{t("settings.themes.adjusted")}</p>
        </div>
      </div>
      <div className={styles.actions}>
        <Button variant="primary" size="sm" disabled={busy} onClick={() => void save()}>
          {t("settings.themes.save")}
        </Button>
        <Button size="sm" onClick={onClose}>
          {t("settings.themes.cancel")}
        </Button>
        {theme && (
          <>
            <Button size="sm" onClick={() => void exportIt()}>
              {t("settings.themes.export")}
            </Button>
            <Button size="sm" onClick={() => void remove()}>
              {t(confirming ? "settings.themes.confirmDelete" : "settings.themes.delete")}
            </Button>
          </>
        )}
      </div>
      {status && (
        <p className={status.kind === "error" ? styles.warn : styles.help} role="status">
          {status.text}
        </p>
      )}
    </div>
  );
}
