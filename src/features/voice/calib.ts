import { t, type MessageKey } from "../../i18n";
import type { CalibKind, CalibPrompt, VoiceSettings } from "../../ipc/bindings";

/** An app, a scene or a piece of music, as the script names it. */
export interface Named {
  id: string;
  name: string;
}

/** One card of « Calibrer ma voix »: what to say, how (`hint`), and what it must do. */
export interface CalibStep extends CalibPrompt {
  hint?: string;
}

/** The wake word's most telling word (« Yuna » in « Dis Yuna »): it wakes alone too. */
export const nameOf = (w: string) =>
  w.split(/[\s'’-]+/).reduce((a, b) => (b.length > a.length ? b : a), "");

/** The chapters, in the order they come. */
export const CHAPTERS: CalibKind[] = ["wake", "name", "command", "quick", "trap", "chat", "music"];

const say = (id: string, vars: Record<string, string> = {}) =>
  t(`settings.voice.calib.say.${id}` as MessageKey, vars);
const hint = (id: string) => t(`settings.voice.calib.hint.${id}` as MessageKey);

/** Up to `n` of a list, each name once, the long ones left out (they are read aloud). */
function some(list: Named[], n: number): Named[] {
  const seen = new Set<string>();
  return list
    .filter((x) => {
      const k = x.name.trim().toLowerCase();
      if (!k || k.length > 28 || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, n);
}

function linkSay(uri: string): string {
  const kind = uri.split(":")[1];
  if (kind === "playlist") return "linkPlaylist";
  if (kind === "album") return "linkAlbum";
  if (kind === "track") return "linkTrack";
  return "linkOther";
}

/**
 * The guided recording, from the user's own wake word, apps, scenes and music: ≈ 40 sayings
 * (≈ 6 min). Each has what it must do in the core's words (voice/calib.rs `key`): « app:<id> »,
 * « music:pause », « wake » (the wake word heard), « none » (Kayro stays asleep).
 */
export function calibScript(voice: VoiceSettings, apps: Named[], scenes: Named[]): CalibStep[] {
  const word = voice.wakeWord.trim();
  const name = nameOf(word);
  const steps: CalibStep[] = [];
  const add = (key: string, kind: CalibKind, text: string, expect: string, h?: string) =>
    steps.push(h ? { key, kind, text, expect, hint: h } : { key, kind, text, expect });

  for (let i = 1; i <= 5; i++) {
    const h = i === 4 ? hint("faster") : i === 5 ? hint("softer") : undefined;
    add(`wake-${i}`, "wake", say("wake", { word }), "wake", h);
  }
  for (let i = 1; i <= 3; i++) {
    add(`name-${i}`, "name", say("name", { name }), "wake", i === 3 ? hint("far") : undefined);
  }

  const mine = some(apps, 5);
  mine.forEach((a, i) =>
    add(
      `open-${i + 1}`,
      "command",
      say(i % 2 ? "launch" : "open", { word, target: a.name }),
      `app:${a.id}`,
    ),
  );
  some(scenes, 2).forEach((s, i) =>
    add(`scene-${i + 1}`, "command", say("scene", { word, scene: s.name }), `scene:${s.id}`),
  );
  mine
    .slice(0, 2)
    .forEach((a, i) =>
      add(`close-${i + 1}`, "command", say("close", { word, target: a.name }), `close:${a.id}`),
    );
  for (const m of ["play", "pause", "next", "louder", "quieter"]) {
    add(`music-${m}`, "command", say(m, { word }), `music:${m}`);
  }
  some(
    voice.links.map((l) => ({ id: l.uri, name: l.name })),
    2,
  ).forEach((l, i) =>
    add(`link-${i + 1}`, "command", say(linkSay(l.id), { word, link: l.name }), `link:${l.id}`),
  );
  add("show", "command", say("show", { word }), "show");
  add("hide", "command", say("hide", { word }), "hide");
  if (mine[0]) add("search", "command", say("search", { word, target: mine[0].name }), "search");
  add("music-mode", "command", say("musicMode", { word }), "musicmode:on");

  const quick = steps.filter((s) => /^(open-[12]|close-1|music-next)$/.test(s.key)).slice(0, 3);
  quick.forEach((s, i) => add(`quick-${i + 1}`, "quick", s.text, s.expect));

  const app = mine[0]?.name ?? "Discord";
  for (let i = 1; i <= 6; i++)
    add(`trap-${i}`, "trap", say(`trap${i}`, { name, target: app }), "none");
  add("chat-1", "chat", say("chat1"), "none");
  add("chat-2", "chat", say("chat2"), "none");

  const bg = [
    mine[0] && (["open", mine[0]] as const),
    ["pause", null] as const,
    mine[1] && (["launch", mine[1]] as const),
    ["louder", null] as const,
  ].filter((x) => !!x);
  bg.forEach(([id, a], i) =>
    add(
      `bg-${i + 1}`,
      "music",
      say(id, { word, target: a?.name ?? "" }),
      a ? `app:${a.id}` : `music:${id}`,
    ),
  );
  return steps;
}

/** Where the guided screen starts: the first card not said yet (0 when all are, to start over). */
export function firstMissing(steps: CalibStep[], said: string[]): number {
  const done = new Set(said);
  const i = steps.findIndex((s) => !done.has(s.key));
  return i < 0 ? 0 : i;
}
