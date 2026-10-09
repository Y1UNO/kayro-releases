import type { ButtonHTMLAttributes } from "react";
import styles from "./Toggle.module.css";

interface Props extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange" | "role" | "aria-checked"
> {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** Switch (`role="switch"`). Give it an accessible name with `aria-label` or `aria-labelledby`. */
export function Toggle({ checked, onChange, className, type = "button", ...rest }: Props) {
  return (
    <button
      {...rest}
      type={type}
      role="switch"
      aria-checked={checked}
      className={[styles.toggle, checked ? styles.on : "", className].filter(Boolean).join(" ")}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.thumb} />
    </button>
  );
}
