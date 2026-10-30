import "@fontsource-variable/cormorant-garamond";
import "@fontsource-variable/manrope";
import "./style.css";
import icon from "../../src-tauri/icons/128x128@2x.png";
import { fakeBackend, tauriBackend, type Backend, type Info } from "./backend";
import { t, type MessageKey } from "./messages";

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
  | { name: "welcome"; mode: Mode }
  | { name: "running" | "stuck" | "installing" | "done" | "newer" | "missing" }
  | { name: "failed"; code: number };

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const panel = document.getElementById("panel")!;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let info: Info;
let desktop = true;
let installing = false;

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
      actions.append(button(msg(s.mode, "go"), true, () => void startInstall()));
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
  parts.forEach((p, i) => (p as HTMLElement).style.setProperty("--i", String(i)));
  return parts;
}

async function show(s: Screen) {
  document.body.dataset.state = s.name;
  if (!reduced && panel.childElementCount) {
    panel.classList.add("leaving");
    await wait(170);
  }
  panel.replaceChildren(...build(s));
  panel.classList.remove("leaving", "entering");
  void panel.offsetWidth; // restart the cascade
  panel.classList.add("entering");
  panel.querySelector<HTMLElement>("[data-primary]")?.focus();
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
  const outcome = await backend.install(desktop);
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
  if (!info.ready) return show({ name: "missing" });
  if (info.newerInstalled) return show({ name: "newer" });
  return show({ name: "welcome", mode: mode() });
}

void main();
