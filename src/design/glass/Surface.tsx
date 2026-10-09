import { useLayoutEffect, useRef } from "react";
import type { CSSProperties, HTMLAttributes } from "react";
import { acquireBackdrop, releaseBackdrop } from "./backdropBudget";
import styles from "./Surface.module.css";

type Tag = "div" | "span" | "section" | "nav" | "header" | "footer" | "aside";

interface Props extends HTMLAttributes<HTMLElement> {
  as?: Tag;
  /** CSS radius, default `var(--radius-2xl)`. */
  radius?: string;
  /** Never use backdrop-filter (small or nested surfaces); same look as the Eco variant. */
  flat?: boolean;
}

/**
 * Liquid-glass surface (`.lg` recipe of DESIGN.md).
 * Flat by default; once mounted it asks for one of the 6 backdrop-filter slots and, if it gets one,
 * sets `data-blur` on itself (before paint). Eco quality is handled in CSS through `data-quality`.
 */
export function Surface({
  as: Tag = "div",
  radius,
  flat = false,
  className,
  style,
  ...rest
}: Props) {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || flat || !acquireBackdrop()) return;
    el.dataset.blur = "";
    return () => {
      releaseBackdrop();
      delete el.dataset.blur;
    };
  }, [flat]);

  const inline: CSSProperties = { ...(radius ? { borderRadius: radius } : null), ...style };
  const cls = [styles.glass, className].filter(Boolean).join(" ");
  return <Tag {...rest} ref={ref as never} className={cls} style={inline} />;
}
