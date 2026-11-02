import { useId, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { ChevronDownIcon } from "../../design/icons";
import { useMotionTokens } from "../../design/motion/current";
import { usePresence } from "../../design/motion/usePresence";
import { ADVANCED_UNROLL } from "../../design/motion/tokens5";
import type { CardHoverStyle, FloatName } from "../../design/motion/tokens5";
import { isEco } from "../../design/quality";
import { useReducedMotion } from "../../fx/useReducedMotion";
import { t } from "../../i18n";
import type {
  ColorCharacter,
  ColorIntensity,
  ColorPassage,
  ColorPick,
  ColorTrigger,
  Elasticity,
  OpeningStyle,
  SettingsPatch,
  ThemeTransition,
  WidgetUnroll,
} from "../../ipc/bindings";
import { hubStore, useHub } from "../../store";
import { closeSteps, foldMs, openSteps, revealScroll, type Step } from "./advancedUnroll";
import { ChoiceRow, ToggleRow } from "./SettingRow";
import styles from "./Settings.module.css";

interface Props {
  /** What follows the section (slides down / up with it). */
  below: RefObject<HTMLElement | null>;
}

/** The panel that scrolls and how far, to show the opened section (review A1); null: it stays. */
function revealBy(head: HTMLElement | null, end: HTMLElement | null) {
  const scroller = head?.closest<HTMLElement>("[role=tabpanel]");
  if (!head || !end || !scroller) return null;
  const view = scroller.getBoundingClientRect();
  const top = revealScroll({
    viewTop: view.top,
    viewBottom: view.bottom,
    headTop: head.getBoundingClientRect().top,
    endBottom: end.getBoundingClientRect().bottom,
  });
  return top > 0 ? { scroller, top } : null;
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
  const eco = useHub((s) => isEco(s.settings?.quality));
  const reduced = useReducedMotion();
  const { speed, style } = useMotionTokens();
  const crisp = style === "crisp";
  const [open, setOpen] = useState(false);
  const presence = usePresence(open, reduced ? 0 : foldMs(speed));
  const regionId = useId();
  const box = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLButtonElement>(null);
  const chevron = useRef<HTMLSpanElement>(null);
  const beforeTop = useRef<number | null>(null);
  const height = useRef(0);

  useLayoutEffect(() => {
    const region = box.current;
    const before = beforeTop.current;
    beforeTop.current = null;
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
    if (before === null) return;
    // Opened by a click: the panel will scroll so that the drop-down is seen (review A1),
    // measured now that nothing is moved by an animation.
    const by = presence === "in" ? revealBy(head.current, below.current ?? region) : null;
    const play = (steps: Step[]) => {
      for (const s of steps) {
        const el = typeof s.target === "string" ? els[s.target] : rows[s.target.row];
        el?.animate(s.keyframes, s.options);
      }
    };
    // Reduced motion: nothing moves, only the scroll (at once).
    if (!reduced && presence === "in" && region) {
      height.current = region.offsetHeight;
      const dy = (below.current?.getBoundingClientRect().top ?? before) - before;
      play(openSteps(rows.length, dy, eco, speed, crisp));
    } else if (!reduced && presence === "out") {
      play(closeSteps(height.current, speed));
    }
    if (by) by.scroller.scrollBy({ top: by.top, behavior: reduced ? "auto" : "smooth" });
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
        ref={head}
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
          <div
            className={styles.halo}
            style={{ opacity: ADVANCED_UNROLL.haloAlpha }}
            data-adv="halo"
            aria-hidden="true"
          />
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
            {/* Step 14: the game colours (defaults = the board of 14/10). */}
            <ChoiceRow<ColorIntensity>
              label={t("settings.visual.advanced.colorIntensity.label")}
              value={settings.colorIntensity}
              onChange={(colorIntensity) => set({ colorIntensity })}
              options={opts("colorIntensity", ["soft", "normal", "strong"] as const)}
            />
            <ChoiceRow<ColorCharacter>
              label={t("settings.visual.advanced.colorCharacter.label")}
              value={settings.colorCharacter}
              onChange={(colorCharacter) => set({ colorCharacter })}
              options={opts("colorCharacter", ["theme", "faithful", "vivid"] as const)}
            />
            <ChoiceRow<ColorPick>
              label={t("settings.visual.advanced.colorPick.label")}
              value={settings.colorPick}
              onChange={(colorPick) => set({ colorPick })}
              options={opts("colorPick", ["dominant", "vivid", "theme"] as const)}
            />
            <ChoiceRow<ColorPassage>
              label={t("settings.visual.advanced.colorPassage.label")}
              value={settings.colorPassage}
              onChange={(colorPassage) => set({ colorPassage })}
              options={opts("colorPassage", ["tide", "fade", "direct"] as const)}
            />
            <ChoiceRow<ColorTrigger>
              label={t("settings.visual.advanced.colorTrigger.label")}
              value={settings.colorTrigger}
              onChange={(colorTrigger) => set({ colorTrigger })}
              options={opts("colorTrigger", ["select", "instant", "launch"] as const)}
            />
            <ToggleRow
              label={t("settings.visual.advanced.colorFromIcon")}
              checked={settings.colorFromIcon}
              onChange={(colorFromIcon) => set({ colorFromIcon })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
