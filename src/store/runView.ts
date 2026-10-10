import type { ProgressEvent, Reason, RunStatus, StepState } from "../ipc/bindings";

export interface StepView {
  state: StepState;
  reason: Reason | null;
}

/** What the interface knows about the scene being played (or the one that just ended). */
export interface RunView {
  runId: number;
  sceneId: string;
  steps: StepView[];
  /** null while it is playing. */
  status: RunStatus | null;
}

/** Applies one `scene-progress` event. A run older than the one shown is ignored. */
export function applyProgress(run: RunView | null, e: ProgressEvent): RunView | null {
  const u = e.update;
  if (u.kind === "started") {
    if (run && e.runId < run.runId) return run;
    return {
      runId: e.runId,
      sceneId: e.sceneId,
      steps: Array.from({ length: u.total }, () => ({ state: "pending", reason: null })),
      status: null,
    };
  }
  if (!run || run.runId !== e.runId) return run;
  if (u.kind === "finished") return { ...run, status: u.status };
  const steps = run.steps.slice();
  steps[u.index] = { state: u.state, reason: u.reason };
  return { ...run, steps };
}

/** Steps done (ok, failed or skipped) out of the total. */
export function doneCount(run: RunView): number {
  return run.steps.filter((s) => s.state !== "pending" && s.state !== "running").length;
}
