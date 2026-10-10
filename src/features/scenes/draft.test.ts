import { describe, expect, it } from "vitest";
import type { AppEntry, SceneFile } from "../../ipc/bindings";
import {
  draftFromScene,
  isSaveable,
  move,
  newDraft,
  panelSlots,
  reduce,
  resolved,
  snapshot,
  toScene,
  trySimple,
  type Action,
  type EditorDraft,
} from "./draft";
import { slotLabel, slugifySlot, slotsOf } from "./model";

function app(id: string, exe: string | null = `${id}.exe`): AppEntry {
  return {
    id,
    name: id,
    category: "logiciels",
    source: { kind: "manual" },
    launch: { kind: "exe", path: `C:\\${id}.exe`, args: [], cwd: null, elevated: false },
    match: { exe },
    art: { poster: null, hero: null },
    moodId: null,
    favorite: false,
  } as AppEntry;
}

const apps = [app("discord"), app("steam"), app("spotify"), app("notes", null)];

function run(draft: EditorDraft, ...actions: Action[]): EditorDraft {
  return actions.reduce(reduce, draft);
}

describe("simple mode draft", () => {
  it("builds a scene of 3 apps from drops only, ready to save", () => {
    const d = run(
      newDraft({}),
      { type: "name", name: "Soirée gaming" },
      { type: "addApp", appId: "discord" },
      { type: "addApp", appId: "steam" },
      { type: "addApp", appId: "spotify", index: 0 },
    );
    expect(d.simple.items.map((i) => i.appId)).toEqual(["spotify", "discord", "steam"]);
    expect(isSaveable(d, apps)).toBe(true);
    const scene = toScene(d, apps, "soiree-gaming");
    expect(slotsOf(scene.steps)).toEqual(["spotify", "discord", "steam"]);
    expect(resolved(d, apps).links).toEqual({
      spotify: "spotify",
      discord: "discord",
      steam: "steam",
    });
  });

  it("ignores a second drop of the same app, reorders, removes and sets options", () => {
    const d = run(
      newDraft({}),
      { type: "addApp", appId: "discord" },
      { type: "addApp", appId: "discord" },
      { type: "addApp", appId: "steam" },
      { type: "moveItem", from: 1, to: 0 },
      { type: "ready", appId: "steam", ready: false },
      { type: "sequence", sequence: "together" },
    );
    expect(d.simple.items).toEqual([
      { appId: "steam", ready: false },
      { appId: "discord", ready: true },
    ]);
    expect(d.simple.sequence).toBe("together");
    expect(run(d, { type: "removeItem", appId: "steam" }).simple.items).toHaveLength(1);
  });

  it("needs a name and at least one app to be saved", () => {
    expect(isSaveable(newDraft({}), apps)).toBe(false);
    const named = run(newDraft({}), { type: "name", name: "X" });
    expect(isSaveable(named, apps)).toBe(false);
    expect(isSaveable(run(named, { type: "addApp", appId: "discord" }), apps)).toBe(true);
    expect(
      isSaveable(
        run(named, { type: "name", name: "  " }, { type: "addApp", appId: "discord" }),
        apps,
      ),
    ).toBe(false);
  });
});

describe("simple → advanced → simple", () => {
  const simple = run(
    newDraft({}),
    { type: "name", name: "Soirée" },
    { type: "addApp", appId: "discord" },
    { type: "addApp", appId: "notes" },
    { type: "addApp", appId: "spotify" },
  );

  it("turns the generated steps into ordinary steps, without any loss", () => {
    const before = resolved(simple, apps);
    const adv = run(simple, { type: "toAdvanced", apps });
    expect(adv.mode).toBe("advanced");
    expect(adv.steps.map((s) => s.step)).toEqual(before.steps);
    expect(resolved(adv, apps)).toEqual(before);
    expect(snapshot(adv, apps)).toBe(snapshot(simple, apps));
  });

  it("goes back to simple while the steps are still simple ones", () => {
    const adv = run(simple, { type: "toAdvanced", apps });
    const back = trySimple(adv, apps);
    expect(back).not.toBeNull();
    const again = run(adv, { type: "toSimple", simple: back!.simple });
    expect(again.mode).toBe("simple");
    expect(snapshot(again, apps)).toBe(snapshot(simple, apps));
  });

  it("refuses to go back once a step is something the simple mode cannot make", () => {
    const adv = run(simple, { type: "toAdvanced", apps }, { type: "addStep", kind: "focus" });
    expect(trySimple(adv, apps)).toBeNull();
    const delay = run(simple, { type: "toAdvanced", apps });
    const wait = delay.steps.find((s) => s.step.type === "wait")!;
    expect(
      trySimple(run(delay, { type: "patchStep", key: wait.key, patch: { ms: 7777 } }), apps),
    ).toBeNull();
  });
});

