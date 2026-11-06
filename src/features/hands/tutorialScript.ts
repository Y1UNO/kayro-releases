/**
 * The tutorial of the hands (Réglages › Mains, step 22), as one clock: five scenes, and for any
 * time what the hand does (handPose.ts) and what the little screen beside it shows (the cursor,
 * a click's ripple, a card dragged, a menu, the ring of the thumb up, the camera). The canvas
 * and the DOM read the same state, so they never drift apart.
 */

import {
  add,
  pose,
  thumbUp,
  touched,
  type HandFrame,
  type Pinch,
  type RightFinger,
  type Skeleton,
  type V3,
} from "./handPose";

export type SceneId = "move" | "click" | "drag" | "right" | "off";

interface Scene {
  id: SceneId;
  start: number;
  end: number;
}

export const SCENES: readonly Scene[] = [
  { id: "move", start: 0, end: 3.4 },
  { id: "click", start: 3.4, end: 6.6 },
  { id: "drag", start: 6.6, end: 10.2 },
  { id: "right", start: 10.2, end: 13.6 },
  { id: "off", start: 13.6, end: 17.4 },
];
export const LOOP_S = 17.4;
/** The view of each scene (yaw, rad), checked on large captures: the open hand nearly from the
 * front, the pinch of the index from the thumb's side (the ring of the OK shows), the right
 * click from the other side (the index and middle up in front, as in the user's photos), the
 * thumb up nearly from the front. The camera turns from one to the next as a scene starts. */
const YAW: readonly number[] = [0.2, 0.85, 0.85, -0.75, 0.1];
const TURN_S = 0.7;

export interface TutorialState {
  scene: number;
  /** 0–1 through the scene. */
  progress: number;
  hand: HandFrame;
  /** The cursor on the little screen, 0–1 (y down). */
  cursor: [number, number];
  /** A click's ripple: its age (s), or -1. */
  ripple: number;
  /** The icon clicked is chosen. */
  picked: boolean;
  /** The card that is dragged (0–1), and whether it is held. */
  card: [number, number];
  grabbed: boolean;
  /** The menu of the right click: 0 closed – 1 open. */
  menu: number;
  /** The thumb up held: 0–1 of its second. */
  hold: number;
  /** The camera: 1 on, 0 off. */
  camera: number;
  /** How the hand is turned (rad, the view's yaw): each gesture from where it reads best. */
  turn: number;
  /** How much the hand rolls in its plane (rad): a thumb up lays the fist down. */
  roll: number;
}

/** The little screen's places (0–1): the icon to click, the card's start and end, the menu. */
export const ICON: [number, number] = [0.3, 0.36];
export const CARD_FROM: [number, number] = [0.28, 0.7];
export const CARD_TO: [number, number] = [0.72, 0.62];
export const MENU_AT: [number, number] = [0.46, 0.3];

const smooth = (x: number) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};
/** 0 before a, 1 after b, smooth between. */
const step = (t: number, a: number, b: number) => smooth((t - a) / (b - a));
const mix2 = (a: [number, number], b: [number, number], k: number): [number, number] => [
  a[0] + (b[0] - a[0]) * k,
  a[1] + (b[1] - a[1]) * k,
];

/** How far the hand moves (cm) to sweep the little screen. */
const SWEEP: [number, number] = [5.5, 4];
/** The hand's place (cm) for a cursor at `c`. */
const handAt = (c: [number, number]): V3 => [(c[0] - 0.5) * SWEEP[0], (0.5 - c[1]) * SWEEP[1], 0];

/** A pinch closing over [a, a + 0.35], held, opening over [b, b + 0.35]. */
const pinchW = (t: number, a: number, b: number) =>
  step(t, a, a + 0.35) * (1 - step(t, b, b + 0.35));

function frame(sk: Skeleton, which: Pinch, w: number, at: V3, isRight: boolean): HandFrame {
  return {
    joints: sk.joints.map((p) => add(p, at)),
    lat: sk.lat,
    phase: w > 0 ? (isRight ? "right" : "left") : "open",
    contact: w > 0.92 ? (w - 0.92) / 0.08 : 0,
    touched: touched(which),
  };
}

