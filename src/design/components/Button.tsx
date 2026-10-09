import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** `primary` = accent fill (one per group), `soft` = translucent fill. */
  variant?: "primary" | "soft";
  size?: "md" | "sm";
}

export function Button({
  variant = "soft",
  size = "md",
  className,
  type = "button",
  ...rest
}: Props) {
  const cls = [styles.button, styles[variant], styles[size], className].filter(Boolean).join(" ");
  return <button {...rest} type={type} className={cls} />;
}
