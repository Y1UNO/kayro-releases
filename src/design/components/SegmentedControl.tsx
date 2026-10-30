import { playSound } from "../../sound/engine";
import { useRef } from "react";
import type { KeyboardEvent } from "react";
import { SelectionPill } from "../glass/SelectionPill";
import styles from "./SegmentedControl.module.css";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name of the group. */
  label: string;
  size?: "md" | "sm";
  /** Shown but not usable (a feature that arrives in a later step). */
  disabled?: boolean;
  className?: string;
  /** Liquid glass selection pill (drawn by the glass engine when it runs). */
  glassPill?: boolean;
}

/** Radio group rendered as segments. Roving tabindex: Tab enters once, arrows move and select. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
  disabled = false,
  className,
  glassPill = false,
}: Props<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = options.length - 1;
    let next: number;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = index === last ? 0 : index + 1;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = index === 0 ? last : index - 1;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = last;
        break;
      default:
        return;
    }
    e.preventDefault();
    const target = options[next];
    if (!target) return;
    playSound("select", { degree: next });
    onChange(target.value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={[styles.group, styles[size], className].filter(Boolean).join(" ")}
      data-hole-host=""
    >
      {glassPill && <SelectionPill value={value} selector='[aria-checked="true"]' />}
      {options.map((opt, i) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            className={[styles.segment, selected ? styles.selected : ""].filter(Boolean).join(" ")}
            onClick={() => {
              if (!selected) playSound("select", { degree: i });
              onChange(opt.value);
            }}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
