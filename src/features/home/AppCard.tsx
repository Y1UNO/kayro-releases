import { useCallback, useRef, type Ref } from "react";
import type { AppEntry } from "../../ipc/bindings";
import { t } from "../../i18n";
import { EditIcon, useGlass } from "../../design";
import { posterUrl } from "./art";
import { monogram, shadeOf } from "./cardLook";
import { useDa } from "../../design/da";
import { DEFAULT_GEOMETRY, isVisible, slotOffset, type Geometry } from "./carouselGeometry";
import { cssVars } from "./cssVars";
import { Shine } from "./Shine";
import { useAppIcon } from "./useAppIcon";
import { cardTilt } from "./cardTilt";
import styles from "./AppCard.module.css";

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
  const setCard = useCallback(
    (el: HTMLButtonElement | null) => {
      cardRef.current = el;
      assignRef(buttonRef, el);
    },
    [buttonRef],
  );
  const poster = posterUrl(app);
  const shine = useDa((s) => s.values.shine?.on === true);
  const icon = useAppIcon(app);
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
      data-active={active || undefined}
      data-hidden={hidden ? "" : undefined}
    >
      {stage && <span className={styles.glow} aria-hidden="true" />}
      <button
        ref={setCard}
        id={domId}
        type="button"
        role="option"
        aria-selected={active}
        className={styles.card}
        aria-label={running ? `${app.name}, ${t("home.running")}` : app.name}
        tabIndex={-1}
        onClick={onClick}
        {...cardTilt}
      >
        {poster ? (
          <>
            {/* Decorative: the button's own label already names the app (empty alt, not text). */}
            <img
              className={styles.poster}
              src={poster}
              alt={""}
              draggable={false}
              decoding="async"
            />
            <span className={styles.posterShade} />
          </>
        ) : null}
        {stage && <span className={styles.veil} aria-hidden="true" />}
        {!poster && icon && (
          // Decorative like the poster: the button's label names the app.
          <img className={styles.icon} src={icon} alt={""} draggable={false} decoding="async" />
        )}
        {!poster && !icon && (
          <span className={styles.letter} aria-hidden="true">
            {monogram(app.name)}
          </span>
        )}
        <span className={styles.sheen} aria-hidden="true" />
        {shine && active && stage && <Shine />}
        {running && <span className={styles.running} aria-hidden="true" />}
        <span className={styles.plate}>{app.name}</span>
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
  );
}