export function tutorialAt(time: number, right: RightFinger): TutorialState {
  const t = ((time % LOOP_S) + LOOP_S) % LOOP_S;
  const scene = Math.max(
    0,
    SCENES.findIndex((s) => t >= s.start && t < s.end),
  );
  const { id, start, end } = SCENES[scene] ?? { id: "move", start: 0, end: LOOP_S };
  const u = t - start;
  const base: TutorialState = {
    scene,
    progress: (t - start) / (end - start),
    hand: frame(pose("index", 0), "index", 0, [0, 0, 0], false),
    cursor: [0.5, 0.5],
    ripple: -1,
    picked: false,
    card: CARD_FROM,
    grabbed: false,
    menu: 0,
    hold: 0,
    camera: 1,
    turn: lerpYaw(scene, u),
    roll: 0,
  };

  if (id === "move") {
    // The hand wanders; the cursor is where it is.
    const k = (u / (end - start)) * Math.PI * 2;
    const c: [number, number] = [0.5 + 0.38 * Math.sin(k), 0.5 - 0.22 * Math.sin(2 * k)];
    return { ...base, cursor: c, hand: frame(pose("index", 0), "index", 0, handAt(c), false) };
  }
  if (id === "click") {
    const c = mix2([0.5, 0.5], ICON, step(u, 0, 0.7));
    const w = pinchW(u, 0.95, 1.6);
    return {
      ...base,
      cursor: c,
      hand: frame(pose("index", w), "index", w, handAt(c), false),
      ripple: u >= 1.3 ? u - 1.3 : -1,
      picked: u >= 1.3,
    };
  }
  if (id === "drag") {
    const toCard = mix2(ICON, CARD_FROM, step(u, 0, 0.6));
    const along = step(u, 1.15, 2.55);
    const c = along > 0 ? mix2(CARD_FROM, CARD_TO, along) : toCard;
    const w = pinchW(u, 0.7, 2.65);
    const grabbed = w > 0.92;
    return {
      ...base,
      cursor: c,
      hand: frame(pose("index", w), "index", w, handAt(c), false),
      card: u >= 1.05 ? mix2(CARD_FROM, CARD_TO, along) : CARD_FROM,
      grabbed,
    };
  }
  if (id === "right") {
    const c = mix2(CARD_TO, MENU_AT, step(u, 0, 0.55));
    const w = pinchW(u, 0.7, 1.6);
    const menu = step(u, 1.05, 1.4) * (1 - step(u, 3.0, 3.25));
    return {
      ...base,
      cursor: c,
      hand: frame(pose(right, w), right, w, handAt(c), true),
      card: CARD_TO,
      menu,
    };
  }
  // « off »: a thumb up held a second turns the camera off; then the hand opens again.
  const c = mix2(MENU_AT, [0.5, 0.5], step(u, 0, 0.5));
  const up = step(u, 0.4, 1.0) * (1 - step(u, 2.8, 3.4));
  const camera = 1 - step(u, 2.0, 2.3) * (1 - step(u, 3.3, 3.7));
  return {
    ...base,
    cursor: c,
    hand: frame(thumbUp(up), "index", 0, handAt(c), false),
    card: CARD_FROM,
    hold: step(u, 1.0, 2.0) * (1 - step(u, 2.8, 3.0)),
    camera,
    roll: 1.45 * up,
  };
}

function lerpYaw(scene: number, u: number): number {
  const from = YAW[(scene + YAW.length - 1) % YAW.length] ?? 0;
  const to = YAW[scene] ?? 0;
  return from + (to - from) * step(u, 0, TURN_S);
}

/** The time at which scene `i` starts (to jump there). */
export const sceneStart = (i: number) => SCENES[i]?.start ?? 0;
/** For reduced motion: the moment that tells each scene best. */
export const SCENE_KEY: readonly number[] = [0.85, 4.85, 8.3, 11.4, 15.2];
