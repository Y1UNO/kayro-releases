import type { ButtonHTMLAttributes } from "react";
import styles from "./Chip.module.css";

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-pressed"> {
  selected?: boolean;
}

/** Filter / category chip: a toggle button (`aria-pressed`). */
export function Chip({ selected = false, className, type = "button", ...rest }: Props) {
  const cls = [styles.chip, selected ? styles.selected : "", className].filter(Boolean).join(" ");
  return <button {...rest} type={type} aria-pressed={selected} className={cls} />;
}
