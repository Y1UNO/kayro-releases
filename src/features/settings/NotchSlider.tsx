import { useState } from "react";
import type { CSSProperties } from "react";
import styles from "./NotchSlider.module.css";

interface Props {
  value: number;
  min: number;
  max: number;
  /** One notch. */
  step: number;
  disabled?: boolean;
  labelledBy: string;
  /** The value as read (« 1,5 s »). */
  format: (value: number) => string;
  /** Released (pointer up, a key let go): saved. */
  onCommit: (value: number) => void;
}

/**
 * « Cacher l'île » (2026-11-02): a slider in notches. Its thumb glides from notch to notch on a
 * spring, swells like a drop when hovered and held (squashed, stretched, then still), and
 * wobbles at each notch it reaches. A native range input on top keeps the keyboard and the
 * screen readers; « reduce motion » keeps none of the bounces.
 */
export function NotchSlider({
  value,
  min,
  max,
  step,
  disabled,
  labelledBy,
  format,
  onCommit,
}: Props) {
  // While dragging (or a key held), the value under the pointer; otherwise the saved one.
  const [drag, setDrag] = useState<number | null>(null);
  const local = drag ?? value;
  const notches = Math.max(1, Math.round((max - min) / step));
  const ratio = max > min ? Math.min(1, Math.max(0, (local - min) / (max - min))) : 0;
  const at = Math.round(ratio * notches);
  const commit = () => {
    if (drag !== null && drag !== value) onCommit(drag);
    setDrag(null);
  };

  return (
    <div className={styles.wrap} data-disabled={disabled || undefined}>
      <div
        className={styles.track}
        data-live={drag !== null || undefined}
        style={{ "--ratio": ratio } as CSSProperties}
      >
        <span className={styles.rail} aria-hidden="true" />
        <span className={styles.lane} aria-hidden="true">
          {Array.from({ length: notches + 1 }, (_, i) => (
            <span
              key={i}
              className={styles.notch}
              data-lit={i <= at || undefined}
              style={{ "--at": i / notches } as CSSProperties}
            />
          ))}
          <span className={styles.thumb}>
            <span className={styles.swell}>
              {/* A new one at each notch: its wobble plays again. */}
              <span key={at} className={styles.blob} />
            </span>
          </span>
        </span>
        <input
          className={styles.range}
          type="range"
          min={min}
          max={max}
          step={step}
          value={local}
          disabled={disabled}
          aria-labelledby={labelledBy}
          aria-valuetext={format(local)}
          onChange={(e) => setDrag(e.currentTarget.valueAsNumber)}
          onPointerUp={commit}
          onBlur={commit}
          onKeyUp={(e) => {
            if (e.key.startsWith("Arrow") || e.key.startsWith("Page")) commit();
            else if (e.key === "Home" || e.key === "End") commit();
          }}
        />
      </div>
      <span className={styles.value}>{format(local)}</span>
    </div>
  );
}
