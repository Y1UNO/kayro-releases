import type { StepView } from "../../../store";

/**
 * Look of each point of the scene editor's chain (art direction round 4b, R4b-3c-Editeur.txt).
 * `idle`: no test running (filled point). During a test: `waiting` (edge A), `running` (bigger,
 * stronger halo, its card lit), `ok` (filled), `failed` (soft red), `skipped` (faded: the scene
 * stopped before it).
 */
export type PointState = "idle" | "waiting" | "running" | "ok" | "failed" | "skipped";

export interface ChainLink {
  point: PointState;
  /** The thread from this point to the next one is filled (the next step has started). */
  filled: boolean;
}

const POINT: Record<StepView["state"], PointState> = {
  pending: "waiting",
  running: "running",
  ok: "ok",
  failed: "failed",
  skipped: "skipped",
};

/**
 * The chain from the run's step views. The thread fills from point to point as each next step
 * starts, so it stops where the scene stops (the following steps are skipped). The scene engine
 * decides whether a failure stops it (only a step marked « required »): the chain follows.
 */
export function chainState(count: number, run: readonly StepView[] | undefined): ChainLink[] {
  return Array.from({ length: count }, (_, i) => {
    const view = run?.[i];
    const next = run?.[i + 1]?.state;
    return {
      point: view ? POINT[view.state] : "idle",
      filled: next === "running" || next === "ok" || next === "failed",
    };
  });
}
