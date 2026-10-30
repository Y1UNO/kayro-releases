import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { frameLoop } from "../../fx/loop";
import { prefersReducedMotion } from "../../fx/motionPref";
import type { AppEntry } from "../../ipc/bindings";
import { useAppIcon } from "../home/useAppIcon";
import { hookOf, makeRope, ropePath, stepRope, tiltOf } from "./tether";
import styles from "./Tether.module.css";

/** Where the dragged app was (its row in « Mes apps » or in the scene), viewport px. */
export interface TetherFrom {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Props {
  app: AppEntry;
  x: number;
  y: number;
  from: TetherFrom | null;
}

/** The row comes out and turns into the small frame in this time (ms). */
const MORPH_MS = 560;
/** Corner radius of the row it comes from, and of the frame. */
const ROW_RADIUS = 14;
const FRAME_RADIUS = 16;

/** Ease out with a small overshoot: the frame settles in its shape (organic, not mechanical). */
function settle(k: number): number {
  const c = 0.55;
  const u = k - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/**
 * Steps 19b–19c: the app being dragged into a scene. The row it was picked from comes out, glides
 * and turns into a small glass frame (its logo and name) hanging from the pointer on a thread of
 * light — a real rope, the frame slowed by the air (tether.ts). Transform, opacity and the frame's
 * own size only; one SVG path, no blur; the loop exists only while something is dragged. Reduced
 * motion: the frame right under the pointer, the thread straight, no morph.
 */
export function TetherGhost({ app, x, y, from }: Props) {
  const icon = useAppIcon(app);
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const paths = useRef<(SVGPathElement | null)[]>([]);
  const bead = useRef<SVGGElement>(null);
  const pointer = useRef({ x, y });
  const origin = useRef(from);
  useEffect(() => {
    pointer.current = { x, y };
  });

  useEffect(() => {
    const still = prefersReducedMotion();
    const box = inner.current;
    const natural = { w: box?.offsetWidth ?? 180, h: box?.offsetHeight ?? 48 };
    let rope = makeRope(pointer.current.x, pointer.current.y);
    const start = performance.now();
    const row = origin.current;
    const hook0 = hookOf(rope);
    // From the frame's own place (hanging under its hook) to the row it comes out of.
    const away = row && !still ? { x: row.left + row.width / 2 - hook0.x, y: row.top - hook0.y } : null;

    // The frame's turn follows the rope's softly (no sudden flick): eased over ~160 ms.
    let shown = 0;
    const draw = (dt: number, now: number) => {
      const { x: px, y: py } = pointer.current;
      if (still) rope = makeRope(px, py);
      else stepRope(rope, px, py, dt);
      const k = away ? Math.min(1, (now - start) / MORPH_MS) : 1;
      const e = away ? settle(k) : 1;
      const shape = away ? 1 - (1 - k) ** 3 : 1;
      const ox = away ? away.x * (1 - e) : 0;
      const oy = away ? away.y * (1 - e) : 0;
      const hook = hookOf(rope);
      shown += (tiltOf(rope) - shown) * (1 - Math.exp(-dt / 160));
      const tilt = still ? 0 : shown * shape;
      if (outer.current) {
        outer.current.style.transform = `translate3d(${(hook.x + ox).toFixed(1)}px, ${(hook.y + oy).toFixed(1)}px, 0) rotate(${tilt.toFixed(2)}deg)`;
      }
      if (box && row && away && k < 1) {
        box.style.width = `${lerp(row.width, natural.w, shape).toFixed(1)}px`;
        box.style.height = `${lerp(row.height, natural.h, shape).toFixed(1)}px`;
        box.style.borderRadius = `${lerp(ROW_RADIUS, FRAME_RADIUS, shape).toFixed(1)}px`;
      } else if (box && box.style.width) {
        box.style.width = "";
        box.style.height = "";
        box.style.borderRadius = "";
      }
      const d = ropePath(rope, ox, oy);
      for (const p of paths.current) p?.setAttribute("d", d);
      bead.current?.setAttribute("transform", `translate(${px.toFixed(1)} ${py.toFixed(1)})`);
    };
    draw(0, start);
    return frameLoop().subscribe(draw);
  }, []);

  return createPortal(
    <div className={styles.layer} aria-hidden="true">
      <svg className={styles.svg}>
        <path ref={(el) => void (paths.current[0] = el)} className={styles.halo} />
        <path ref={(el) => void (paths.current[1] = el)} className={styles.glow} />
        <path ref={(el) => void (paths.current[2] = el)} className={styles.core} />
        <g ref={bead}>
          <circle className={styles.beadHalo} r="8" />
          <circle className={styles.bead} r="3.4" />
        </g>
      </svg>
      <div ref={outer} className={styles.hanger}>
        <div ref={inner} className={styles.frame} data-tether-frame="">
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
      </div>
    </div>,
    document.body,
  );
}
