import { describe, expect, it, vi } from "vitest";
import type { ProgressEvent, SceneFile } from "../ipc/bindings";
import type { ScenesIpc } from "../ipc/commands";
import { applyProgress } from "./runView";
import { createSceneStore } from "./sceneStore";

const scene = (id: string): SceneFile => ({ schemaVersion: 1, id, name: id, steps: [] });
const ok = <T>(value: T) => Promise.resolve({ ok: true as const, value });
const noEvents = () => Promise.resolve(() => {});

function fakeIpc(over: Partial<ScenesIpc> = {}): ScenesIpc {
  return {
    list: () => ok([scene("b")]),
    save: (s) => ok(s),
    delete: () => ok(null),
    newId: () => ok("x"),
    slots: () => ok({ schemaVersion: 1, slots: { a: "app" } }),
    setSlots: (slots) => ok({ schemaVersion: 1, slots }),
    run: () => ok(1),
    cancel: () => ok(true),
    exportScene: () => ok("C:\\x.hubscene"),
    importPreview: () => ok({ name: "n", stepCount: 0, slots: [] }),
    importScene: () => ok(scene("imp")),
    ...over,
  };
}

const ev = (runId: number, update: ProgressEvent["update"]): ProgressEvent => ({
  runId,
  sceneId: "s",
  update,
});

describe("applyProgress", () => {
  it("follows a run from start to end", () => {
    let run = applyProgress(null, ev(3, { kind: "started", total: 2 }));
    expect(run?.steps).toHaveLength(2);
    run = applyProgress(run, ev(3, { kind: "step", index: 0, state: "running", reason: null }));
    run = applyProgress(run, ev(3, { kind: "step", index: 0, state: "ok", reason: null }));
    run = applyProgress(
      run,
      ev(3, { kind: "step", index: 1, state: "skipped", reason: "slotUnlinked" }),
    );
    run = applyProgress(run, ev(3, { kind: "finished", status: "completed" }));
    expect(run?.steps.map((s) => s.state)).toEqual(["ok", "skipped"]);
    expect(run?.steps[1]?.reason).toBe("slotUnlinked");
    expect(run?.status).toBe("completed");
  });

  it("ignores events of another or older run", () => {
    const run = applyProgress(null, ev(5, { kind: "started", total: 1 }));
    expect(applyProgress(run, ev(4, { kind: "finished", status: "failed" }))).toBe(run);
    expect(applyProgress(run, ev(4, { kind: "started", total: 9 }))).toBe(run);
    expect(applyProgress(null, ev(1, { kind: "finished", status: "failed" }))).toBeNull();
  });
});

describe("scene store", () => {
  it("loads scenes and slots once, and shows progress events", async () => {
    let push: (e: ProgressEvent) => void = () => {};
    const list = vi.fn(() => ok([scene("b")]));
    const store = createSceneStore(fakeIpc({ list }), (h) => {
      push = h;
      return Promise.resolve(() => {});
    });
    await store.getState().init();
    await store.getState().init();
    expect(list).toHaveBeenCalledOnce();
    expect(store.getState().slots).toEqual({ a: "app" });
    push(ev(1, { kind: "started", total: 1 }));
    expect(store.getState().run?.runId).toBe(1);
    store.getState().dismissRun();
    expect(store.getState().run).toBeNull();
  });

  it("saves a scene then its slots, keeps scenes sorted, and removes", async () => {
    const store = createSceneStore(fakeIpc(), noEvents);
    await store.getState().init();
    await store.getState().save(scene("a"), { m: "discord" });
    expect(store.getState().scenes.map((s) => s.id)).toEqual(["a", "b"]);
    expect(store.getState().slots).toEqual({ m: "discord" });
    await store.getState().remove("a");
    expect(store.getState().scenes.map((s) => s.id)).toEqual(["b"]);
  });

  it("records an error and does not touch slots when the scene is refused", async () => {
    const error = { code: "validation", message: "x", field: null } as const;
    const setSlots = vi.fn();
    const store = createSceneStore(
      fakeIpc({ save: () => Promise.resolve({ ok: false, error }), setSlots }),
      noEvents,
    );
    const r = await store.getState().save(scene("a"), { m: "d" });
    expect(r.ok).toBe(false);
    expect(setSlots).not.toHaveBeenCalled();
    expect(store.getState().lastError).toEqual(error);
  });
});
