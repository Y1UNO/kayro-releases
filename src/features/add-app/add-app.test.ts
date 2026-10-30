import { describe, expect, it } from "vitest";
import type { AppEntry, DetectedApp } from "../../ipc/bindings";
import { itemFromDetected, picksByDefault } from "./items";
import {
  EMPTY_DRAFT,
  applyDraft,
  cleanTarget,
  draftToNewApp,
  entryToDraft,
  isTargetLocked,
  joinArgs,
  splitArgs,
  type Draft,
} from "./draft";
import { fieldOfCoreError, isValid, validateDraft } from "./validation";

const draft = (over: Partial<Draft> = {}): Draft => ({
  ...EMPTY_DRAFT,
  name: "Mon jeu",
  target: String.raw`C:\Jeux\Mon jeu\jeu.exe`,
  ...over,
});

describe("validateDraft: name", () => {
  it("accepts a normal name", () => {
    expect(isValid(validateDraft(draft()))).toBe(true);
  });
  it("refuses an empty or blank name", () => {
    expect(validateDraft(draft({ name: "" })).name).toBe("addApps.errors.nameRequired");
    expect(validateDraft(draft({ name: "   " })).name).toBe("addApps.errors.nameRequired");
  });
  it("counts characters, not UTF-16 units, against the limit of 80", () => {
    expect(validateDraft(draft({ name: "é".repeat(80) })).name).toBeUndefined();
    expect(validateDraft(draft({ name: "😀".repeat(80) })).name).toBeUndefined();
    expect(validateDraft(draft({ name: "x".repeat(81) })).name).toBe("addApps.errors.nameTooLong");
  });
  it("refuses control characters", () => {
    expect(validateDraft(draft({ name: "a\u0007b" })).name).toBe("addApps.errors.nameInvalid");
  });
});

describe("validateDraft: program and shortcut paths", () => {
  const target = (t: string, kind: Draft["kind"] = "exe") =>
    validateDraft(draft({ kind, target: t })).target;

  it("accepts drive, UNC and forward-slash paths, with or without Explorer's quotes", () => {
    expect(target(String.raw`C:\a\b.exe`)).toBeUndefined();
    expect(target("C:/a/b.EXE")).toBeUndefined();
    expect(target(String.raw`\\nas\games\b.exe`)).toBeUndefined();
    expect(target(String.raw`"C:\a b\c.exe"`)).toBeUndefined();
  });
  it("explains what is wrong", () => {
    expect(target("")).toBe("addApps.errors.targetRequired");
    expect(target("jeu.exe")).toBe("addApps.errors.pathNotAbsolute");
    expect(target(String.raw`C:\a\..\b.exe`)).toBe("addApps.errors.pathParent");
    expect(target(String.raw`C:\a\b.txt`)).toBe("addApps.errors.needExe");
    expect(target(String.raw`C:\a\b.exe`, "lnk")).toBe("addApps.errors.needLnk");
    expect(target(String.raw`C:\a\b.lnk`, "lnk")).toBeUndefined();
    expect(target("C:\\" + "a".repeat(600) + ".exe")).toBe("addApps.errors.targetTooLong");
  });
});

describe("validateDraft: links and protocols", () => {
  const target = (t: string, kind: Draft["kind"]) =>
    validateDraft(draft({ kind, target: t })).target;

  it("accepts http(s) addresses only", () => {
    expect(target("https://exemple.fr/a?b=1", "url")).toBeUndefined();
    expect(target("http://localhost:8080", "url")).toBeUndefined();
    expect(target("ftp://exemple.fr", "url")).toBe("addApps.errors.urlInvalid");
    expect(target("javascript:alert(1)", "url")).toBe("addApps.errors.urlInvalid");
    expect(target("https://", "url")).toBe("addApps.errors.urlInvalid");
    expect(target("https://a b.fr", "url")).toBe("addApps.errors.urlInvalid");
    expect(target("", "url")).toBe("addApps.errors.targetRequired");
  });
  it("accepts the launchers' protocols only", () => {
    expect(target("steam://rungameid/10", "uri")).toBeUndefined();
    expect(target("com.epicgames.launcher://apps/x?action=launch", "uri")).toBeUndefined();
    expect(target("cmd://c", "uri")).toBe("addApps.errors.uriInvalid");
    expect(target("steam://", "uri")).toBe("addApps.errors.uriInvalid");
    expect(target("steam:rungameid", "uri")).toBe("addApps.errors.uriInvalid");
  });
});

describe("validateDraft: arguments", () => {
  const args = (a: string) => validateDraft(draft({ args: a })).args;

  it("accepts plain and quoted arguments", () => {
    expect(args("")).toBeUndefined();
    expect(args('-windowed -name "Mon monde"')).toBeUndefined();
  });
  it("refuses an open quote, too many and too long arguments", () => {
    expect(args('-name "Mon monde')).toBe("addApps.errors.argsQuote");
    expect(args(Array.from({ length: 33 }, (_, i) => `a${i}`).join(" "))).toBe(
      "addApps.errors.argsTooMany",
    );
    expect(args("x".repeat(1025))).toBe("addApps.errors.argsTooLong");
  });
  it("ignores the arguments of anything but a program", () => {
    expect(validateDraft(draft({ kind: "url", target: "https://a.fr", args: '"' })).args).toBe(
      undefined,
    );
  });
});

describe("validateDraft: several mistakes at once", () => {
  it("reports every field, so the form can mark them all", () => {
    const errors = validateDraft(draft({ name: "", target: "x", args: '"' }));
    expect(Object.keys(errors).sort()).toEqual(["args", "name", "target"]);
  });
});

