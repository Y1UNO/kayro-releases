import notes from "./patchNotes.json";
import { t } from "./messages";

/** One version of the patch notes (installer/ui/patchNotes.json, oldest first). */
interface Entry {
  version: string;
  date: string;
  title: string;
  points: string[];
}

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

/**
 * The « Patch notes » tab: every version from the idea to now, in order, as a timeline of
 * entries that unfold (the newest open; `scrollToNewest` once it is on screen).
 */
export function notesView(): HTMLElement {
  const list = notes as Entry[];
  const items = list.map((n, i) => {
    const last = i === list.length - 1;
    const head = el(
      "summary",
      "noteHead",
      el("span", "noteVersion", n.version),
      el("span", "noteTitle", n.title),
      el("span", "noteDate", n.date),
    );
    if (last) head.append(el("span", "noteNow", t("notesNow")));
    const body = el("ul", "notePoints", ...n.points.map((p) => el("li", "", p)));
    const item = el("details", "note", head, body);
    item.open = last;
    return item;
  });
  const scroll = el("div", "notesScroll", ...items);
  const view = el(
    "div",
    "notes",
    el("p", "eyebrow", t("notesEyebrow")),
    el("h1", "title notesTitle", t("notesTitle")),
    scroll,
  );
  return view;
}

/** Shows the newest version (the end of the timeline). */
export function scrollToNewest(root: ParentNode): void {
  const scroll = root.querySelector<HTMLElement>(".notesScroll");
  if (scroll) scroll.scrollTop = scroll.scrollHeight;
}
