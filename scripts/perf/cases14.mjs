// Kayro performance bench, step 14: the game colours. These cases need the generated pictures
// (`--art`, automatic with a G case: data.mjs gives posters, heroes and logos to the « Stream »
// apps, whose palettes the core computes at start). They measure the tide between games (V7 c),
// a burst that must change nothing until it ends (V8 b), the category link with the colours, and
// the carousel with posters (at rest, hover).
import { mark, sleep } from "./lib.mjs";
import { card, fanCard, hoverChange, NONE, onFan } from "./states.mjs";

const STREAM = `[role=tab][data-drop-category="stream"]`;

async function toStream(X) {
  await X.s.clickSel(STREAM);
  await X.s.move(NONE.x, NONE.y);
  await sleep(1800); // the tab change, then its first tide
}

/** The tab left selected is « Stream »: ensure() puts « Jeux » back for the next case. */
async function leave(X) {
  await sleep(800);
  X.at = null;
}

/** Right to the end of the 4 « Stream » apps, then back. */
const WALK = [
  ["ArrowRight", 39],
  ["ArrowRight", 39],
  ["ArrowRight", 39],
  ["ArrowLeft", 37],
  ["ArrowLeft", 37],
  ["ArrowLeft", 37],
];

/** The category link onto « Stream » and back, with the game colours of `mode`. */
function linkCase(id, mode, label) {
  return {
    id,
    title: `Liaison éventail → Stream (+ retour), couleurs ${label}`,
    at: "fan",
    settings: { colorMode: mode },
    scenario: async (X, c) => {
      if (!(await onFan(X))) {
        await X.s.clickText("Toutes les catégories");
        await c.wait(2300);
      }
      await mark(X.s, "link");
      await X.s.clickSel(fanCard("stream"));
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
      X.at = (await onFan(X)) ? "fan" : null;
    },
  };
}

export const GAME_CASES = [
  {
    id: "G1",
    title: "Couleurs du jeu : flèches dans le carrousel (marée)",
    at: "carousel",
    settings: { colorMode: "light" },
    before: toStream,
    scenario: async (X, c) => {
      for (const [key, vk] of WALK) {
        if (c.stop) return;
        await mark(X.s, "game");
        await X.s.key(key, { vk });
        await c.wait(1400);
      }
    },
    during: [{ name: "marée", re: /^game$/, dur: 1100 }],
    after: leave,
  },
  {
    id: "G2",
    title: "Couleurs du jeu : rafale de flèches (une seule marée, à la fin)",
    at: "carousel",
    settings: { colorMode: "light" },
    before: toStream,
    scenario: async (X, c) => {
      for (const keys of [WALK.slice(0, 3), WALK.slice(3)]) {
        if (c.stop) return;
        await mark(X.s, "burst");
        for (const [key, vk] of keys) {
          await X.s.key(key, { vk });
          await sleep(40);
        }
        await c.wait(1600);
      }
    },
    during: [{ name: "rafale", re: /^burst$/, dur: 1500 }],
    after: leave,
  },
  linkCase("G3", "light", "Léger"),
  linkCase("G3-imm", "immersive", "Immersif"),
  {
    id: "G4",
    title: "Carrousel au repos avec affiches (Stream)",
    at: "carousel",
    before: toStream,
    after: leave,
  },
  {
    id: "G5",
    title: "Survol qui change avec affiches (Stream)",
    at: "carousel",
    before: toStream,
    scenario: hoverChange([card("banc-08"), card("banc-09"), card("banc-07"), null]),
    during: [{ name: "survol", re: /hover/, dur: 1100 }],
    after: leave,
  },
];
