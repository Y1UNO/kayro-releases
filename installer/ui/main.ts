import "@fontsource-variable/cormorant-garamond";
import "@fontsource-variable/manrope";
import "./style.css";
import "./startup.css";
import icon from "../../src-tauri/icons/128x128@2x.png";
import {
  fakeBackend,
  tauriBackend,
  type Backend,
  type Info,
  type StartupEntry,
} from "./backend";
import { t, type MessageKey } from "./messages";
import { notesView, scrollToNewest } from "./notes";
import { startupChoice, startupRows } from "./startup";

/**
 * Kayro's installer window: a fan of glass cards on the left, one screen at a time on the right
 * (welcome / Kayro open / installing / done / failed…). The core (installer/src) does the work.
 */
const backend: Backend =
  import.meta.env.DEV && !("__TAURI_INTERNALS__" in window)
    ? fakeBackend(new URLSearchParams(location.search).get("screen"))
    : tauriBackend;

type Mode = "install" | "update" | "reinstall";
type Screen =
  | { name: "welcome" | "startup"; mode: Mode }
  | { name: "running" | "stuck" | "installing" | "done" | "newer" | "missing" }
  | { name: "failed"; code: number };

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const panel = document.getElementById("panel")!;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let info: Info;
/** The apps Windows starts at login (step 19), read once. */
let startupEntries: StartupEntry[] = [];
let desktop = true;
/** Step 18b: look for updates at start (checked, explained, the user may untick it). */
let updateAuto = true;
let installing = false;
/** The screen of the « Installation » tab, and the tab shown. */
let current: Screen | null = null;
let tab: "install" | "notes" = "install";

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.append(...children);
  return node;
}

function msg(prefix: string, part: string, vars: Record<string, string | number> = {}): string {
  return t(`${prefix}.${part}` as MessageKey, vars);
}

function button(label: string, primary: boolean, onClick: (b: HTMLButtonElement) => void) {
  const b = el("button", primary ? "btn primary" : "btn", label);
  b.type = "button";
  if (primary) b.dataset.primary = "";
  b.addEventListener("click", () => onClick(b));
  return b;
}

function build(s: Screen): Node[] {
  const key = s.name === "welcome" ? s.mode : s.name;
  if (s.name === "startup") return buildStartup(s.mode);
  const vars = {
    version: info.version,
    installed: info.installed ?? "",
    code: s.name === "failed" ? s.code : "",
  };
  const parts: Node[] = [
    el("p", "eyebrow", msg(key, "eyebrow")),
    el("h1", "title", msg(key, "title", vars)),
  ];
  if (s.name === "welcome" && s.mode === "install") parts.push(el("span", "chip", t("chip", vars)));
  parts.push(el("p", "lead", msg(key, "lead", vars)));
  const actions = el("div", "actions");
  const close = () => button(t("close"), false, () => void backend.quit());
  switch (s.name) {
    case "welcome": {
      if (s.mode === "install") {
        parts.push(
          el("ul", "facts", el("li", "", t("factAccount")), el("li", "", t("factOffline"))),
        );
      }
      const box = el("input", "");
      box.type = "checkbox";
      box.checked = desktop;
      box.addEventListener("change", () => (desktop = box.checked));
      parts.push(el("label", "check", box, el("span", "", t("desktop"))));
      const upd = el("input", "");
      upd.type = "checkbox";
      upd.checked = updateAuto;
      upd.addEventListener("change", () => (updateAuto = upd.checked));
      parts.push(
        el(
          "label",
          "check",
          upd,
          el("span", "", t("updateAuto"), el("small", "checkHelp", t("updateAutoHelp"))),
        ),
      );
      const next = () => void show({ name: "startup", mode: s.mode });
      actions.append(button(t("next"), true, next));
      break;
    }
    case "running":
      actions.append(
        button(t("running.back"), false, () => void show({ name: "welcome", mode: mode() })),
        button(t("running.go"), true, (b) => void closeThenInstall(b)),
      );
      break;
    case "stuck":
      actions.append(
        close(),
        button(t("stuck.go"), true, (b) => void closeThenInstall(b)),
      );
      break;
    case "installing":
      parts.push(el("div", "progress", el("span", "")));
      break;
    case "done":
      actions.append(
        close(),
        button(t("done.go"), true, () => void backend.launch()),
      );
      break;
    case "failed":
      actions.append(
        close(),
        button(t("failed.go"), true, () => void backend.classic()),
      );
      break;
    default:
      actions.append(button(t("close"), true, () => void backend.quit()));
  }
  if (actions.childElementCount) parts.push(actions);
  return parts;
}

