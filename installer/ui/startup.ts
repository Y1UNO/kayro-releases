import type { StartupChoice, StartupEntry } from "./backend";
import { t } from "./messages";

/**
 * « Au démarrage du PC » (step 19): Kayro at login, and what happens to the other apps of this
 * account that start with Windows. Default: only Kayro (its whole point is to launch them), with
 * a warning in red so that nobody is caught out; everything comes back from Kayro's settings.
 */
type Mode = "only" | "custom" | "none";

let kayro = true;
let mode: Mode = "only";
/** The apps ticked in « Choisir » (kept); none at first. */
const keep = new Set<string>();

/** The apps this screen may switch off: the user's own, on, not locked. */
export function changeable(entries: StartupEntry[]): StartupEntry[] {
  return entries.filter((e) => e.enabled && !e.locked);
}

/** What the install applies; nothing to change when no app could be switched off. */
export function startupChoice(entries: StartupEntry[]): StartupChoice {
  const ids = new Set(changeable(entries).map((e) => e.id));
  if (mode === "none" || ids.size === 0) return { kayro, keep: null };
  return { kayro, keep: mode === "only" ? [] : [...keep].filter((id) => ids.has(id)) };
}

/** Up to three names, then « et N autres ». */
export function someNames(entries: StartupEntry[]): string {
  const names = entries.map((e) => e.name);
  if (names.length <= 3) return names.join(", ");
  return t("startup.more", { names: names.slice(0, 3).join(", "), count: names.length - 3 });
}

function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  n.className = className;
  n.append(...children);
  return n;
}

function checkbox(checked: boolean, onChange: (on: boolean) => void): HTMLInputElement {
  const box = node("input", "");
  box.type = "checkbox";
  box.checked = checked;
  box.addEventListener("change", () => onChange(box.checked));
  return box;
}

/** The note under the three choices, redrawn when the choice or the ticks change. */
function note(entries: StartupEntry[]): Node {
  const apps = changeable(entries);
  if (mode === "none") return node("p", "startNote", t("startup.noneHelp"));
  if (mode === "only") {
    return node(
      "div",
      "startWarn",
      node("strong", "", t("startup.warnTitle")),
      node("span", "", t("startup.warnText", { count: apps.length, names: someNames(apps) })),
      node("span", "startUndo", t("startup.undo")),
    );
  }
  const list = node("div", "startList");
  for (const e of apps) {
    list.append(
      node(
        "label",
        "check startItem",
        checkbox(keep.has(e.id), (on) => {
          if (on) keep.add(e.id);
          else keep.delete(e.id);
          refresh(entries);
        }),
        node("span", "", e.name),
      ),
    );
  }
  const off = apps.filter((e) => !keep.has(e.id)).length;
  return node(
    "div",
    "startCustom",
    node("p", "startNote", t("startup.customHelp")),
    list,
    node("p", off ? "startNote startOff" : "startNote", t("startup.customOff", { count: off })),
  );
}

let host: HTMLElement | null = null;

function refresh(entries: StartupEntry[]) {
  if (!host) return;
  // The list keeps its scroll when a box is ticked.
  const scroll = host.querySelector(".startList")?.scrollTop ?? 0;
  host.replaceChildren(note(entries));
  const list = host.querySelector(".startList");
  if (list) list.scrollTop = scroll;
}

/** The screen's rows (after its eyebrow and title). */
export function startupRows(entries: StartupEntry[]): Node[] {
  const rows: Node[] = [
    node(
      "label",
      "check",
      checkbox(kayro, (on) => (kayro = on)),
      node("span", "", t("startup.kayro"), node("small", "checkHelp", t("startup.kayroHelp"))),
    ),
  ];
  if (changeable(entries).length === 0) {
    rows.push(node("p", "startNote", t("startup.alone")));
    return rows;
  }
  const group = node("div", "startModes");
  group.setAttribute("role", "radiogroup");
  group.setAttribute("aria-label", t("startup.others"));
  for (const m of ["only", "custom", "none"] as const) {
    const radio = node("input", "");
    radio.type = "radio";
    radio.name = "startup";
    radio.checked = mode === m;
    radio.addEventListener("change", () => {
      mode = m;
      refresh(entries);
    });
    group.append(node("label", "startMode", radio, node("span", "", t(`startup.${m}`))));
  }
  host = node("div", "startBody");
  host.append(note(entries));
  rows.push(node("p", "startLabel", t("startup.others")), group, host);
  rows.push(node("p", "startNote startFine", t("startup.untouched")));
  return rows;
}
