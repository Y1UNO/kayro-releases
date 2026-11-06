import type { ButtonHTMLAttributes, MouseEvent } from "react";
import { playSound } from "../../sound/engine";
import type { SoundEvent } from "../../sound/manifest";
import styles from "./Button.module.css";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** `primary` = accent fill (one per group), `soft` = translucent fill. */
  variant?: "primary" | "soft";
  size?: "md" | "sm";
  /** Step 17b: a primary button confirms, the others click; `false` = silent. */
  sound?: SoundEvent | false;
}

export function Button({
  variant = "soft",
  size = "md",
  className,
  type = "button",
  sound,
  onClick,
  ...rest
}: Props) {
  const cls = [styles.button, styles[variant], styles[size], className].filter(Boolean).join(" ");
  const cue = sound ?? (variant === "primary" ? "confirm" : "click");
  const click = (e: MouseEvent<HTMLButtonElement>) => {
    if (cue) playSound(cue);
    onClick?.(e);
  };
  return <button {...rest} type={type} className={cls} onClick={click} />;
}
