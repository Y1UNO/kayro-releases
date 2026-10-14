import { useMemo } from "react";
import { SegmentedControl, themeGradient, useTheme } from "../../design";
import { t } from "../../i18n";
import type { AppColors, AppEntry } from "../../ipc/bindings";
import { hexToLab, labToHex } from "../../lib/oklab";
import { hubStore, useArt, useHub } from "../../store";
import { DEFAULT_CHOICE, deriveGameColors, gamePair } from "./derive";
import { sourceOf } from "./useGameColors";
import styles from "./AppLook.module.css";

type Mode = AppColors["mode"];
const MODES = ["auto", "chosen", "theme"] as const satisfies readonly Mode[];
/** At most this many colours offered (the core gives 6 per picture). */
const MAX_SWATCHES = 12;

/** Saves the app's choice at once (the dialog's form keeps the rest of the entry). */
function save(app: AppEntry, colors: AppColors | null): void {
  const latest = hubStore.getState().apps.find((a) => a.id === app.id) ?? app;
  void hubStore.getState().updateApp({ ...latest, colors });
}

function Swatches(props: {
  label: string;
  colors: readonly string[];
  value: string;
  onPick: (hex: string) => void;
}) {
  return (
    <div className={styles.swatchRow} role="radiogroup" aria-label={props.label}>
      <span className={styles.swatchLabel}>{props.label}</span>
      {props.colors.map((hex) => (
        <button
          key={hex}
          type="button"
          role="radio"
          aria-checked={hex === props.value}
          aria-label={hex}
          className={styles.swatch}
          style={{ background: hex }}
          onClick={() => props.onPick(hex)}
        />
      ))}
    </div>
  );
}

/**
 * Step 14, edit dialog: the app's colours. « Automatiques »: its pictures' palette; « Choisies »:
 * two colours picked among the palette's (bounded and mixed with the theme like the others);
 * « Thème »: never tinted. The preview shows what the home will take.
 */
export function AppColorsChoice({ app }: { app: AppEntry }) {
  const { theme } = useTheme();
  const settings = useHub((s) => s.settings);
  const own = useHub((s) => s.apps.find((a) => a.id === app.id)?.colors ?? null);
  const palettes = useArt((s) => s.palettes[app.id]);
  const mode: Mode = own?.mode ?? "auto";
  const source = sourceOf(palettes, true);

  const offered = useMemo(() => {
    const all = (palettes ?? []).flatMap((p) => p.palette.colors.map((c) => c.hex));
    return [...new Set(all)].slice(0, MAX_SWATCHES);
  }, [palettes]);

  const choice = {
    intensity: settings?.colorIntensity ?? DEFAULT_CHOICE.intensity,
    character: settings?.colorCharacter ?? DEFAULT_CHOICE.character,
    pick: settings?.colorPick ?? DEFAULT_CHOICE.pick,
  };
  const shown = deriveGameColors(theme, source, settings?.colorMode ?? "light", choice, own);
  const [ta, tb] = themeGradient(theme);

  function choose(next: Mode) {
    if (next === "auto") return save(app, null);
    if (next === "theme") return save(app, { mode: "theme" });
    if (own?.mode === "chosen" || !source) return;
    // Starts from the automatic pair, which the user then changes.
    const [a, b] = gamePair(source, hexToLab(tb), "dominant").map(labToHex);
    save(app, { mode: "chosen", a: a!, b: b! });
  }

  return (
    <div className={styles.colors}>
      <SegmentedControl<Mode>
        label={t("addApps.look.colors")}
        size="sm"
        value={mode}
        onChange={choose}
        options={MODES.map((m) => ({
          value: m,
          label: t(`addApps.look.${m}`),
          disabled: m === "chosen" && !source,
        }))}
      />
      {own?.mode === "chosen" && (
        <>
          <Swatches
            label={t("addApps.look.colorA")}
            colors={offered}
            value={own.a}
            onPick={(a) => save(app, { ...own, a })}
          />
          <Swatches
            label={t("addApps.look.colorB")}
            colors={offered}
            value={own.b}
            onPick={(b) => save(app, { ...own, b })}
          />
        </>
      )}
      {!source && mode !== "theme" && <p className={styles.help}>{t("addApps.look.noPalette")}</p>}
      <div
        className={styles.preview}
        role="img"
        aria-label={t("addApps.look.preview")}
        style={{ background: `linear-gradient(90deg, ${shown?.a ?? ta}, ${shown?.b ?? tb})` }}
      />
    </div>
  );
}
