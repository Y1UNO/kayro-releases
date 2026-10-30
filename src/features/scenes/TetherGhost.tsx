import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { frameLoop } from "../../fx/loop";
import { prefersReducedMotion } from "../../fx/motionPref";
import type { AppEntry } from "../../ipc/bindings";
import { useAppIcon } from "../home/useAppIcon";
import { restBob, stepBob, threadPath, tiltOf, type Bob } from "./tether";
import styles from "./Tether.module.css";

interface Props {
  app: AppEntry;
  x: number;
  y: number;
}

/**
 * Step 19b: the app being dragged into a scene, as a small glass frame (its logo and name) hanging
 * from the pointer on a thread of light, with a little physics (tether.ts). Transform and opacity
 * only, one SVG path, no blur; the loop exists only while something is dragged. Reduced motion:
 * the frame stays right under the pointer, the thread straight.
 */
export function TetherGhost({ app, x, y }: Props) {
  const icon = useAppIcon(app);
  const frame = useRef<HTMLDivElement>(null);
  const thread = useRef<SVGPathElement>(null);
  const glow = useRef<SVGPathElement>(null);
  const bead = useRef<SVGCircleElement>(null);
  const pointer = useRef({ x, y });
  useEffect(() => {
    pointer.current = { x, y };
  });

  useEffect(() => {
    const still = prefersReducedMotion();
    let bob: Bob = restBob(pointer.current.x, pointer.current.y);
    const draw = (dt: number) => {
      const { x: px, y: py } = pointer.current;
      bob = still ? restBob(px, py) : stepBob(bob, px, py, dt);
      const tilt = still ? 0 : tiltOf(bob, px, py);
      const el = frame.current;
      if (el) {
        el.style.transform = `translate3d(${bob.x.toFixed(1)}px, ${bob.y.toFixed(1)}px, 0) rotate(${(-tilt).toFixed(2)}deg)`;
      }
      const d = threadPath(px, py, bob);
      thread.current?.setAttribute("d", d);
      glow.current?.setAttribute("d", d);
      bead.current?.setAttribute("cx", px.toFixed(1));
      bead.current?.setAttribute("cy", py.toFixed(1));
    };
    draw(0);
    frame.current?.animate([{ opacity: 0, scale: "0.88" }, { opacity: 1, scale: "1" }], {
      duration: still ? 0 : 180,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    });
    return frameLoop().subscribe((dt) => draw(dt));
  }, []);

  return createPortal(
    <div className={styles.layer} aria-hidden="true">
      <svg className={styles.svg}>
        <defs>
          <linearGradient id="kayro-tether" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--accent-light)" stopOpacity="1" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0.85" />
          </linearGradient>
        </defs>
        <path ref={glow} className={styles.glow} />
        <path ref={thread} className={styles.thread} />
        <circle ref={bead} className={styles.bead} r="3.2" />
      </svg>
      <div ref={frame} className={styles.frame}>
        <span className={styles.hook} />
        <span className={styles.icon}>
          {icon ? (
            <img src={icon} alt={""} draggable={false} />
          ) : (
            app.name.charAt(0).toUpperCase()
          )}
        </span>
        <span className={styles.name}>{app.name}</span>
      </div>
    </div>,
    document.body,
  );
}
