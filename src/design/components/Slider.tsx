import type { CSSProperties, InputHTMLAttributes } from "react";
import styles from "./Slider.module.css";

interface Props extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange" | "min" | "max" | "step"
> {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

/** Native range input (free keyboard + screen-reader support), styled like the mock-up. */
export function Slider({
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  className,
  style,
  ...rest
}: Props) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const inline = { "--fill": `${pct}%`, ...style } as CSSProperties;
  return (
    <input
      {...rest}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      style={inline}
      className={[styles.slider, className].filter(Boolean).join(" ")}
      onChange={(e) => onChange(e.currentTarget.valueAsNumber)}
    />
  );
}
