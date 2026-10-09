import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./IconButton.module.css";

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> {
  /** Accessible name (required: there is no visible text). */
  label: string;
  size?: "md" | "sm";
  children: ReactNode;
}

export function IconButton({
  label,
  size = "md",
  className,
  type = "button",
  children,
  ...rest
}: Props) {
  const cls = [styles.button, styles[size], className].filter(Boolean).join(" ");
  return (
    <button {...rest} type={type} aria-label={label} className={cls}>
      {children}
    </button>
  );
}
