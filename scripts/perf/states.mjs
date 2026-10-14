// Kayro performance bench: the states a case needs (fan, carousel, settings, editor, window,
// widget), how to reach them from wherever the previous case left the page, and the scenarios
// shared by several cases.
import { connect, mark, ready, sleep } from "./lib.mjs";

export const NONE = { x: 40, y: 600 }; // an empty spot of the page: the pointer hovers nothing there
export const ACTIVE = "[data-app-id][data-active] button[role=option]";
export const card = (id) => `[data-app-id="${id}"] button[role=option]`;
export const fanCard = (cat) => `[data-fan-card="${cat}"]`;
export const SWITCH = "[role=dialog] [role=switch]";
export const ADVANCED = "[role=dialog] button[aria-expanded]";

// ---------- states ----------
export const onFan = (X) => X.s.has(fanCard("jeux"));
export const dialogOpen = (X) => X.s.has("[role=dialog]");

async function leave(X, next) {
  const was = X.at ?? "";
  if (was.startsWith("settings") && !next.startsWith("settings") && (await dialogOpen(X))) {
    await X.s.clickText("Fermer", "[role=dialog]");
    await sleep(800);
  }
  if (was === "editor" && next !== "editor") {
    await X.s.clickText("Scènes");
    await sleep(1200);
    if (await dialogOpen(X)) {
      await X.s.clickText("Abandonner", "[role=dialog]"); // the test scene only, never saved
      await sleep(1000);
    }
    await X.s.clickText("Accueil");
    await sleep(1600);
  }
  if (was === "window" && next !== "window") {
    await X.s.settings({ displayMode: "immersive" });
    await sleep(3000);
  }
  if (was === "widget" && next !== "widget") {
    await X.w.settings({ displayMode: "immersive" });
    X.w.close();
    X.w = null;
    await sleep(3000);
    X.s.close();
    X.s = await connect();
    await ready(X.s);
    await sleep(800);
  }
}

async function toFan(X) {
  if (await onFan(X)) return;
  await X.s.clickText("Toutes les catégories");
  await sleep(2300);
}
async function toCategory(X, cat) {
  if (await onFan(X)) {
    await X.s.clickSel(fanCard(cat));
    await sleep(2700);
  } else if (!(await X.s.has(`[role=tab][data-drop-category="${cat}"][aria-selected="true"]`))) {
    await X.s.clickSel(`[role=tab][data-drop-category="${cat}"]`);
    await sleep(1600);
  }
}

/** Puts the page in the state `at` (from wherever the previous case left it). */
export async function ensure(X, at) {
  if (X.at === at) return;
  await leave(X, at);
  if (at === "fan") await toFan(X);
  else if (at === "carousel") await toCategory(X, "jeux");
  else if (at === "empty") await toCategory(X, "creativite");
  else if (at.startsWith("settings:")) {
    if (!(X.at ?? "").startsWith("settings")) {
      await toCategory(X, "jeux");
      await X.s.clickText("Réglages");
      await sleep(800);
    }
    await X.s.clickText(at.slice(9), "[role=dialog]");
    await sleep(700);
  } else if (at === "editor") {
    await toCategory(X, "jeux");
    await X.s.clickText("Gérer les scènes");
    await sleep(1300);
    await X.s.clickText("Modifier Banc, 4 étapes");
    await sleep(1600);
  } else if (at === "window") {
    await toCategory(X, "jeux");
    await X.s.settings({ displayMode: "window" });
    await sleep(2500);
  } else if (at === "widget") {
    await toCategory(X, "jeux");
    await X.s.settings({ displayMode: "widget" });
    await sleep(3000);
    X.w = await connect({ widget: true, timeoutMs: 6000 });
    await ready(X.w);
    await sleep(800);
  }
  X.at = at;
  await X.s.move(NONE.x, NONE.y);
}

// ---------- scenarios (one cycle; the runner repeats it until told to stop) ----------
export const hoverContinuous = (sel) => async (X, c) => {
  const b = await X.s.box(sel);
  for (let i = 0; i < 20 && !c.stop; i++) {
    await X.s.move(b.x + (i % 2 ? 3 : -2), b.y + (i % 3) - 1);
    await c.wait(100);
  }
};
export const hoverChange = (sels) => async (X, c) => {
  for (const sel of sels) {
    if (c.stop) return;
    const b = sel ? await X.s.box(sel) : NONE;
    await mark(X.s, "hover");
    await X.s.move(b.x, b.y);
    await c.wait(1200);
  }
};
/** ≥ 1 000 pointer moves a second over the active card, in bursts of 50 (a fast mouse). */
export const hoverFlood = async (X, c) => {
  const b = await X.s.box(ACTIVE);
  const pts = Array.from({ length: 50 }, (_, i) => [
    b.x + 6 * Math.cos(i / 4),
    b.y + 6 * Math.sin(i / 4),
  ]);
  while (!c.stop) {
    await X.s.moveBurst(pts);
    c.sent = (c.sent ?? 0) + pts.length;
  }
};
export const toggleEvery = (label, ms, act) => async (X, c) => {
  await mark(X.s, label);
  await act(X);
  await c.wait(ms);
};
