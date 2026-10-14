// Kayro performance bench: the cases of block M and how to reach the state each one needs.
// A case = { id, title, at, settings?, qualities?, scenario?, during?, page?, costOnly?, settle? }.
// `at`: fan | carousel | empty | settings:<tab> | editor | window | widget | hidden.
import { mark, sleep } from "./lib.mjs";
import {
  ACTIVE,
  ADVANCED,
  card,
  dialogOpen,
  fanCard,
  hoverChange,
  hoverContinuous,
  hoverFlood,
  NONE,
  onFan,
  SWITCH,
  toggleEvery,
} from "./states.mjs";
export { ensure } from "./states.mjs";

// ---------- the cases, in run order (grouped by state: the fewest moves between them) ----------
export const CASES = [
  { id: "R1", title: "Éventail au repos", at: "fan" },
  { id: "R5", title: "Éventail, particules Non", at: "fan", settings: { particles: false } },
  {
    id: "I2",
    title: "Survol continu, éventail",
    at: "fan",
    scenario: hoverContinuous(fanCard("creativite")),
  },
  {
    id: "I4",
    title: "Survol qui change, éventail",
    at: "fan",
    scenario: hoverChange([fanCard("stream"), fanCard("creativite"), fanCard("jeux"), null]),
    during: [{ name: "survol", re: /hover/, dur: 1100 }],
  },
  {
    id: "I8",
    title: "Liaison éventail → carrousel (+ retour)",
    at: "fan",
    scenario: async (X, c) => {
      if (!(await onFan(X))) {
        await X.s.clickText("Toutes les catégories");
        await c.wait(2300);
      }
      await mark(X.s, "link");
      await X.s.clickSel(fanCard("jeux"));
      await X.s.move(NONE.x, NONE.y);
      await c.wait(2250);
      await mark(X.s, "back");
      await X.s.clickText("Toutes les catégories");
      await X.s.move(NONE.x, NONE.y);
      await c.wait(2250);
    },
    during: [
      { name: "liaison", re: /^link$/, dur: 2200 },
      { name: "retour", re: /^back$/, dur: 1700 },
    ],
    after: async (X) => {
      await sleep(1500);
      X.at = (await onFan(X)) ? "fan" : "carousel";
    },
  },
  { id: "R2", title: "Carrousel au repos, Visible", at: "carousel" },
  {
    id: "R2-max",
    title: "Carrousel, Marquée + particules",
    at: "carousel",
    settings: { cardFloat: "strong" },
  },
  {
    id: "R3",
    title: "Carrousel au repos, Aucune",
    at: "carousel",
    settings: { cardFloat: "none" },
  },
  { id: "R6", title: "Carrousel, particules Non", at: "carousel", settings: { particles: false } },
  {
    id: "I1",
    title: "Survol continu, carrousel",
    at: "carousel",
    scenario: hoverContinuous(ACTIVE),
  },
  {
    id: "I3",
    title: "Survol qui change, carrousel",
    at: "carousel",
    scenario: hoverChange([card("banc-02"), card("banc-03"), card("banc-01"), null]),
    during: [{ name: "survol", re: /hover/, dur: 1100 }],
  },
  {
    id: "I9",
    title: "Survol rapide (≥ 1 000 év./s), carrousel",
    at: "carousel",
    scenario: hoverFlood,
  },
  {
    id: "I5",
    title: "Changement d'onglet",
    at: "carousel",
    scenario: async (X, c) => {
      for (const cat of ["stream", "logiciels", "jeux"]) {
        if (c.stop) return;
        await mark(X.s, "tab");
        await X.s.clickSel(`[role=tab][data-drop-category="${cat}"]`);
        await X.s.move(NONE.x, NONE.y);
        await c.wait(1500);
      }
    },
    during: [{ name: "onglet", re: /tab/, dur: 1300 }],
    after: async (X) => {
      X.at = null; // the tab left selected is not known: ensure() puts Jeux back
    },
  },
  { id: "R9", title: "Catégorie vide", at: "empty" },
  {
    id: "I6",
    title: "Panneau Réglages (ouvre / ferme)",
    at: "carousel",
    scenario: async (X, c) => {
      await mark(X.s, "open");
      await X.s.clickText("Réglages");
      await c.wait(750);
      await mark(X.s, "close");
      await X.s.clickText("Fermer", "[role=dialog]");
      await X.s.move(NONE.x, NONE.y);
      await c.wait(750);
    },
    during: [
      { name: "ouverture", re: /^open$/, dur: 600 },
      { name: "fermeture", re: /^close$/, dur: 400 },
    ],
    after: async (X) => {
      await sleep(500);
      if (await dialogOpen(X)) {
        await X.s.clickText("Fermer", "[role=dialog]");
        await sleep(800);
      }
    },
  },
  {
    id: "I7",
    title: "Interrupteur",
    at: "settings:Visuel",
    scenario: toggleEvery("switch", 1500, (X) => X.s.clickSel(SWITCH)),
    during: [{ name: "bascule", re: /switch/, dur: 400 }],
    before: async (X) =>
      (X.switch0 = await X.s.evaluate(
        `document.querySelector('${SWITCH}').getAttribute('aria-checked')`,
      )),
    after: async (X) => {
      await sleep(500);
      if (
        (await X.s.evaluate(`document.querySelector('${SWITCH}').getAttribute('aria-checked')`)) !==
        X.switch0
      )
        await X.s.clickSel(SWITCH);
      await sleep(600);
    },
  },
  {
    id: "A3",
    title: "Déroulé « Personnalisation avancée »",
    at: "settings:Visuel",
    scenario: async (X, c) => {
      await mark(X.s, "unroll-open");
      await X.s.clickSel(ADVANCED);
      await c.wait(2000);
      await mark(X.s, "unroll-close");
      await X.s.clickSel(ADVANCED);
      await c.wait(2000);
    },
    during: [
      { name: "ouverture", re: /unroll-open/, dur: 1000 },
      { name: "fermeture", re: /unroll-close/, dur: 400 },
    ],
    after: async (X) => {
      await sleep(500);
      if (
        (await X.s.evaluate(
          `document.querySelector('${ADVANCED}').getAttribute('aria-expanded')`,
        )) === "true"
      )
        await X.s.clickSel(ADVANCED);
      await sleep(800);
    },
  },
  {
    id: "A2",
    title: "Onde de thème (Éco : fondu)",
    at: "settings:Thèmes",
    scenario: async (X, c) => {
      for (const th of ["Thème Bleu-gris", "Thème Lavande-pêche"]) {
        if (c.stop) return;
        await mark(X.s, "swap");
        await X.s.clickText(th, "[role=dialog]");
        await c.wait(2500);
      }
    },
    during: [{ name: "onde", re: /swap/, dur: 1300 }],
    after: async (X) => {
      await sleep(2600);
      if (
        (await X.s.evaluate(`document.documentElement.getAttribute('data-theme')`)) !==
        "lavande-peche"
      ) {
        await X.s.clickText("Thème Lavande-pêche", "[role=dialog]");
        await sleep(2600);
      }
    },
  },
  {
    id: "A6",
    title: "Menu du mode (ouvre / ferme)",
    at: "carousel",
    qualities: ["high"],
    scenario: async (X, c) => {
      await mark(X.s, "menu");
      await X.s.clickText("Mode d’affichage");
      await c.wait(750);
      if (await X.s.has("[role=menu]")) await X.s.key("Escape", { vk: 27 }); // closes the menu only
      await c.wait(750);
    },
    during: [{ name: "menu", re: /menu/, dur: 400 }],
    after: async (X) => {
      await sleep(500);
      if (await X.s.has("[role=menu]")) await X.s.key("Escape", { vk: 27 });
      await sleep(500);
    },
  },
  {
    id: "E1",
    title: "Éditeur : réordonner (Alt+↓ / Alt+↑)",
    at: "editor",
    scenario: async (X, c) => {
      for (const [key, vk] of [
        ["ArrowDown", 40],
        ["ArrowUp", 38],
      ]) {
        if (c.stop) return;
        await focusFirstStep(X);
        await mark(X.s, "move");
        await X.s.key(key, { vk, modifiers: 1 });
        await c.wait(1500);
      }
    },
    during: [{ name: "déplacement", re: /move/, dur: 600 }],
    after: async (X) => {
      for (let i = 0; i < 4 && (await stepOrder(X)) !== "1,2,3,4"; i++) {
        await focusFirstStep(X);
        await sleep(120);
        await X.s.key("ArrowUp", { vk: 38, modifiers: 1 });
        await sleep(900);
      }
    },
  },
  { id: "R7", title: "Mode fenêtre au repos", at: "window" },
  {
    id: "A4",
    title: "Passage immersif ⇄ fenêtre",
    at: "window",
    settle: 500,
    probe: { opacity: true },
    scenario: async (X, c) => {
      await mark(X.s, "to-imm");
      await X.s.settings({ displayMode: "immersive" });
      await c.wait(3000);
      await mark(X.s, "to-win");
      await X.s.settings({ displayMode: "window" });
      await c.wait(3000);
    },
    during: [{ name: "passage", re: /to-/, dur: 700 }],
    after: async (X) => {
      await sleep(3200);
      X.at = null; // immersive or window: leave() cannot tell, ensure() resets
      await X.s.settings({ displayMode: "immersive" });
      await sleep(3000);
    },
  },
  { id: "R8", title: "Widget au repos", at: "widget", page: "widget" },
  {
    id: "A5",
    title: "Widget qui se déplie / se replie",
    at: "widget",
    page: "widget",
    scenario: async (X, c) => {
      await mark(X.w, "unroll");
      await X.w.clickSel("button[aria-expanded]");
      await c.wait(1500);
      await mark(X.w, "fold");
      await X.w.clickSel("button[aria-expanded]");
      await c.wait(1500);
    },
    during: [
      { name: "déroulé", re: /unroll/, dur: 800 },
      { name: "repli", re: /fold/, dur: 400 },
    ],
    after: async (X) => {
      await sleep(800);
      if (
        (await X.w.evaluate(
          `document.querySelector('button[aria-expanded]').getAttribute('aria-expanded')`,
        )) === "true"
      )
        await X.w.clickSel("button[aria-expanded]");
      await sleep(800);
    },
  },
  { id: "R10", title: "Hub masqué (coût seul)", at: "hidden", qualities: ["high"], costOnly: true },
];

function focusFirstStep(X) {
  return X.s.evaluate(
    `(() => { const b = [...document.querySelectorAll('button')].find(b => /^Déplacer l’étape/.test(b.getAttribute('aria-label') || '') && b.closest('[data-row-key="1"]')); if (b) b.focus(); return !!b; })()`,
  );
}
function stepOrder(X) {
  return X.s.evaluate(
    `[...document.querySelectorAll('[data-step-row]')].map(r => r.getAttribute('data-row-key')).join(',')`,
  );
}

/** Case ids for `--cases` (exact id, or a prefix such as « R2 » for R2 and R2-max). */
export function select(list) {
  if (!list) return CASES;
  const want = list.split(",").map((x) => x.trim().toUpperCase());
  return CASES.filter((c) =>
    want.some((w) => c.id.toUpperCase() === w || c.id.toUpperCase().startsWith(w + "-")),
  );
}
