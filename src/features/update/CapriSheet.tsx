import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { burst, type Edge } from "../capri/capri";
import { useReducedMotion } from "../../fx/useReducedMotion";
import styles from "./CapriSheet.module.css";

interface Props {
  open: boolean;
  eyebrow: string;
  title: string;
  /** Under the title (the versions, the date…). */
  sub?: ReactNode;
  points: readonly string[];
  primary: string;
  onPrimary: () => void;
  secondary?: string;
  onSecondary?: () => void;
  /** Escape or a click next to it (not while `busy`). */
  onClose: () => void;
  busy?: boolean;
  /** Under the points: a progress bar, an error, a help line. */
  footer?: ReactNode;
}

/** The card's width (CSS) and how far the Capri spikes reach out of its top edge. */
const WIDTH = 500;
const REACH = 90;
/** A burst as it opens, then a small one now and then while it is open. */
const FIRST_MS = 900;
const AGAIN_MS = 2600;
const SMALL_MS = 420;

/**
 * Step 20: a page of patch notes in the Capri look (the update found, or what is new after
 * one): a black card outlined in violet, Capri spikes bursting from its top edge as it opens and
 * now and then, its title tearing into red and green, the notes with shard bullets, one big
 * button at the bottom. Timers only while it is open; none with « reduce motion ».
 */
export function CapriSheet(p: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const reduced = useReducedMotion();
  const id = useId();
  const { open, busy, onClose } = p;

  useEffect(() => {
    if (!open) return;
    primary.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  useEffect(() => {
    const c = canvas.current;
    if (!open || reduced || !c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = WIDTH + 2 * REACH;
    c.width = Math.round(w * dpr);
    c.height = Math.round(2 * REACH * dpr);
    const top: Edge = {
      vertical: false,
      at: REACH,
      from: REACH + 30,
      to: w - REACH - 30,
      sides: 0,
    };
    // After the first burst, the spikes only go up, out of the card: its text stays clear.
    const up: Edge = { ...top, sides: -1 };
    const stops: (() => void)[] = [];
    const tear = (ms: number) => {
      title.current?.classList.add(styles.tearing ?? "");
      window.setTimeout(() => title.current?.classList.remove(styles.tearing ?? ""), ms);
    };
    stops.push(burst(c, [top], FIRST_MS));
    tear(FIRST_MS);
    const again = window.setInterval(() => {
      stops.push(burst(c, [up], SMALL_MS));
      tear(SMALL_MS);
    }, AGAIN_MS);
    return () => {
      window.clearInterval(again);
      stops.forEach((s) => s());
    };
  }, [open, reduced]);

  if (!open) return null;
  return (
    <div className={styles.backdrop} onMouseDown={() => !busy && onClose()}>
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <canvas ref={canvas} className={styles.fx} aria-hidden="true" />
        <p className={styles.eyebrow}>{p.eyebrow}</p>
        <h2 ref={title} id={id} className={styles.title} data-text={p.title}>
          {p.title}
        </h2>
        {p.sub && <div className={styles.sub}>{p.sub}</div>}
        {p.points.length > 0 && (
          <ul className={styles.points}>
            {p.points.map((pt) => (
              <li key={pt}>{pt}</li>
            ))}
          </ul>
        )}
        {p.footer}
        {!busy && (
          <div className={styles.actions}>
            {p.secondary && (
              <button type="button" className={styles.later} onClick={p.onSecondary}>
                {p.secondary}
              </button>
            )}
            <button ref={primary} type="button" className={styles.go} onClick={p.onPrimary}>
              <span data-text={p.primary}>{p.primary}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
