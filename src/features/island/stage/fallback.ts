import { TAU } from "./motion";
import type { Uniforms } from "./uniforms";

/**
 * Kysland's music mode without WebGL2 (refused, or its context lost): the ink drawn plainly on
 * the page's 2D canvas from the same uniforms (the core with its shape modes, the island's box,
 * the balls), black, without light. Logical px.
 */
export function drawFallback(
  ctx: CanvasRenderingContext2D,
  U: Uniforms,
  cover: CanvasImageSource | null,
): void {
  ctx.fillStyle = "#000";
  const [cx, cy, R, on] = U.core;
  if (on! > 0.5 && R! > 0.5) {
    ctx.beginPath();
    for (let i = 0; i <= 96; i++) {
      const th = (i / 96) * TAU;
      let r = 1 + U.ripple[0]! * Math.sin(U.ripple[1]! * th - U.ripple[2]!);
      for (let m = 0; m < 4; m++) r += U.modeA[m]! * Math.cos((m + 2) * (th - U.modeP[m]!));
      const [x, y] = [cx! + Math.cos(th) * R! * r, cy! + Math.sin(th) * R! * r];
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.fill();
    const [lr, turn, shown] = U.cover;
    if (cover && shown! > 0.01 && lr! > 1) {
      ctx.save();
      ctx.globalAlpha *= Math.min(1, shown!);
      ctx.beginPath();
      ctx.arc(cx!, cy!, lr!, 0, TAU);
      ctx.clip();
      ctx.translate(cx!, cy!);
      ctx.rotate(turn!);
      ctx.drawImage(cover, -lr!, -lr!, 2 * lr!, 2 * lr!);
      ctx.restore();
    }
  }
  const [x0, y0, x1, y1] = U.isle;
  if (x1! > x0! + 0.5) {
    ctx.beginPath();
    ctx.roundRect(x0!, y0!, x1! - x0!, y1! - y0!, Math.min(U.isleR[0]!, (y1! - y0!) / 2));
    ctx.fill();
  }
  for (let i = 0; i < U.n; i++) {
    const [x, y, r] = [U.balls[4 * i]!, U.balls[4 * i + 1]!, U.balls[4 * i + 2]!];
    if (r < 0.35) continue;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
}
