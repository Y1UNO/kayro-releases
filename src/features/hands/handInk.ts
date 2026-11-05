/**
 * The tutorial's hand (step 22): WebGL2 draws the hand model (handModel.ts) posed by handSkin.ts
 * from handPose.ts's joints, with the shaders of handInkShader.ts, in the theme's night and
 * colours. `null` without WebGL2, without the model, or when a shader does not compile; `lost()`
 * once the driver took the context back: HandTutorial.tsx then draws the 2D hand (handDraw.ts).
 */

import { makeProgram } from "../../fx/gpu/gl";
import { turnView, type Look } from "./handDraw";
import { handModel } from "./handModel";
import type { HandFrame, Phase, V3 } from "./handPose";
import { GLOW, HAND_FS, HAND_VS, NIGHT, QUAD } from "./handInkShader";
import { bones, rest } from "./handSkin";

/** The theme's colours, 0–1: its night (top, bottom), its two colours A and B. */
export interface InkColors {
  top: V3;
  bottom: V3;
  a: V3;
  b: V3;
}

export interface InkHand {
  /** `camera` 1 on, 0 off (the hand dims). */
  draw(frame: HandFrame, look: Look, time: number, colors: InkColors, camera: number): void;
  lost(): boolean;
  dispose(): void;
}

/** The point the view turns around (cm, the palm's middle) and the eye's distance. */
const CENTRE: V3 = [1.0, 8.6, 1.5];
const EYE = 42;
/** Half the view's height at the hand, in cm: the hand (about 21 cm) fills most of it. */
const HALF_VIEW = 13.5;
const TAN = HALF_VIEW / EYE;
/** The cursor's glow (glow.rs): blue for the left click, amber for the right. */
const GLOW_RGB: Record<Exclude<Phase, "open">, V3> = {
  left: [122 / 255, 178 / 255, 1],
  right: [1, 190 / 255, 120 / 255],
};

/** A perspective of half-height `tan` (column-major), near 1 cm, far 200. */
function perspective(tan: number, aspect: number): Float32Array {
  const f = 1 / tan;
  const [n, far] = [1, 200];
  return new Float32Array([
    f / aspect,
    0,
    0,
    0,
    0,
    f,
    0,
    0,
    0,
    0,
    (far + n) / (n - far),
    -1,
    0,
    0,
    (2 * far * n) / (n - far),
    0,
  ]);
}

