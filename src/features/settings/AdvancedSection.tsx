import { useId, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { ChevronDownIcon } from "../../design/icons";
import { useMotionTokens } from "../../design/motion/current";
import { usePresence } from "../../design/motion/usePresence";
import type { CardHoverStyle, FloatName } from "../../design/motion/tokens5";
import { useReducedMotion } from "../../fx/useReducedMotion";
import { t } from "../../i18n";
import type {
  Elasticity,
  OpeningStyle,
  SettingsPatch,
  ThemeTransition,
  WidgetUnroll,
} from "../../ipc/bindings";
import { hubStore, useHub } from "../../store";
import { closeSteps, foldMs, openSteps, type Step } from "./advancedUnroll";
import { ChoiceRow, ToggleRow } from "./SettingRow";
import styles from "./Settings.module.css";

interface Props {
  /** What follows the section (slides down / up with it). */
  below: RefObject<HTMLElement | null>;
}

const opts = <T extends string>(key: string, values: readonly T[]) =>
  values.map((value) => ({
    value,
    label: t(`settings.visual.advanced.${key}.${value}` as Parameters<typeof t>[0]),
  }));

/**
 * « Personnalisation avancée » (R5-Personnalisation.txt): folded by default, a header row that opens
 * a small bouncing drop-down (advancedUnroll.ts). Each choice writes the settings; userDa.ts turns
 * them into the art direction's variants.
 */
export function AdvancedSection({ below }: Props) {
  const settings = useHub((s) => s.settings);
  const eco = useHub((s) => s.settings?.quality === "eco");
  const reduced = useReducedMotion();
  const speed = useMotionTokens().speed;
  const [open, setOpen] = useState(false);
  const presence = usePresence(open, reduced ? 0 : foldMs(speed));
  const regionId = useId();
  const box = useRef<HTMLDivElement>(null);
  const chevron = useRef<HTMLSpanElement>(null);
  const beforeTop = useRef<number | null>(null);
  const height = useRef(0);

  useLayoutEffect(() => {
    const region = box.current;
    const els = {
      hull: region?.querySelector<HTMLElement>("[data-adv=hull]") ?? null,
      inner: region?.querySelector<HTMLElement>("[data-adv=inner]") ?? null,
      content: region?.querySelector<HTMLElement>("[data-adv=content]") ?? null,
      halo: region?.querySelector<HTMLElement>("[data-adv=halo]") ?? null,
      chevron: chevron.current,
      below: below.current,
    };
    const rows = [...(region?.querySelectorAll<HTMLElement>("[data-row]") ?? [])];
    const all = [...Object.values(els), ...rows].filter((e): e is HTMLElement => e !== null);
    for (const el of all) for (const a of el.getAnimations()) a.cancel();
    const before = beforeTop.current;
    beforeTop.current = null;
    if (reduced || before === null) return;
    const play = (steps: Step[]) => {
      for (const s of steps) {
        const el = typeof s.target === "string" ? els[s.target] : rows[s.target.row];
        el?.animate(s.keyframes, s.options);
      }
    };
    if (presence === "in" && region) {
      height.current = region.offsetHeight;
      const dy = (below.current?.getBoundingClientRect().top ?? before) - before;
      play(openSteps(rows.length, dy, eco, speed));
    } else if (presence === "out") {
      play(closeSteps(height.current, speed));
    }
    // `presence` alone drives it: a re-render for another reason must not replay anything.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presence]);

  if (!settings) return null;
  const set = (patch: SettingsPatch) => void hubStore.getState().setSettings(patch);

  function toggle() {
    beforeTop.current = below.current?.getBoundingClientRect().top ?? 0;
    setOpen((o) => !o);
  }

  return (
    <div className={styles.advanced}>
      <button
        type="button"
        className={styles.advancedHead}
        aria-expanded={open}
        aria-controls={regionId}
        onClick={toggle}
      >
        <span>{t("settings.visual.advanced.label")}</span>
        <span ref={chevron} className={styles.chevron} aria-hidden="true">
          <ChevronDownIcon />
        </span>
      </button>
      {presence !== null && (
        <div
          ref={box}
          id={regionId}
          role="region"
          aria-label={t("settings.visual.advanced.label")}
          className={styles.region}
          inert={presence === "out"}
        >
          <div className={styles.halo} data-adv="halo" aria-hidden="true" />
          <div className={styles.hull} data-adv="hull" aria-hidden="true">
            <div className={styles.hullInner} data-adv="inner" />
          </div>
          <div className={styles.content} data-adv="content">
            <ChoiceRow<FloatName>
              label={t("settings.visual.advanced.float.label")}
              value={settings.cardFloat}
              onChange={(cardFloat) => set({ cardFloat })}
              options={opts("float", ["none", "light", "visible", "strong"] as const)}
            />
            <ChoiceRow<OpeningStyle>
              label={t("settings.visual.advanced.opening.label")}
              value={settings.openingStyle}
              onChange={(openingStyle) => set({ openingStyle })}
              options={opts("opening", ["pulse", "classic", "none"] as const)}
            />
            <ChoiceRow<ThemeTransition>
              label={t("settings.visual.advanced.themeChange.label")}
              value={settings.themeTransition}
              onChange={(themeTransition) => set({ themeTransition })}
              options={opts("themeChange", ["wave", "fade", "direct"] as const)}
            />
            <ChoiceRow<WidgetUnroll>
              label={t("settings.visual.advanced.widgetUnroll.label")}
              value={settings.widgetUnroll}
              onChange={(widgetUnroll) => set({ widgetUnroll })}
              options={opts("widgetUnroll", ["unroll", "sober"] as const)}
            />
            <ChoiceRow<Elasticity>
              label={t("settings.visual.advanced.widgetSpring.label")}
              value={settings.widgetSpring}
              onChange={(widgetSpring) => set({ widgetSpring })}
              options={opts("widgetSpring", ["soft", "normal", "strong"] as const)}
            />
            <ChoiceRow<CardHoverStyle>
              label={t("settings.visual.advanced.cardHover.label")}
              value={settings.cardHover}
              onChange={(cardHover) => set({ cardHover })}
              options={opts("cardHover", ["full", "simple", "none"] as const)}
            />
            <ToggleRow
              label={t("settings.visual.advanced.bokeh")}
              checked={settings.bokeh}
              onChange={(bokeh) => set({ bokeh })}
            />
            <ToggleRow
              label={t("settings.visual.advanced.particles")}
              checked={settings.particles}
              onChange={(particles) => set({ particles })}
            />
            <ToggleRow
              label={t("settings.visual.advanced.cursorLight")}
              checked={settings.cursorLight}
              onChange={(cursorLight) => set({ cursorLight })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
