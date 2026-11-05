/**
 * The hand model of the tutorial (model/right.glb: the W3C's generic hand, its licence beside
 * it): read once from the bundle (inlined: Kayro's CSP allows no fetch), its mesh skinned on 25
 * bones named as WebXR's joints, all children of the armature (no hierarchy: each bone's rest
 * place and turn are its own).
 */

import glb from "./model/right.glb?inline";

export type Quat = [number, number, number, number];
export type Vec3 = [number, number, number];

export interface HandModel {
  pos: Float32Array;
  nor: Float32Array;
  /** Four bones per vertex, and their weights. */
  bones: Uint8Array;
  weights: Float32Array;
  index: Uint16Array;
  /** Each bone's rest place (metres) and turn, and its inverse bind matrix (16 floats each). */
  restT: Vec3[];
  restQ: Quat[];
  ibm: Float32Array;
}

interface Accessor {
  bufferView: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  type: string;
}
interface Gltf {
  nodes: { name?: string; translation?: number[]; rotation?: number[] }[];
  meshes: { primitives: { attributes: Record<string, number>; indices: number }[] }[];
  skins: { joints: number[]; inverseBindMatrices: number }[];
  accessors: Accessor[];
  bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number }[];
}

const SIZE: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

/** The bytes of a data URL (base64). */
function bytes(url: string): Uint8Array {
  const raw = atob(url.slice(url.indexOf(",") + 1));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

let cached: HandModel | null | undefined;

/** The model, read once; null when it cannot be read (the tutorial then draws the 2D hand). */
export function handModel(): HandModel | null {
  if (cached !== undefined) return cached;
  cached = null;
  try {
    const b = bytes(glb);
    const view = new DataView(b.buffer);
    if (view.getUint32(0, true) !== 0x46546c67) return null;
    const jsonLen = view.getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(b.subarray(20, 20 + jsonLen))) as Gltf;
    const bin = 20 + jsonLen + 8;
    const read = (i: number): ArrayBuffer => {
      const a = json.accessors[i];
      const v = a && json.bufferViews[a.bufferView];
      if (!a || !v) throw new Error("accessor");
      const per = SIZE[a.type] ?? 1;
      const comp = a.componentType === 5126 ? 4 : a.componentType === 5123 ? 2 : 1;
      const start = bin + (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
      return b.slice(start, start + a.count * per * comp).buffer;
    };
    const prim = json.meshes[0]?.primitives[0];
    const skin = json.skins[0];
    if (!prim || !skin) return null;
    const at = prim.attributes;
    const nodes = skin.joints.map((j) => json.nodes[j] ?? {});
    cached = {
      pos: new Float32Array(read(at.POSITION ?? -1)),
      nor: new Float32Array(read(at.NORMAL ?? -1)),
      bones: new Uint8Array(read(at.JOINTS_0 ?? -1)),
      weights: new Float32Array(read(at.WEIGHTS_0 ?? -1)),
      index: new Uint16Array(read(prim.indices)),
      restT: nodes.map((n) => (n.translation ?? [0, 0, 0]) as Vec3),
      restQ: nodes.map((n) => (n.rotation ?? [0, 0, 0, 1]) as Quat),
      ibm: new Float32Array(read(skin.inverseBindMatrices)),
    };
  } catch {
    cached = null;
  }
  return cached;
}