export function inkHand(canvas: HTMLCanvasElement): InkHand | null {
  const model = handModel();
  const gl = canvas.getContext("webgl2", { antialias: true, alpha: false });
  if (!gl || !model) return null;
  const night = makeProgram(gl, QUAD, NIGHT, ["uRes", "uTime", "uTop", "uBottom", "uA", "uB"]);
  const hand = makeProgram(gl, HAND_VS, HAND_FS, [
    "uBones",
    "uProj",
    "uEye",
    "uRes",
    "uBottom",
    "uA",
    "uB",
    "uCamera",
  ]);
  const glow = makeProgram(gl, QUAD, GLOW, ["uRes", "uTime", "uGlow", "uContact", "uTouch"]);
  if (!night || !hand || !glow) return null;

  // The mesh: places, normals, four bones and weights per vertex, the triangles.
  const vao = gl.createVertexArray();
  const empty = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buffers: WebGLBuffer[] = [];
  const attrib = (loc: number, data: Float32Array | Uint8Array, size: number, int: boolean) => {
    const buf = gl.createBuffer();
    buffers.push(buf);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc);
    if (int) gl.vertexAttribIPointer(loc, size, gl.UNSIGNED_BYTE, 0, 0);
    else gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  };
  attrib(0, model.pos, 3, false);
  attrib(1, model.nor, 3, false);
  attrib(2, model.bones, 4, true);
  attrib(3, model.weights, 4, false);
  const ibo = gl.createBuffer();
  buffers.push(ibo);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, model.index, gl.STATIC_DRAW);
  gl.bindVertexArray(null);

  const r = rest(model);
  const mats = new Float32Array(25 * 16);
  let isLost = false;
  const onLost = (e: Event) => {
    e.preventDefault();
    isLost = true;
  };
  canvas.addEventListener("webglcontextlost", onLost);

  return {
    draw(frame, look, time, colors, camera) {
      if (isLost || gl.isContextLost()) return;
      const { width: w, height: h } = canvas;
      gl.viewport(0, 0, w, h);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.bindVertexArray(empty);
      // 1. The night.
      gl.useProgram(night.program);
      gl.uniform2f(night.loc.uRes ?? null, w, h);
      gl.uniform1f(night.loc.uTime ?? null, time);
      gl.uniform3fv(night.loc.uTop ?? null, colors.top);
      gl.uniform3fv(night.loc.uBottom ?? null, colors.bottom);
      gl.uniform3fv(night.loc.uA ?? null, colors.a);
      gl.uniform3fv(night.loc.uB ?? null, colors.b);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      // 2. The hand.
      bones(model, r, frame, look, CENTRE, mats);
      gl.enable(gl.DEPTH_TEST);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.useProgram(hand.program);
      gl.uniformMatrix4fv(hand.loc.uBones ?? null, false, mats);
      gl.uniformMatrix4fv(hand.loc.uProj ?? null, false, perspective(TAN, w / h));
      gl.uniform1f(hand.loc.uEye ?? null, EYE);
      gl.uniform2f(hand.loc.uRes ?? null, w, h);
      gl.uniform3fv(hand.loc.uBottom ?? null, colors.bottom);
      gl.uniform3fv(hand.loc.uA ?? null, colors.a);
      gl.uniform3fv(hand.loc.uB ?? null, colors.b);
      gl.uniform1f(hand.loc.uCamera ?? null, camera);
      gl.bindVertexArray(vao);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawElements(gl.TRIANGLES, model.index.length, gl.UNSIGNED_SHORT, 0);
      gl.disable(gl.BLEND);
      // 3. A click: the glow, added.
      const touching = frame.phase !== "open" && frame.contact > 0;
      const thumb = frame.joints[4];
      const tip = frame.joints[frame.touched];
      if (touching && thumb && tip) {
        const m = turnView(
          [
            (thumb[0] + tip[0]) / 2 - CENTRE[0],
            (thumb[1] + tip[1]) / 2 - CENTRE[1],
            (thumb[2] + tip[2]) / 2 - CENTRE[2],
          ],
          look,
        );
        const k = 1 / ((EYE - m[2]) * TAN);
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.bindVertexArray(empty);
        gl.useProgram(glow.program);
        gl.uniform2f(glow.loc.uRes ?? null, w, h);
        gl.uniform1f(glow.loc.uTime ?? null, time);
        gl.uniform3fv(
          glow.loc.uGlow ?? null,
          frame.phase === "open" ? GLOW_RGB.left : GLOW_RGB[frame.phase],
        );
        gl.uniform1f(glow.loc.uContact ?? null, frame.contact);
        gl.uniform2f(glow.loc.uTouch ?? null, m[0] * k, m[1] * k);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.disable(gl.BLEND);
      }
      gl.bindVertexArray(null);
    },
    lost: () => isLost || gl.isContextLost(),
    dispose() {
      canvas.removeEventListener("webglcontextlost", onLost);
      buffers.forEach((b) => gl.deleteBuffer(b));
      gl.deleteVertexArray(vao);
      gl.deleteVertexArray(empty);
      [night, hand, glow].forEach((p) => gl.deleteProgram(p.program));
    },
  };
}

/** A CSS colour (a theme variable) as 0–1 RGB, read through a probe in `host`. */
export function cssColor(host: Element, value: string, fallback: V3): V3 {
  const probe = document.createElement("span");
  probe.style.color = value;
  probe.style.display = "none";
  host.appendChild(probe);
  const c = getComputedStyle(probe).color;
  probe.remove();
  const n = c.match(/[\d.]+/g)?.map(Number) ?? [];
  if (n.length < 3) return fallback;
  // « color(srgb r g b) » (color-mix) is 0–1; « rgb(r, g, b) » is 0–255.
  const unit = c.startsWith("color(") ? 1 : 255;
  return [(n[0] ?? 0) / unit, (n[1] ?? 0) / unit, (n[2] ?? 0) / unit];
}
