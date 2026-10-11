import { useLayoutEffect, useRef, type CSSProperties, type PointerEvent } from "react";
import { useGlass } from "../../../design";
import { t } from "../../../i18n";
import { CATEGORY_IDS, CATEGORY_LABELS, type CategoryId } from "../categories";
import { MAX_SPARKS } from "./fanFloat";
import { SEGMENTS, type FanCardEls } from "./fanRender";
import styles from "./CategoryFan.module.css";

/** Hover of card i (pointer or keyboard focus); nx, ny = pointer over it, −1…1. */
export type FanHover = (i: number, on: boolean, nx?: number, ny?: number) => void;

interface Props {
  counts: Readonly<Record<CategoryId, number>>;
  /** Height of the active carousel card: the fan shares the carousel stage's box and centre. */
  slotH: number;
  /** Pivot of the fan below the cards' centre (px, art direction `categoryLink.pivot`). */
  pivot: number;
  /** Opacity of the theme gradient inside the glass. */
  fill: number;
  /** Blur of the fixed copy cross-faded in when a card leaves (0 = none, Eco). */
  blur: number;
  /** False while a sequence takes the fan away (no hover, no click, not focusable). */
  interactive: boolean;
  onPick: (category: CategoryId) => void;
  onHover: FanHover;
  /** Hands the elements of card i to the sequence director (null when it unmounts). */
  onCard: (i: number, els: FanCardEls | null) => void;
  fanRef: (el: HTMLDivElement | null) => void;
}

/**
 * The five categories in a fan (art direction round 3b, link A): glass cards turned 7° apart
 * around a pivot far below them, the middle one in front. Their pose is written by the sequence
 * director (linkDirector.ts / fanRender.ts), never by React: this renders once per category list.
 */
export function CategoryFan(props: Props) {
  const { counts, slotH, pivot, fill, blur, interactive, fanRef } = props;
  return (
    <div
      ref={fanRef}
      className={styles.fan}
      role="group"
      aria-label={t("home.fan.list")}
      inert={!interactive}
      style={
        { "--fan-fill": fill, "--fan-blur": `${blur}px`, "--slot-h": `${slotH}px` } as CSSProperties
      }
    >
      {CATEGORY_IDS.map((id, i) => (
        <FanCard
          key={id}
          i={i}
          id={id}
          count={counts[id]}
          pivot={pivot}
          blur={blur > 0}
          onPick={props.onPick}
          onHover={props.onHover}
          onCard={props.onCard}
        />
      ))}
    </div>
  );
}

function pointerOf(e: PointerEvent<HTMLElement>): [number, number] {
  const r = e.currentTarget.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return [0, 0];
  return [((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1];
}

function FanCard({
  i,
  id,
  count,
  pivot,
  blur,
  onPick,
  onHover,
  onCard,
}: {
  i: number;
  id: CategoryId;
  count: number;
  pivot: number;
  blur: boolean;
  onPick: (category: CategoryId) => void;
  onHover: FanHover;
  onCard: (i: number, els: FanCardEls | null) => void;
}) {
  const card = useRef<HTMLButtonElement | null>(null);
  const wrap = useRef<HTMLDivElement | null>(null);
  const lift = useRef<HTMLSpanElement | null>(null);
  const blurred = useRef<HTMLSpanElement | null>(null);
  useGlass(card, "card");
  useLayoutEffect(() => {
    if (!wrap.current || !card.current) return;
    onCard(i, {
      wrap: wrap.current,
      card: card.current,
      lift: lift.current,
      blurred: blurred.current,
      threads: [...(lift.current?.querySelectorAll<HTMLElement>("[data-thread]") ?? [])],
      sparks: [...(lift.current?.querySelectorAll<HTMLElement>("[data-spark]") ?? [])],
      heads: [...(lift.current?.querySelectorAll<HTMLElement>("[data-thread-head]") ?? [])],
      flash: lift.current?.querySelector<HTMLElement>("[data-flash]") ?? null,
    });
    return () => onCard(i, null);
  }, [i, onCard, blur]);
  const name = t(CATEGORY_LABELS[id]);
  const apps =
    count === 0
      ? t("home.fan.appsNone")
      : count === 1
        ? t("home.fan.appsOne")
        : t("home.fan.appsMany", { count });
  const face = (
    <>
      <span className={styles.fill} />
      <span className={styles.content}>
        <span className={styles.letter}>{name.slice(0, 1)}</span>
        <span className={styles.foot}>
          <span className={styles.name}>{name}</span>
          <span className={styles.count}>{apps}</span>
        </span>
      </span>
    </>
  );
  return (
    <div
      ref={wrap}
      className={styles.wrap}
      style={{ transformOrigin: `50% calc(50% + ${pivot}px)` }}
    >
      {/* The button is the still hit box (and the glass the engine draws from the pose); its
          picture inside lifts, so the pointer never loses the card it lifts. */}
      <button
        ref={card}
        type="button"
        className={styles.card}
        style={{ "--mix": `${(i / 4) * 100}%` } as CSSProperties}
        aria-label={t("home.fan.open", { name })}
        data-fan-card={id}
        onClick={() => onPick(id)}
        onPointerEnter={(e) => onHover(i, true, ...pointerOf(e))}
        onPointerMove={(e) => onHover(i, true, ...pointerOf(e))}
        onPointerLeave={() => onHover(i, false)}
        onFocus={() => onHover(i, true)}
        onBlur={() => onHover(i, false)}
      >
        <span ref={lift} className={styles.lift}>
          <span className={styles.clip} aria-hidden="true">
            <span className={styles.face}>{face}</span>
            {blur && (
              <span ref={blurred} className={styles.blurred}>
                {face}
              </span>
            )}
          </span>
          {/* Light threads (A then B, a few strokes each, A → B colours) and sparks: fanRender.ts. */}
          {Array.from({ length: 2 * SEGMENTS }, (_, k) => (
            <span
              key={`t${k}`}
              data-thread=""
              className={styles.thread}
              style={{ "--k": (k % SEGMENTS) / SEGMENTS } as CSSProperties}
              aria-hidden="true"
            />
          ))}
          <span data-flash="" className={styles.flash} aria-hidden="true" />
          <span data-thread-head="" className={styles.threadHead} aria-hidden="true" />
          <span
            data-thread-head=""
            className={styles.threadHead}
            style={{ "--k": 1 } as CSSProperties}
            aria-hidden="true"
          />
          {Array.from({ length: MAX_SPARKS }, (_, k) => (
            <span
              key={`s${k}`}
              data-spark=""
              className={styles.spark}
              style={{ "--k": k / (MAX_SPARKS - 1) } as CSSProperties}
              aria-hidden="true"
            />
          ))}
        </span>
      </button>
    </div>
  );
}

/** "Choose a universe / What do you want to launch?", faded with the fan by the director. */
export function FanTitle({
  askRef,
  shown,
}: {
  askRef: (el: HTMLElement | null) => void;
  shown: boolean;
}) {
  return (
    <div ref={askRef} className={styles.ask} aria-hidden={!shown || undefined}>
      <div className={styles.askLabel}>{t("home.fan.label")}</div>
      <h1 className={styles.askTitle}>{t("home.fan.title")}</h1>
    </div>
  );
}
