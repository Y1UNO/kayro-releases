// Step-14 board: the home screen with the real themes and the real Steam posters of this PC, and
// one selector per visual decision (V1–V10). Defaults = the user's starting preferences.
(() => {
"use strict";
const { derive } = window.Derive;
const DATA = window.PLANCHE;
/** Address of an image: its file:// URL from the disk, the local server's otherwise (serve.mjs). */
const src = (img) => (location.protocol === "file:" ? img.url : img.http);

const DECISIONS = [
  ["mode", "Couleurs du jeu", "Le réglage visible (Réglages › Visuel).", [["off", "Désactivé"], ["light", "Léger"], ["immersive", "Immersif"]], "light"],
  ["v1", "V1 · Intensité par défaut", "Part de la couleur du jeu mêlée au thème.", [["a", "35 % : le thème domine"], ["b", "60 %"], ["c", "100 % : le thème ne sert plus que de bornes"]], "b"],
  ["v2", "V2 · Ce qui se teinte en Léger", "", [["a", "L’ambiance seule (lune, anneau, bokeh) ; l’interface reste au thème"], ["b", "+ accents : filet du titre, onglet actif, anneau de focus, filets de survol"], ["c", "+ verre des barres et texte doux"]], "b"],
  ["v3", "V3 · L’Immersif en plus", "Visible avec « Immersif ».", [["a", "Fond et brume aux couleurs du jeu"], ["b", "+ héros flouté par Steam en haut, fondu dans la nuit"], ["c", "+ héros net, voilé, derrière la lune"]], "b"],
  ["v4", "V4 · Ce qui ne se teinte jamais", "Voir l’éventail (avec V10 b) et l’aperçu du widget.", [["a", "Texte, dialogues, Réglages"], ["b", "+ l’éventail des catégories"], ["c", "+ le widget"]], "a"],
  ["v5", "V5 · Choix de A et B", "", [["a", "Dominante → accent"], ["b", "Les deux plus vives"], ["c", "Dominante → B du thème"]], "a"],
  ["v6", "V6 · Normalisation", "", [["a", "Bornée comme les thèmes (L 0,72–0,85, C ≤ 0,12)"], ["b", "Plus vive (C ≤ 0,18)"], ["c", "Fidèle à l’affiche (seul le contraste est gardé)"]], "a"],
  ["v7", "V7 · Passage d’un jeu à l’autre", "Sans View Transition : le moteur fera ce fondu.", [["a", "Fondu des couleurs, 600 ms"], ["b", "Fondu lent, 900 ms"], ["c", "Marée : la couleur part de la carte active, 700 ms"]], "c"],
  ["v8", "V8 · Délai avant le changement", "Rien pendant un défilement rapide (bouton plus bas).", [["a", "0 ms"], ["b", "180 ms"], ["c", "350 ms"]], "b"],
  ["v9", "V9 · Affiche sur la carte", "", [["a", "Image plate, nom sur l’ombre de pied"], ["b", "Affiche dans le verre (retrait 3 px, teinte)"], ["c", "Image plate + logo du jeu au lieu du nom (carte active)"]], "c"],
  ["v10a", "V10 · En sortant des jeux", "Onglet « Logiciels » ou « Toutes les catégories ».", [["a", "Fondu vers le thème"], ["b", "La dernière couleur reste"]], "a"],
  ["v10b", "V10 · App sans image", "Onglet « Logiciels » : CrystalDiskInfo.", [["a", "Dégradé et couleurs du thème"], ["b", "Dégradé et couleurs de son icône"]], "b"],
];
const DELAY = { a: 0, b: 180, c: 350 };
const FAST_MS = 120;
const STD = "cubic-bezier(0.4, 0, 0.2, 1)";
const BOKEH = [[150, 120], [1040, 90], [260, 520], [980, 470], [620, 600], [80, 330], [1160, 300]];
const APPS = [
  ...(DATA.noImage ? [DATA.noImage] : []),
  { id: "bloc-notes", name: "Bloc-notes" },
  { id: "calculatrice", name: "Calculatrice" },
];
const CATS = ["Jeux", "Logiciels", "Stream", "Créativité", "Autre"];

const state = {
  theme: 0,
  view: "games",
  active: { games: 0, apps: 0 },
  choice: Object.fromEntries(DECISIONS.map((d) => [d[0], d[4]])),
  lastSource: null,
  shown: null,
};
const $ = (s) => document.querySelector(s);
const stage = $("#stage");
const theme = () => DATA.themes[state.theme];

/** The palettes the colours come from now (null = the theme's own colours). */
function currentSource() {
  const c = state.choice;
  if (state.view === "games") {
    const g = DATA.games[state.active.games];
    return { main: g.poster.palette, other: g.hero?.palette ?? null, game: g };
  }
  if (state.view === "apps") {
    const app = APPS[state.active.apps];
    if (app.icon?.palette && c.v10b === "b") return { main: app.icon.palette, other: null };
  }
  if (state.view === "fan" && c.v4 === "b") return null;
  return c.v10a === "b" ? state.lastSource : null;
}

function colours() {
  const source = currentSource();
  if (source?.game) state.lastSource = source;
  const out = derive(theme(), source, state.choice);
  const g = source?.game;
  const immersive = state.choice.mode === "immersive" && g;
  out.hero = immersive && state.choice.v3 === "b" ? (g.heroBlur && src(g.heroBlur)) : immersive && state.choice.v3 === "c" ? (g.hero && src(g.hero)) : null;
  out.heroKind = out.hero ? (state.choice.v3 === "b" ? "blur" : "net") : "";
  out.source = source;
  return out;
}

function ambHTML(c) {
  const bokeh = BOKEH.map(([x, y], i) => `<div class="bokeh" style="left:${x}px;top:${y}px;--k:${i % 2 ? c.ambB : c.ambA}"></div>`).join("");
  const hero = c.hero ? `background-image:url('${c.hero}')` : "";
  return `<div class="night"></div><div class="hero" data-on="${c.heroKind}" style="${hero}"></div>
    <div class="moon"></div><div class="pool"></div><div class="ring"></div>${bokeh}`;
}

function setAmbVars(el, c) {
  const s = el.style;
  s.setProperty("--a", c.ambA);
  s.setProperty("--b", c.ambB);
  c.bg.forEach((v, i) => s.setProperty(`--n${i}`, v));
}

function newLayer(c) {
  const el = document.createElement("div");
  el.className = "amb";
  el.innerHTML = ambHTML(c);
  setAmbVars(el, c);
  stage.insertBefore(el, $("#ui"));
  return el;
}

function setUiVars(c, instant) {
  if (instant) stage.dataset.instant = "";
  const s = stage.style;
  s.setProperty("--ui-a", c.uiA);
  s.setProperty("--ui-b", c.uiB);
  s.setProperty("--soft", c.soft);
  c.bg.forEach((v, i) => s.setProperty(`--n${i}`, v));
  $("#topbar").toggleAttribute("data-tint", Boolean(c.bar));
  if (c.bar) s.setProperty("--bar", c.bar);
  const w = state.choice.v4 === "c" ? derive(theme(), null, state.choice) : c;
  s.setProperty("--w-a", w.ambA);
  s.setProperty("--w-b", w.ambB);
  s.setProperty("--w-bg", w.bg[1]);
  if (instant) requestAnimationFrame(() => requestAnimationFrame(() => delete stage.dataset.instant));
}

/** Applies the colours; `animate` plays the chosen passage (V7), else the change is instant. */
function applyColours(animate) {
  const c = colours();
  const key = JSON.stringify([c.ambA, c.ambB, c.uiA, c.uiB, c.bg, c.hero, c.bar]);
  if (key === state.shown) return renderStrip(c);
  state.shown = key;
  const old = [...stage.querySelectorAll(".amb")];
  const layer = newLayer(c);
  setUiVars(c, !animate);
  renderStrip(c);
  const done = () => old.forEach((el) => el.remove());
  if (!animate) return done();
  const v7 = state.choice.v7;
  if (v7 === "c") return tide(layer, c, done);
  layer.animate([{ opacity: 0 }, { opacity: 1 }], { duration: v7 === "a" ? 600 : 900, easing: STD }).finished.then(done);
}

/** V7 c: the new colours spread from the active card in a circle with a band of light. */
function tide(layer, c, done) {
  const [x, y] = [640, 436];
  const r = Math.hypot(Math.max(x, 1280 - x), Math.max(y, 720 - y)) + 60;
  layer.animate([{ clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${r}px at ${x}px ${y}px)` }], { duration: 700, easing: STD }).finished.then(done);
  const band = $("#tide");
  band.style.left = `${x}px`;
  band.style.top = `${y}px`;
  band.style.setProperty("--t", c.ambA);
  band.animate(
    [{ transform: "scale(0)", opacity: 0.55 }, { transform: `scale(${(r / 200) * 0.8})`, opacity: 0.55, offset: 0.8 }, { transform: `scale(${r / 200})`, opacity: 0 }],
    { duration: 700, easing: STD },
  );
}

function cardHTML(item, active) {
  const v9 = state.choice.v9;
  if (item.poster) {
    const name = active && v9 === "c" && item.logo ? `<img class="gameLogo" src="${src(item.logo)}" alt="">` : `<span class="plate">${item.name}</span>`;
    const glass = v9 === "b" ? `<span class="glassTint"></span>` : "";
    return `<img class="poster" src="${src(item.poster)}" alt="">${glass}<span class="shade"></span>${name}`;
  }
  const iconColours = item.icon?.palette && state.choice.v10b === "b";
  const p = item.icon?.palette;
  const f1 = iconColours ? p.colors[p.dominant].hex : "color-mix(in oklab, var(--ui-a), var(--ui-b))";
  const mark = item.icon ? `<img class="icon" src="${src(item.icon)}" alt="">` : `<span class="letter">${item.name[0]}</span>`;
  return `<span class="face" style="--f1:${f1}"></span>${mark}<span class="plate">${item.name}</span>`;
}

function renderCards() {
  const list = state.view === "apps" ? APPS : DATA.games;
  const active = state.active[state.view] ?? 0;
  const box = $("#carousel");
  box.innerHTML = "";
  list.forEach((item, i) => {
    const d = i - active;
    if (Math.abs(d) > 2) return;
    const el = document.createElement("div");
    el.className = "card";
    const side = 176;
    const centre = d === 0 ? 0 : Math.sign(d) * (120 + 22 + (Math.abs(d) - 1) * (side + 22) + side / 2);
    el.style.transform = `translate(${centre - 120}px, 0) scale(${d === 0 ? 1 : side / 240})`;
    if (d === 0) el.dataset.active = el.dataset.focus = "";
    if (state.choice.v9 === "b" && item.poster) el.dataset.glass = "";
    el.innerHTML = `${cardHTML(item, d === 0)}<span class="veil"></span><span class="rim"></span>`;
    el.addEventListener("click", () => select(i));
    box.append(el);
  });
}

function renderFan() {
  $("#fan").innerHTML = CATS.map((name, i) => {
    const d = i - 2;
    const mixPct = 25 * i;
    return `<div class="fanCard" style="transform:rotate(${d * 7}deg)"><span class="face" style="--f1:color-mix(in oklab, var(--fan-a) ${100 - mixPct}%, var(--fan-b))"></span><span>${name}</span></div>`;
  }).join("");
}

function renderStrip(c) {
  const sw = (hex, role) => `<span class="sw" style="background:${hex}" ${role ? `data-role="${role}"` : ""} title="${hex}"></span>`;
  const pal = (label, p) => {
    if (!p) return "";
    const role = (i) => [i === p.dominant && "D", i === p.accent && "A", i === p.dark && "S", i === p.light && "C"].filter(Boolean).join("");
    return `<div>${label} ${p.colors.map((x, i) => sw(x.hex, role(i))).join("")}</div>`;
  };
  const s = c.source;
  $("#strip").innerHTML = `${pal("Affiche", s?.main)}${pal("Héros", s?.other)}<div>Résultat A → B ${sw(c.ambA)}${sw(c.ambB)}</div><div>Fond ${c.bg.map((h) => sw(h)).join("")}</div>`;
}

function renderUI() {
  stage.dataset.view = state.view === "fan" ? "fan" : "list";
  const fanColours = state.choice.v4 === "b" ? derive(theme(), null, state.choice) : null;
  stage.style.setProperty("--fan-a", fanColours ? fanColours.uiA : "var(--ui-a)");
  stage.style.setProperty("--fan-b", fanColours ? fanColours.uiB : "var(--ui-b)");
  $("#eyebrow").textContent = state.view === "fan" ? "CHOISIS UN UNIVERS" : "CATÉGORIE";
  $("#title").textContent = state.view === "fan" ? "Univers" : state.view === "apps" ? "Logiciels" : "Jeux";
  $("#tabs").innerHTML = ["games", "apps", "fan"].map((v, i) => `<button data-v="${v}" ${state.view === v ? "data-on" : ""}>${["Jeux", "Logiciels", "Toutes les catégories"][i]}</button>`).join("");
  $("#tabs").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => setView(b.dataset.v)));
  renderCards();
  renderFan();
}

let pressed = 0;
let timer = 0;
/** A new active card: it moves at once; the colours follow after V8's delay, never mid-burst. */
function select(i) {
  const list = state.view === "apps" ? APPS : DATA.games;
  state.active[state.view] = (i + list.length) % list.length;
  renderCards();
  const now = performance.now();
  const fast = now - pressed < FAST_MS;
  pressed = now;
  clearTimeout(timer);
  timer = setTimeout(() => applyColours(true), fast ? 260 : DELAY[state.choice.v8]);
}

function setView(view) {
  state.view = view;
  renderUI();
  clearTimeout(timer);
  timer = setTimeout(() => applyColours(true), DELAY[state.choice.v8]);
}

function renderControls() {
  const themeSel = `<div class="group"><h2>Thème</h2><select id="theme">${DATA.themes.map((t, i) => `<option value="${i}">${t.name}</option>`).join("")}</select></div>`;
  const groups = DECISIONS.map(([id, title, desc, opts, reco]) => `<div class="group"><h2>${title}</h2>${desc ? `<p>${desc}</p>` : ""}<div class="opts">${opts
    .map(([v, label]) => `<button class="opt" data-id="${id}" data-v="${v}" aria-pressed="${state.choice[id] === v}"><b>${id === "mode" ? "" : `${v}.`}</b> ${label}${v === reco ? '<span class="reco">recommandé</span>' : ""}</button>`)
    .join("")}</div></div>`).join("");
  $("#side").innerHTML = themeSel + groups;
  $("#theme").value = String(state.theme);
  $("#theme").addEventListener("change", (e) => {
    state.theme = Number(e.target.value);
    applyColours(false);
  });
  $("#side").querySelectorAll(".opt").forEach((b) =>
    b.addEventListener("click", () => {
      state.choice[b.dataset.id] = b.dataset.v;
      $("#side").querySelectorAll(`[data-id="${b.dataset.id}"]`).forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
      renderUI();
      applyColours(false);
    }),
  );
}

function fit() {
  stage.style.transform = `scale(${$("#frame").clientWidth / 1280})`;
}

function start() {
  renderControls();
  renderUI();
  applyColours(false);
  fit();
  addEventListener("resize", fit);
  addEventListener("keydown", (e) => {
    if (e.target.closest?.("select") || state.view === "fan") return;
    if (e.key === "ArrowRight") select(state.active[state.view] + 1);
    if (e.key === "ArrowLeft") select(state.active[state.view] - 1);
  });
  $("#prev").addEventListener("click", () => select(state.active[state.view] - 1));
  $("#next").addEventListener("click", () => select(state.active[state.view] + 1));
  $("#burst").addEventListener("click", () => [0, 1, 2, 3, 4].forEach((k) => setTimeout(() => select(state.active[state.view] + 1), k * 70)));
  $("#replay").addEventListener("click", () => {
    state.shown = null;
    const keep = state.view;
    const c = derive(theme(), null, state.choice);
    setAmbVars(newLayer(c), c);
    stage.querySelectorAll(".amb").forEach((el, i, all) => i < all.length - 1 && el.remove());
    setUiVars(c, true);
    state.view = keep;
    setTimeout(() => applyColours(true), 400);
  });
}

start();
})();
