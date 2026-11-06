// Fake core for the "add apps" dialog, so it can be checked in a plain browser (`/dev/home?addmock=1`).
// Replaces the IPC calls on the shared `ipc` / `detect` objects; the store and the UI are the real ones.
import type { AddReport, AppEntry, Candidate, DetectedApp, NewApp, Refused } from "../ipc/bindings";
import { detect, ipc, type Outcome } from "../ipc/commands";

const ok = <T>(value: T): Outcome<T> => ({ ok: true, value });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function detected(
  id: string,
  name: string,
  kind: "steam" | "epic" | "startmenu",
  category: string,
  added = false,
): DetectedApp {
  return {
    id,
    name,
    source:
      kind === "steam"
        ? { kind: "steam", appId: id }
        : kind === "epic"
          ? { kind: "epic", appName: id }
          : { kind: "startmenu" },
    launch:
      kind === "startmenu"
        ? { kind: "lnk", path: `C:/Menu/${name}.lnk` }
        : { kind: "uri", uri: `steam://rungameid/${id}` },
    match: { exe: null },
    posterPath: null,
    heroPath: null,
    alreadyAdded: added,
    suggestedCategory: category,
    launcher: ["Steam", "Epic Games Launcher", "Riot Client"].includes(name),
    ignored: false,
    installDir: null,
    logoPath: null,
  };
}

const START = [
  ["Minecraft", "jeux"],
  ["Steam", "jeux"],
  ["Epic Games Launcher", "jeux"],
  ["OBS Studio", "stream"],
  ["Streamlabs Desktop", "stream"],
  ["Blender", "creativite"],
  ["Krita", "creativite"],
  ["Discord", "logiciels"],
  ["Firefox", "logiciels"],
  ["Notepad++", "autres"],
] as const;

export function installAddAppsMock(allApps: () => AppEntry[]): void {
  // The store shows an added app at once (optimistic, temporary id); the real core never sees it.
  const getApps = () => allApps().filter((a) => !a.id.startsWith("pending-"));
  detect.scan = async () => {
    await wait(400);
    return ok({
      totalMs: 400,
      cancelled: false,
      sources: [
        {
          source: "steam",
          skipped: 0,
          error: null,
          ms: 20,
          apps: Array.from({ length: 12 }, (_, i) =>
            detected(`${1000 + i}`, `Jeu Steam ${i + 1}`, "steam", "jeux", i === 0),
          ),
        },
        { source: "epic", skipped: 0, error: null, ms: 1, apps: [] },
        {
          source: "startmenu",
          skipped: 3,
          error: null,
          ms: 280,
          apps: START.map(([n, c], i) => detected(`menu-${i}`, n, "startmenu", c)),
        },
      ],
    });
  };
  detect.cancel = async () => ok(undefined);
  // Step 19c: the advanced scan finds two more apps, one with a logo.
  detect.deep = async () => {
    await wait(2500);
    const base = await detect.scan();
    if (!base.ok) return base;
    const extra = (id: string, name: string, category: string): DetectedApp => ({
      ...detected(id, name, "startmenu", category),
      source: { kind: "manual" },
      launch: { kind: "exe", path: `D:/Games/${name}/${name}.exe`, args: [], cwd: null, elevated: false },
    });
    return ok({
      ...base.value,
      sources: [
        ...base.value.sources,
        {
          source: "deep",
          skipped: 0,
          error: null,
          ms: 2400,
          apps: [extra("deep-1", "Hollow Knight", "jeux"), extra("deep-2", "CPU-Z", "logiciels")],
        },
      ],
    });
  };
  // Step 19b: a round coloured logo for most apps, none for a few (the monogram stays).
  detect.icon = async (app) => {
    await wait(150);
    if (app.name.length % 4 === 0) return ok(null);
    const hue = [...app.name].reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="hsl(${hue} 70% 55%)"/><path d="M10 16l4 4 8-8" stroke="white" stroke-width="3" fill="none"/></svg>`;
    return ok(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
  };

  // Step 19c: a logo for most apps (the cards show it in the middle).
  ipc.appIcon = async (id) => {
    if (id.length % 3 === 0) return ok(null);
    const hue = [...id].reduce((h, c) => h + c.charCodeAt(0) * 7, 0) % 360;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="6" y="6" width="52" height="52" rx="14" fill="hsl(${hue} 75% 55%)"/><circle cx="32" cy="32" r="12" fill="white"/></svg>`;
    return ok(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
  };
  ipc.appsInspect = async (inputs) => {
    await wait(120);
    const refused: Refused[] = [];
    const candidates = inputs.flatMap((input): Candidate[] => {
      if (/^https?:\/\//.test(input)) {
        const name = input.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] ?? input;
        return [
          {
            input,
            name,
            launch: { kind: "url" as const, url: input },
            match: { exe: null },
            suggestedCategory: "autres",
            alreadyAdded: false,
          },
        ];
      }
      if (/\.exe$/i.test(input)) {
        const file = input.split(/[\\/]/).pop() ?? input;
        return [
          {
            input,
            name: file.replace(/\.exe$/i, ""),
            launch: { kind: "exe" as const, path: input, args: [], cwd: null, elevated: false },
            match: { exe: file },
            suggestedCategory: "logiciels",
            alreadyAdded: getApps().some((a) => a.launch.kind === "exe" && a.launch.path === input),
          },
        ];
      }
      refused.push({ input, reason: "notSupported" });
      return [];
    });
    return ok({ candidates, refused });
  };

  const keyOf = (a: NewApp | AppEntry) => JSON.stringify(a.launch).toLowerCase();
  const toEntry = (a: NewApp, i: number): AppEntry => ({
    ...a,
    id: `${a.name.toLowerCase().replace(/\W+/g, "-")}-${Date.now() % 10000}-${i}`,
  });
  ipc.appsAddMany = async (apps): Promise<Outcome<AddReport>> => {
    await wait(150);
    const seen = new Set(getApps().map(keyOf));
    const report: AddReport = { added: [], failed: [] };
    apps.forEach((a, index) => {
      if (seen.has(keyOf(a))) {
        report.failed.push({
          index,
          error: { code: "duplicate", message: "dup", field: null },
        });
      } else {
        seen.add(keyOf(a));
        report.added.push(toEntry(a, index));
      }
    });
    return ok(report);
  };
  ipc.appsAdd = async (a) => {
    await wait(100);
    if (getApps().some((x) => keyOf(x) === keyOf(a))) {
      return { ok: false, error: { code: "duplicate", message: "dup", field: null } };
    }
    return ok(toEntry(a, 0));
  };
  ipc.appsUpdate = async (e) => ok(e);
  ipc.appsReorder = async (ids) => {
    const byId = new Map(getApps().map((a) => [a.id, a]));
    return ok({ schemaVersion: 1, apps: ids.flatMap((id) => byId.get(id) ?? []) });
  };
  ipc.appsRemove = async () => ok(null);
}
