import { useState } from "react";
import { prefersReducedMotion } from "../../fx/motionPref";
import css from "./RunningDot.module.css";

type Dot = "on" | "born" | "dying" | null;

/**
 * The dot of an open app (step 6), with its two moments (step 24, paquet 3): born with a pulse
 * when the app opens, shrinking away when it closes — « it just changed ». Open from the start: no
 * pulse (every dot would beat at once on load).
 */
export function RunningDot({ running }: { running: boolean }) {
  const [dot, setDot] = useState<Dot>(running ? "on" : null);
  const [was, setWas] = useState(running);
  if (running !== was) {
    setWas(running);
    const still = prefersReducedMotion();
    setDot(running ? (still ? "on" : "born") : dot && !still ? "dying" : null);
  }
  if (!dot) return null;
  return (
    <span
      className={css.dot}
      data-dot={dot}
      aria-hidden="true"
      onAnimationEnd={(e) => {
        if (e.target !== e.currentTarget) return; // the ripple ends later, on its own
        setDot((d) => (d === "dying" ? null : d === "born" ? "on" : d));
      }}
    />
  );
}
