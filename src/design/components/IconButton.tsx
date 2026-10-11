import { useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useGlass } from "../glass/glassRegistry";
import styles from "./IconButton.module.css";

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> {
  /** Accessible name (required: there is no visible text). */
  label: string;
  size?: "md" | "sm";
  children: ReactNode;
  /** Round liquid-glass button (drawn by the glass engine when it runs). */
  glass?: boolean;
}

export function IconButton({
  label,
  size = "md",
  className,
  type = "button",
  children,
  glass = false,
  ...rest
}: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  useGlass(ref, glass ? "button" : undefined);
  const cls = [styles.button, styles[size], className].filter(Boolean).join(" ");
  return (
    <button {...rest} ref={ref} type={type} aria-label={label} className={cls}>
      {children}
    </button>
  );
}