describe("advanced mode draft", () => {
  const scene: SceneFile = {
    schemaVersion: 1,
    id: "s",
    name: "S",
    hotkey: "Ctrl+Alt+1",
    steps: [
      { type: "launch", slot: "messagerie" },
      { type: "wait", ms: 2000 },
      { type: "focus", slot: "messagerie", required: true },
    ],
  };
  const links = { messagerie: "discord" };

  it("opens in advanced mode when the steps are not simple, in simple mode otherwise", () => {
    expect(draftFromScene(scene, links, apps).mode).toBe("advanced");
    const plain: SceneFile = { ...scene, steps: [{ type: "launch", slot: "messagerie" }] };
    expect(draftFromScene(plain, links, apps).mode).toBe("simple");
    expect(draftFromScene(plain, {}, apps).mode).toBe("advanced");
  });

  it("adds steps with a sensible slot, creating one when there is none", () => {
    const d = run(
      newDraft({}),
      { type: "addStep", kind: "launch" },
      { type: "addStep", kind: "wait" },
    );
    expect(d.steps.map((s) => s.step.type)).toEqual(["launch", "wait"]);
    expect(d.extraSlots).toEqual(["emplacement-1"]);
    expect(slotLabel("emplacement-1")).toBe("Emplacement 1");
    expect(d.selected).toBe(d.steps[1]!.key);
    const wait = run(newDraft({}), { type: "addStep", kind: "wait" });
    expect(wait.extraSlots).toEqual([]);
  });

  it("reorders, edits and removes steps", () => {
    const d0 = draftFromScene(scene, links, apps);
    const d1 = run(d0, { type: "moveStep", from: 2, to: 0 });
    expect(d1.steps.map((s) => s.step.type)).toEqual(["focus", "launch", "wait"]);
    const key = d1.steps[2]!.key;
    const d2 = run(d1, { type: "patchStep", key, patch: { ms: 500 } });
    expect(d2.steps[2]!.step).toEqual({ type: "wait", ms: 500 });
    expect(run(d2, { type: "removeStep", key }).steps).toHaveLength(2);
    expect(move([1, 2, 3], 0, 2)).toEqual([2, 3, 1]);
    expect(move([1, 2, 3], 5, 0)).toEqual([1, 2, 3]);
  });

  it("deleting a slot drops its steps, and its link unless another scene uses it", () => {
    const d0 = draftFromScene(scene, { ...links, other: "steam" }, apps);
    const gone = run(d0, { type: "deleteSlot", slot: "messagerie", keepLink: false });
    expect(gone.steps.map((s) => s.step.type)).toEqual(["wait"]);
    expect(gone.links).toEqual({ other: "steam" });
    const kept = run(d0, { type: "deleteSlot", slot: "messagerie", keepLink: true });
    expect(kept.links.messagerie).toBe("discord");
  });

  it("links, unlinks and lists the slots of the scene", () => {
    const d0 = run(draftFromScene(scene, {}, apps), { type: "addSlot", slot: "musique" });
    expect(panelSlots(d0, apps)).toEqual(["messagerie", "musique"]);
    const d1 = run(d0, { type: "link", slot: "messagerie", appId: "discord" });
    expect(resolved(d1, apps).links.messagerie).toBe("discord");
    expect(run(d1, { type: "link", slot: "messagerie", appId: null }).links).toEqual({});
  });

  it("sends the scene name trimmed and keeps the id", () => {
    const d = run(draftFromScene(scene, links, apps), { type: "name", name: "  Nouveau  " });
    expect(toScene(d, apps, "s")).toMatchObject({ id: "s", name: "Nouveau", hotkey: "Ctrl+Alt+1" });
  });
});

describe("names", () => {
  it("makes slot names that the core accepts", () => {
    expect(slugifySlot("Plateforme de jeux")).toBe("plateforme-de-jeux");
    expect(slugifySlot("  Éditeur d’images !! ")).toBe("editeur-d-images");
    expect(slugifySlot("???")).toBe("");
    expect(slugifySlot("x".repeat(80))).toHaveLength(40);
    expect(slotLabel("plateforme-de-jeux")).toBe("Plateforme de jeux");
  });
});