describe("splitArgs / joinArgs", () => {
  it("splits on spaces, groups with quotes, keeps empty quoted arguments", () => {
    expect(splitArgs('  -a  "b c" d"e f"g ""')).toEqual(["-a", "b c", "de fg", ""]);
    expect(splitArgs("")).toEqual([]);
    expect(splitArgs('"abc')).toBeNull();
  });
  it("round-trips", () => {
    for (const args of [[], ["-a"], ["-a", "b c", ""], ["--path=C:\\x y\\z"]]) {
      expect(splitArgs(joinArgs(args))).toEqual(args);
    }
  });
  it("cleanTarget strips only the outer quotes and spaces", () => {
    expect(cleanTarget(String.raw`  "C:\a b\c.exe" `)).toBe(String.raw`C:\a b\c.exe`);
  });
});

const entry = (over: Partial<AppEntry> = {}): AppEntry => ({
  id: "mon-jeu",
  name: "Mon jeu",
  category: "jeux",
  source: { kind: "manual" },
  launch: {
    kind: "exe",
    path: String.raw`C:\Jeux\jeu.exe`,
    args: ["-a"],
    cwd: "C:\\Jeux",
    elevated: false,
  },
  match: { exe: "jeu.exe" },
  art: { poster: null, hero: null },
  moodId: null,
  favorite: false,
  ...over,
});

describe("draft <-> app", () => {
  it("builds a manual app that follows the program's process", () => {
    const app = draftToNewApp(
      draft({ args: '-x "y z"', elevated: true, favorite: true, category: "stream" }),
    );
    expect(app.source).toEqual({ kind: "manual" });
    expect(app.match).toEqual({ exe: "jeu.exe" });
    expect(app.category).toBe("stream");
    expect(app.favorite).toBe(true);
    expect(app.launch).toEqual({
      kind: "exe",
      path: String.raw`C:\Jeux\Mon jeu\jeu.exe`,
      args: ["-x", "y z"],
      cwd: null,
      elevated: true,
    });
  });
  it("follows no process for a link or a shortcut", () => {
    expect(draftToNewApp(draft({ kind: "url", target: "https://a.fr" })).match.exe).toBeNull();
    expect(
      draftToNewApp(draft({ kind: "lnk", target: String.raw`C:\a.lnk` })).match.exe,
    ).toBeNull();
  });
  it("opens an existing app as a draft and applies edits without losing the working folder", () => {
    const e = entry();
    const d = entryToDraft(e);
    expect(d).toMatchObject({
      kind: "exe",
      args: "-a",
      target: e.launch.kind === "exe" ? e.launch.path : "",
    });
    const edited = applyDraft(e, { ...d, name: "Renommé", favorite: true });
    expect(edited).toEqual({ ...e, name: "Renommé", favorite: true });
  });
  it("updates the followed process when the program changes", () => {
    const edited = applyDraft(entry(), {
      ...entryToDraft(entry()),
      target: String.raw`C:\Autre\autre.exe`,
    });
    expect(edited.match.exe).toBe("autre.exe");
    expect(edited.launch).toMatchObject({ path: String.raw`C:\Autre\autre.exe`, cwd: "C:\\Jeux" });
  });
  it("never edits the target of an app that belongs to a launcher", () => {
    const steam = entry({
      source: { kind: "steam", appId: "10" },
      launch: { kind: "uri", uri: "steam://rungameid/10" },
      match: { exe: null },
    });
    expect(isTargetLocked(steam)).toBe(true);
    const out = applyDraft(steam, {
      ...entryToDraft(steam),
      name: "Autre",
      target: "https://x.fr",
      kind: "url",
    });
    expect(out.launch).toEqual(steam.launch);
    expect(out.name).toBe("Autre");
  });
  it("keeps an unknown category in 'autres' when opened for editing", () => {
    expect(entryToDraft(entry({ category: "inconnue" })).category).toBe("autres");
  });
});

describe("fieldOfCoreError", () => {
  it("maps the core's field names to form fields", () => {
    expect(fieldOfCoreError("name")).toBe("name");
    expect(fieldOfCoreError("launch.path")).toBe("target");
    expect(fieldOfCoreError("launch.url")).toBe("target");
    expect(fieldOfCoreError("launch.args")).toBe("args");
    expect(fieldOfCoreError("category")).toBeNull();
    expect(fieldOfCoreError(null)).toBeNull();
  });
});

describe("detected apps ticked by default (step 19b)", () => {
  const app = (id: string, over: Partial<DetectedApp> = {}): DetectedApp => ({
    id,
    name: id,
    source: { kind: "startmenu" },
    launch: { kind: "lnk", path: `C:/${id}.lnk` },
    match: { exe: null },
    posterPath: null,
    heroPath: null,
    alreadyAdded: false,
    suggestedCategory: "jeux",
    launcher: false,
    ignored: false,
    ...over,
  });

  it("only the sure ones: new, known category, not a launcher, not ignored", () => {
    const items = [
      app("game"),
      app("tool", { suggestedCategory: "autres" }),
      app("steam", { launcher: true }),
      app("old", { alreadyAdded: true }),
      app("hidden", { ignored: true }),
      app("chat", { suggestedCategory: "logiciels" }),
    ].map((a) => itemFromDetected(a, "startmenu"));
    expect(picksByDefault(items)).toEqual(["game", "chat"]);
  });
});