/** « Au démarrage du PC »: Kayro at login and the other apps (installer/ui/startup.ts). */
function buildStartup(m: Mode): Node[] {
  const back = () => void show({ name: "welcome", mode: m });
  return [
    el("p", "eyebrow", t("startup.eyebrow")),
    el("h1", "title startTitle", t("startup.title")),
    ...startupRows(startupEntries),
    el(
      "div",
      "actions",
      button(t("back"), false, back),
      button(msg(m, "go"), true, () => void startInstall()),
    ),
  ];
}

/** Fades the panel out, puts `nodes` in, and lets them rise in a cascade. */
async function swap(nodes: Node[]) {
  if (!reduced && panel.childElementCount) {
    panel.classList.add("leaving");
    await wait(170);
  }
  nodes.forEach((p, i) => (p as HTMLElement).style.setProperty("--i", String(i)));
  panel.replaceChildren(...nodes);
  panel.classList.remove("leaving", "entering");
  void panel.offsetWidth; // restart the cascade
  panel.classList.add("entering");
}

async function show(s: Screen) {
  current = s;
  document.body.dataset.state = s.name;
  if (tab !== "install") return; // shown when the user comes back to the tab
  await swap(build(s));
  panel.querySelector<HTMLElement>("[data-primary]")?.focus();
}

/** « Installation » · « Patch notes »: the install goes on behind the notes. */
async function openTab(next: "install" | "notes") {
  if (next === tab) return;
  tab = next;
  document.body.dataset.tab = next;
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-tab]")) {
    b.setAttribute("aria-selected", String(b.dataset.tab === next));
  }
  if (next === "notes") {
    await swap([notesView()]);
    scrollToNewest(panel);
  } else if (current) await show(current);
}

function mode(): Mode {
  if (!info.installed) return "install";
  return info.installed === info.version ? "reinstall" : "update";
}

async function startInstall() {
  const now = await backend.info();
  if (now.running) return show({ name: "running" });
  installing = true;
  await show({ name: "installing" });
  const started = performance.now();
  const outcome = await backend.install(desktop, updateAuto, startupChoice(startupEntries));
  // Long enough to read: a fast install would only flash the screen.
  await wait(Math.max(0, 1800 - (performance.now() - started)));
  installing = false;
  await show(outcome.kind === "done" ? { name: "done" } : { name: "failed", code: outcome.code });
}

async function closeThenInstall(b: HTMLButtonElement) {
  b.disabled = true;
  b.textContent = t("running.busy");
  if (await backend.closeKayro()) await startInstall();
  else await show({ name: "stuck" });
}

function setupChrome() {
  document.title = t("windowTitle");
  const logo = document.getElementById("logo") as HTMLImageElement;
  logo.src = icon;
  const min = document.getElementById("min")!;
  const close = document.getElementById("close")!;
  min.setAttribute("aria-label", t("minimize"));
  close.setAttribute("aria-label", t("close"));
  min.addEventListener("click", () => void backend.minimize());
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-tab]")) {
    b.textContent = t(b.dataset.tab === "notes" ? "tabNotes" : "tabInstall");
    b.addEventListener(
      "click",
      () => void openTab(b.dataset.tab === "notes" ? "notes" : "install"),
    );
  }
  close.addEventListener("click", () => {
    if (!installing) void backend.quit();
  });
  backend.onCloseRequested(() => !installing);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !installing) void backend.quit();
  });
  // A few motes of light rising in the background (CSS animation; none when motion is reduced).
  const sky = document.getElementById("motes")!;
  for (let i = 0; i < 16; i++) {
    const m = el("span", "mote");
    m.style.left = `${(i * 37) % 100}%`;
    m.style.setProperty("--d", `${9 + ((i * 7) % 8)}s`);
    m.style.setProperty("--delay", `${-((i * 13) % 12)}s`);
    sky.append(m);
  }
}

async function main() {
  setupChrome();
  info = await backend.info();
  startupEntries = await backend.startupList().catch(() => []);
  if (!info.ready) return show({ name: "missing" });
  if (info.newerInstalled) return show({ name: "newer" });
  return show({ name: "welcome", mode: mode() });
}

void main();
