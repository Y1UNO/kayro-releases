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

  ipc.appIcon = async () => ok(null);
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
  ipc.appsRemove = async () => ok(null);
}
