import { makeProgram, type Program } from "../../../fx/gpu/gl";
import { NOISE } from "./backShader";
import { makeTexture, project, rad, type CinemaSetup } from "./glKit";

/** The card is erased (Gommage) cell by cell: one petal per cell, columns × rows. */
export const CARD_CELLS = [10, 14] as const;

/**
 * When a cell of the card goes in the Gommage (0–1 of the erasing): from the top-left corner to
 * the bottom-right one, a little scattered. The same rule as the card's shader (petals and holes
 * match).
 */
export function eraseWhen(i: number, j: number): number {
  const [cx, cy] = CARD_CELLS;
  const u = (i + 0.5) / cx;
  const v = (j + 0.5) / cy;
  const r = (((Math.sin(i * 12.9898 + j * 78.233) * 43758.5453) % 1) + 1) % 1;
  return ((u + v * 0.5) / 1.5) * 0.82 + r * 0.18;
}

/** Where the card is and how it is lit (world px, degrees, 0–1). */
export interface CardPose {
  z: number;
  lift: number;
  bob: number;
  yaw: number;
  pitch: number;
  /** Light on it, from below (fire) or above (a spotlight), in `glow`'s colour. */
  light: number;
  /** Burning from the foot (Sceau), being erased into petals (Gommage). */
  burn: number;
  erase: number;
}

const CARD_UNIFORMS = ["uT", "uGlow", "uEdge", "uPoster", "uHas", "uL", "uM", "uShape"] as const;

/** The card's four corners, already in clip space (x·w, y·w, 0, w: perspective-correct uv). */
const CARD_VERTEX = `#version 300 es
layout(location = 0) in vec4 aClip;
layout(location = 1) in vec2 aUv;
out vec2 vUv;
void main() {
  vUv = aUv;
  gl_Position = aClip;
}
`;

