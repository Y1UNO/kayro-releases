import type { MessageKey } from "../../i18n";
import { cleanTarget, splitArgs, type Draft } from "./draft";

/** Same limits as the Rust core (`config/validate.rs`), which stays the one that decides. */
const MAX_NAME = 80;
const MAX_PATH = 520;
const MAX_URL = 2048;
const MAX_ARGS = 32;
const MAX_ARG_LEN = 1024;
const URI_SCHEMES = ["steam", "com.epicgames.launcher"];

export type DraftField = "name" | "target" | "args";
export type DraftErrors = Partial<Record<DraftField, MessageKey>>;

// eslint-disable-next-line no-control-regex -- detecting control characters is the point
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;

function checkName(name: string): MessageKey | null {
  const trimmed = name.trim();
  if (trimmed === "") return "addApps.errors.nameRequired";
  if (Array.from(trimmed).length > MAX_NAME) return "addApps.errors.nameTooLong";
  if (CONTROL.test(trimmed)) return "addApps.errors.nameInvalid";
  return null;
}

/** `C:\…`, `C:/…` or `\\server\share\…` */
function isAbsolutePath(path: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(path) || /^\\\\[^\\/]+[\\/][^\\/]+/.test(path);
}

function checkPath(path: string, extension: "exe" | "lnk"): MessageKey | null {
  if (path === "") return "addApps.errors.targetRequired";
  if (Array.from(path).length > MAX_PATH) return "addApps.errors.targetTooLong";
  if (CONTROL.test(path)) return "addApps.errors.targetInvalid";
  if (!isAbsolutePath(path)) return "addApps.errors.pathNotAbsolute";
  if (path.split(/[\\/]/).includes("..")) return "addApps.errors.pathParent";
  if (!path.toLowerCase().endsWith(`.${extension}`)) {
    return extension === "exe" ? "addApps.errors.needExe" : "addApps.errors.needLnk";
  }
  return null;
}

function checkUrl(url: string): MessageKey | null {
  if (url === "") return "addApps.errors.targetRequired";
  if (Array.from(url).length > MAX_URL) return "addApps.errors.targetTooLong";
  if (CONTROL.test(url) || /\s/.test(url)) return "addApps.errors.urlInvalid";
  return /^https?:\/\/[^/\s]/i.test(url) ? null : "addApps.errors.urlInvalid";
}

function checkUri(uri: string): MessageKey | null {
  if (uri === "") return "addApps.errors.targetRequired";
  if (Array.from(uri).length > MAX_URL) return "addApps.errors.targetTooLong";
  if (CONTROL.test(uri) || /\s/.test(uri)) return "addApps.errors.uriInvalid";
  const split = uri.indexOf("://");
  if (split < 0) return "addApps.errors.uriInvalid";
  const scheme = uri.slice(0, split);
  return URI_SCHEMES.includes(scheme) && uri.length > split + 3
    ? null
    : "addApps.errors.uriInvalid";
}

function checkArgs(line: string): MessageKey | null {
  const args = splitArgs(line);
  if (args === null) return "addApps.errors.argsQuote";
  if (args.length > MAX_ARGS) return "addApps.errors.argsTooMany";
  if (args.some((a) => Array.from(a).length > MAX_ARG_LEN)) return "addApps.errors.argsTooLong";
  return null;
}

/** Message key per invalid field; empty when the form can be submitted. Pure, no I/O. */
export function validateDraft(draft: Draft): DraftErrors {
  const errors: DraftErrors = {};
  const name = checkName(draft.name);
  if (name) errors.name = name;

  const target = cleanTarget(draft.target);
  const targetError =
    draft.kind === "exe"
      ? checkPath(target, "exe")
      : draft.kind === "lnk"
        ? checkPath(target, "lnk")
        : draft.kind === "url"
          ? checkUrl(target)
          : checkUri(target);
  if (targetError) errors.target = targetError;

  if (draft.kind === "exe") {
    const args = checkArgs(draft.args);
    if (args) errors.args = args;
  }
  return errors;
}

export function isValid(errors: DraftErrors): boolean {
  return Object.keys(errors).length === 0;
}

/** Which form field a refusal from the core is about (`launch.path` → target…). */
export function fieldOfCoreError(field: string | null): DraftField | null {
  if (!field) return null;
  if (field === "name") return "name";
  if (field === "launch.args") return "args";
  if (field.startsWith("launch.")) return "target";
  return null;
}
