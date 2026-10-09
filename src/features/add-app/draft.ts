import type { AppEntry, Launch, NewApp } from "../../ipc/bindings";
import { categoryOf, type CategoryId } from "../home/categories";

/** What a hand-written app can start (packaged apps cannot be typed in: their id is not guessable). */
export type TargetKind = "exe" | "lnk" | "url" | "uri";
export const TARGET_KINDS: readonly TargetKind[] = ["exe", "lnk", "url", "uri"];

/** The manual form's fields, all text as typed. */
export interface Draft {
  name: string;
  kind: TargetKind;
  target: string;
  /** One line, split by `splitArgs`. */
  args: string;
  category: CategoryId;
  favorite: boolean;
  elevated: boolean;
}

export const EMPTY_DRAFT: Draft = {
  name: "",
  kind: "exe",
  target: "",
  args: "",
  category: "jeux",
  favorite: false,
  elevated: false,
};

/** Explorer's "copy as path" wraps the path in quotes: they are never part of it. */
export function cleanTarget(text: string): string {
  return text
    .trim()
    .replace(/^"+|"+$/g, "")
    .trim();
}

/**
 * Splits a command-line style string: spaces separate arguments, double quotes group words
 * (`-name "My World"` → `-name`, `My World`). Returns null when a quote is left open.
 */
export function splitArgs(line: string): string[] | null {
  const args: string[] = [];
  let current = "";
  let started = false;
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') {
      quoted = !quoted;
      started = true;
    } else if (/\s/.test(ch) && !quoted) {
      if (started) args.push(current);
      current = "";
      started = false;
    } else {
      current += ch;
      started = true;
    }
  }
  if (quoted) return null;
  if (started) args.push(current);
  return args;
}

/** Inverse of `splitArgs` (arguments with spaces, or empty ones, get quotes). */
export function joinArgs(args: readonly string[]): string {
  return args.map((a) => (a === "" || /\s/.test(a) ? `"${a}"` : a)).join(" ");
}

function exeName(path: string): string | null {
  const name = path.split(/[\\/]/).pop();
  return name && name.toLowerCase().endsWith(".exe") ? name : null;
}

function launchOf(draft: Draft, cwd: string | null): Launch {
  const target = cleanTarget(draft.target);
  switch (draft.kind) {
    case "exe":
      return {
        kind: "exe",
        path: target,
        args: splitArgs(draft.args) ?? [],
        cwd,
        elevated: draft.elevated,
      };
    case "lnk":
      return { kind: "lnk", path: target };
    case "url":
      return { kind: "url", url: target };
    case "uri":
      return { kind: "uri", uri: target };
  }
}

/** The app the form describes (call only when `validateDraft` found nothing). */
export function draftToNewApp(draft: Draft): NewApp {
  const launch = launchOf(draft, null);
  return {
    name: draft.name.trim(),
    category: draft.category,
    source: { kind: "manual" },
    launch,
    match: { exe: launch.kind === "exe" ? exeName(launch.path) : null },
    art: { poster: null, hero: null },
    moodId: null,
    favorite: draft.favorite,
  };
}

/** The form for an existing app. Packaged apps (`uwp`) have no editable target: null kind. */
export function entryToDraft(entry: AppEntry): Draft {
  const base = {
    name: entry.name,
    category: categoryOf(entry),
    favorite: entry.favorite,
  };
  const { launch } = entry;
  switch (launch.kind) {
    case "exe":
      return {
        ...base,
        kind: "exe",
        target: launch.path,
        args: joinArgs(launch.args),
        elevated: launch.elevated,
      };
    case "lnk":
      return { ...base, kind: "lnk", target: launch.path, args: "", elevated: false };
    case "url":
      return { ...base, kind: "url", target: launch.url, args: "", elevated: false };
    case "uri":
      return { ...base, kind: "uri", target: launch.uri, args: "", elevated: false };
    case "uwp":
      return { ...base, kind: "uri", target: launch.aumid, args: "", elevated: false };
  }
}

/** Only the name, category and favourite can change when the target belongs to a launcher. */
export function isTargetLocked(entry: AppEntry): boolean {
  return (
    entry.source.kind === "steam" || entry.source.kind === "epic" || entry.launch.kind === "uwp"
  );
}

/** `entry` with the form's values applied (the working folder and unrelated fields are kept). */
export function applyDraft(entry: AppEntry, draft: Draft): AppEntry {
  const common = {
    ...entry,
    name: draft.name.trim(),
    category: draft.category,
    favorite: draft.favorite,
  };
  if (isTargetLocked(entry)) return common;
  const cwd = entry.launch.kind === "exe" ? entry.launch.cwd : null;
  const launch = launchOf(draft, cwd);
  const unchanged = JSON.stringify(launch) === JSON.stringify(entry.launch);
  return {
    ...common,
    launch,
    match: unchanged ? entry.match : { exe: launch.kind === "exe" ? exeName(launch.path) : null },
  };
}