const CARD_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform float uT;
uniform vec3 uGlow;   // the light's colour
uniform vec3 uEdge;   // colour of a burning / erased edge
uniform sampler2D uPoster;
uniform float uHas;
uniform vec4 uL;      // light, burn, opacity, erase
uniform float uM;     // light from below (0: fire) or above (1: a spotlight)
uniform vec2 uShape;  // aspect (w / h), corner radius (× height)
out vec4 outColor;
${NOISE}
void main() {
  vec2 q = (vUv - 0.5) * vec2(uShape.x, 1.0);
  vec2 b = vec2(uShape.x * 0.5, 0.5) - uShape.y;
  float sd = length(max(abs(q) - b, 0.0)) + min(max(abs(q).x - b.x, abs(q).y - b.y), 0.0) - uShape.y;
  float aa = fwidth(sd);
  float a = 1.0 - smoothstep(-aa, aa, sd);
  vec3 c = uHas > 0.5 ? texture(uPoster, vUv).rgb : mix(uGlow, uEdge, vUv.y) * 0.6;
  // Light: from below (the fire) or from above (a spotlight, chiaroscuro), and on the edge.
  float side = mix(vUv.y * vUv.y, (1.0 - vUv.y) * (1.0 - vUv.y), uM);
  c = mix(c, c * (0.5 + uGlow * 1.1), uL.x * 0.45 * (1.0 - uM)) + uGlow * uL.x * 0.3 * side;
  c *= mix(1.0, 0.55 + 0.6 * (1.0 - vUv.y), uM * uL.x);
  float rim = exp(-abs(sd) / 0.012);
  c += mix(vec3(0.7), uGlow, uL.x) * rim * (0.35 + 0.5 * uL.x);
  // Burning from the foot: a ragged edge of pale fire.
  float n = fbm(vUv * vec2(3.0, 5.0) + vec2(0.0, uT * 0.25));
  float h = vUv.y + (n - 0.5) * 0.32;
  float line = 1.2 - uL.y * 1.55;
  float burned = smoothstep(line - 0.01, line + 0.01, h);
  float edge = smoothstep(line - 0.09, line, h) * (1.0 - burned) * step(0.001, uL.y);
  c = mix(c, mix(uEdge, vec3(1.0), 0.5) * 1.8, edge);
  // Gommage: erased cell by cell, each cell a petal blown away (eraseWhen in TypeScript).
  vec2 cells = vec2(${CARD_CELLS[0]}.0, ${CARD_CELLS[1]}.0);
  vec2 cell = min(floor(vUv * cells), cells - 1.0);
  vec2 cc = (cell + 0.5) / cells;
  float r = fract(sin(cell.x * 12.9898 + cell.y * 78.233) * 43758.5453);
  float when = (cc.x + cc.y * 0.5) / 1.5 * 0.82 + r * 0.18;
  float gone = step(0.0001, uL.w) * step(when, uL.w);
  float near = step(0.0001, uL.w) * smoothstep(when - 0.07, when, uL.w) * (1.0 - gone);
  c = mix(c, uEdge * 1.3, near * 0.85);
  a *= (1.0 - burned) * (1.0 - gone) * uL.z;
  outColor = vec4(c * a, a);
}
`;

/**
 * The card in the launch scenes: a quad in perspective (turned, pushed back, lifted) with the
 * game's poster, a glass edge, the scene's light, and its end (burnt or erased into petals).
 */
export class CardQuad {
  private readonly prog: Program | null;
  private readonly vao: WebGLVertexArrayObject;
  private readonly buf: WebGLBuffer;
  private readonly data = new Float32Array(4 * 6);
  poster: WebGLTexture | null = null;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly setup: CinemaSetup,
  ) {
    this.prog = makeProgram(gl, CARD_VERTEX, CARD_FRAGMENT, CARD_UNIFORMS);
    this.vao = gl.createVertexArray()!;
    this.buf = gl.createBuffer()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 24, 16);
    gl.bindVertexArray(null);
    if (setup.poster) this.load(setup.poster);
  }

  get ok(): boolean {
    return this.prog !== null;
  }

  private load(url: string): void {
    const img = new Image();
    img.crossOrigin = "anonymous"; // `kayro-art` is another origin: WebGL needs CORS
    img.decoding = "async";
    img.src = url;
    img
      .decode()
      .then(() => {
        if (!this.gl.isContextLost()) this.poster = makeTexture(this.gl, img, true);
      })
      .catch(() => {
        // No poster: the card is drawn in the scene's colours.
      });
  }

  /** Screen corners of a point of the card (u, v in 0–1), for the petals it turns into. */
  pointOf(c: CardPose, u: number, v: number, P: number): [number, number, number] {
    const { w, h } = this.setup.rect;
    return this.place(c, (u - 0.5) * w, (v - 0.5) * h, P);
  }

  private place(c: CardPose, x: number, y: number, P: number): [number, number, number] {
    const yaw = rad(c.yaw);
    const pitch = rad(c.pitch);
    const y1 = y * Math.cos(pitch);
    const z1 = y * Math.sin(pitch);
    const x2 = x * Math.cos(yaw) - z1 * Math.sin(yaw);
    const z2 = x * Math.sin(yaw) + z1 * Math.cos(yaw) + c.z;
    return project(this.setup.rect, x2, y1 + c.lift + c.bob, z2, P);
  }

  draw(
    c: CardPose,
    t: number,
    view: { W: number; H: number; P: number },
    look: { glow: readonly number[]; edge: readonly number[]; above: boolean },
  ): void {
    const { gl, prog } = this;
    if (!prog) return;
    const { w, h } = this.setup.rect;
    const corners = [
      [-w / 2, -h / 2, 0, 0],
      [-w / 2, h / 2, 0, 1],
      [w / 2, -h / 2, 1, 0],
      [w / 2, h / 2, 1, 1],
    ] as const;
    corners.forEach(([x, y, u, v], n) => {
      const [sx, sy, k] = this.place(c, x, y, view.P);
      const wq = 1 / k;
      const nx = ((sx / view.W) * 2 - 1) * wq;
      const ny = (1 - (sy / view.H) * 2) * wq;
      this.data.set([nx, ny, 0, wq, u, v], n * 6);
    });
    gl.useProgram(prog.program);
    gl.uniform1f(prog.loc.uT!, t);
    gl.uniform3f(prog.loc.uGlow!, look.glow[0]!, look.glow[1]!, look.glow[2]!);
    gl.uniform3f(prog.loc.uEdge!, look.edge[0]!, look.edge[1]!, look.edge[2]!);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.poster);
    gl.uniform1i(prog.loc.uPoster!, 1);
    gl.uniform1f(prog.loc.uHas!, this.poster ? 1 : 0);
    gl.uniform4f(prog.loc.uL!, c.light, c.burn, 1, c.erase);
    gl.uniform1f(prog.loc.uM!, look.above ? 1 : 0);
    gl.uniform2f(prog.loc.uShape!, w / h, 30 / Math.max(1, h));
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.activeTexture(gl.TEXTURE0);
  }

  dispose(): void {
    if (this.prog) this.gl.deleteProgram(this.prog.program);
    this.gl.deleteTexture(this.poster);
  }
}
