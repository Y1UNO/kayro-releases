import { playSound } from "../../sound";
import { useCallback, useEffect, useLayoutEffect, useRef, type Ref } from "react";
import type { AppEntry } from "../../ipc/bindings";
import { t } from "../../i18n";
import { EditIcon, useGlass } from "../../design";
import { markGlassDirtyFor } from "../../design/glass/glassRegistry";
import { usePosterUrl } from "./art";
import { IconFace } from "../gameColors/IconFace";
import { faceMixOf, monogram, shadeOf } from "./cardLook";
import { currentMotion } from "../../design/motion/current";
import { durOf } from "../../design/motion/tokens";
import { prefersReducedMotion } from "../../fx/motionPref";
import { useHub } from "../../store";
import { DEFAULT_GEOMETRY, isVisible, slotOffset, type Geometry } from "./carouselGeometry";
import { cssVars } from "./cssVars";
import { useAppIcon } from "./useAppIcon";
import { cardTilt } from "./cardTilt";
import fail from "./LaunchFail.module.css";
import styles from "./AppCard.module.css";
import face from "./AppCardFace.module.css";

/** Forwards an element to a ref received as a prop (callback or object). */
function assignRef<T>(ref: Ref<T> | undefined, value: T): void {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

interface Props {
  app: AppEntry;
  /** `stage` = carousel slot placed from `d`, `grid` = plain grid cell. */
  mode: "stage" | "grid";
  /** Carousel only: distance to the active card (negative = left). */
  d?: number;
  /** Carousel only: card sizes (art direction). */
  geometry?: Geometry;
  active: boolean;
  running: boolean;
  /** DOM id, referenced by the list's `aria-activedescendant`. */
  domId: string;
  onClick: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
}

/**
 * Poster card. Carousel: a fixed-size slot moved by `translate`, the card inside is shrunk by
 * `scale` when it is not the active one (see carouselGeometry.ts); a veil dims the others and a
 * separate glow lights the active one, so that only transform and opacity ever change.
 */
export function AppCard({
  app,
  mode,
  d = 0,
  geometry = DEFAULT_GEOMETRY,
  active,
  running,
  domId,
  onClick,
  buttonRef,
}: Props) {
  const cardRef = useRef<HTMLButtonElement | null>(null);
  useGlass(cardRef, "card");
  // The same card can show another app (tab change, round 3b): its tint is read again.
  useLayoutEffect(() => {
    if (cardRef.current) markGlassDirtyFor(cardRef.current);
  }, [app.id]);
  const setCard = useCallback(
    (el: HTMLButtonElement | null) => {
      cardRef.current = el;
      assignRef(buttonRef, el);
    },
    [buttonRef],
  );
  // Round 4b: its launch failed. It shakes once (5 px, then 3 px), its edge stays soft red while
  // the message is shown; with "reduce motion", only the edge.
  const failed = useHub((s) => (s.failedApp === app.id ? s.lastError : null));
  useEffect(() => {
    const el = cardRef.current;
    if (!failed || !el) return;
    const t = currentMotion();
    const ms = durOf(t, 2, "court", prefersReducedMotion()) && t.states.shakeMs;
    if (ms <= 0) return;
    const [a, b] = t.states.shake;
    const x = (px: number) => ({ transform: `translateX(${px}px)` });
    // Added to the card's own transform (the carousel's scale stays).
    el.animate([x(0), x(-a), x(a), x(-b), x(b), x(0)], { duration: ms, composite: "add" });
  }, [failed]);
  const poster = usePosterUrl(app);
  const icon = useAppIcon(app);
  // A card without a picture takes its icon's colours (V10 b). With a poster, the active card shows
  // its name in small plain type (2026-10-30: the poster's own title made the logo a double).
  const onPoster = Boolean(poster && mode === "stage");
  const stage = mode === "stage";
  const hidden = stage && !isVisible(d);
  const vars = cssVars({
    "--k": shadeOf(app.id),
    ...(stage ? { "--x": `${slotOffset(d, geometry)}px` } : null),
  });

  return (
    <div
      className={stage ? styles.slot : styles.cell}
      style={vars}
      data-app-id={app.id}
      data-mode={mode}
      data-d={stage ? d : undefined}
      data-active={active || undefined}
      data-hidden={hidden ? "" : undefined}
    >
      {stage && <span className={styles.glow} data-glow="" aria-hidden="true" />}
      {/* Floating box (round 5, carouselFloat.ts): the card and its edit button rise together. */}
      <div className={styles.float} data-float={stage ? "" : undefined}>
        <button
          ref={setCard}
          id={domId}
          type="button"
          role="option"
          aria-selected={active}
          className={styles.card}
          aria-label={running ? `${app.name}, ${t("home.running")}` : app.name}
          // Read by the glass engine: it may draw this poster as a texture (round 2b).
          data-poster={poster ?? undefined}
          data-stage={stage ? "" : undefined}
          tabIndex={-1}
          onClick={onClick}
          onPointerEnter={() => playSound("hover", { degree: (d ?? 0) + 2 })}
          {...cardTilt}
        >
          {poster ? (
            <>
              {/* Decorative: the button's own label already names the app (empty alt, not text). */}
              <img
                className={face.poster}
                src={poster}
                alt={""}
                draggable={false}
                decoding="async"
              />
              <span className={face.posterShade} />
            </>
          ) : (
            // Round 5: the theme's A → B face (step 14: or its icon's colours); A → B: a draw per app.
            <IconFace id={app.id} mix={faceMixOf(app.id)} className={face.face} />
          )}
          {stage && <span className={styles.veil} aria-hidden="true" />}
          {!poster && icon && (
            // Decorative like the poster: the button's label names the app.
            <img
              className={face.icon}
              data-face=""
              src={icon}
              alt={""}
              draggable={false}
              decoding="async"
            />
          )}
          {!poster && !icon && (
            <span className={face.letter} data-face="" aria-hidden="true">
              {monogram(app.name)}
            </span>
          )}
          <span className={styles.sheen} data-pointer-sheen="" aria-hidden="true" />
          {running && <span className={styles.running} aria-hidden="true" />}
          <span className={fail.ring} data-on={failed ? "" : undefined} aria-hidden="true" />
          <span
            className={onPoster ? `${styles.plate} ${styles.onPoster}` : styles.plate}
            data-face=""
          >
            {app.name}
          </span>
        </button>
        {/* Mouse shortcut; the keyboard has F2 and the context-menu key (see HomeScreen). */}
        <button
          type="button"
          className={styles.edit}
          data-edit-app={app.id}
          tabIndex={-1}
          aria-label={t("home.menu.editButton", { name: app.name })}
        >
          <EditIcon size={16} />
        </button>
      </div>
    </div>
  );
}
