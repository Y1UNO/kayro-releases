// Development bench for step 6 (launcher + process watcher). Not part of the product: the real
// screens come in steps 7 and 9. Reached at /dev/launcher in development builds only.
import { useEffect, useState } from "react";
import type { DetectedApp, Launch, NewApp } from "../ipc/bindings";
import { detect, ipc } from "../ipc/commands";
import { errorText } from "../ipc/errors";
import { useHub, hubStore } from "../store";
import styles from "./Launcher.module.css";

type Kind = Launch["kind"];

const KINDS: Kind[] = ["exe", "lnk", "uri", "uwp", "url"];

function buildLaunch(kind: Kind, value: string, elevated: boolean): Launch {
  switch (kind) {
    case "exe":
      return { kind, path: value, args: [], cwd: null, elevated };
    case "lnk":
      return { kind, path: value };
    case "uri":
      return { kind, uri: value };
    case "uwp":
      return { kind, aumid: value };
    case "url":
      return { kind, url: value };
  }
}

async function timed<T>(call: () => Promise<T>): Promise<[T, number]> {
  const t0 = performance.now();
  const result = await call();
  return [result, Math.round(performance.now() - t0)];
}

export default function Launcher() {
  const apps = useHub((s) => s.apps);
  const running = useHub((s) => s.running);
  const status = useHub((s) => s.status);
  const [log, setLog] = useState<string[]>([]);
  const [kind, setKind] = useState<Kind>("exe");
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [matchExe, setMatchExe] = useState("");
  const [elevated, setElevated] = useState(false);
  const [found, setFound] = useState<DetectedApp[]>([]);

  useEffect(() => {
    void hubStore.getState().init();
    void ipc.appReady(); // the window stays hidden until the page says it is ready
  }, []);

  const say = (line: string) =>
    setLog((l) => [`${new Date().toLocaleTimeString()}  ${line}`, ...l].slice(0, 30));

  async function launch(id: string) {
    const [r, ms] = await timed(() => hubStore.getState().launchApp(id));
    say(
      r.ok
        ? `launch ${id}: ${JSON.stringify(r.value)} (${ms} ms)`
        : `launch ${id}: ERROR ${r.error.code} — ${errorText(r.error)}`,
    );
  }

  async function focus(id: string) {
    const r = await hubStore.getState().focusApp(id);
    say(r.ok ? `focus ${id}: ${r.value}` : `focus ${id}: ERROR ${r.error.code}`);
  }

  async function add(app: NewApp) {
    const r = await hubStore.getState().addApp(app);
    say(r.ok ? `added ${r.value.id}` : `add refused: ${r.error.code} (${r.error.field ?? "-"})`);
  }

  async function scan() {
    say("scan…");
    const r = await detect.scan();
    if (!r.ok) return say(`scan failed: ${r.error.code}`);
    const all = r.value.sources.flatMap((s) => s.apps).filter((a) => !a.alreadyAdded);
    setFound(all.slice(0, 60));
    say(`scan: ${all.length} proposed in ${r.value.totalMs} ms`);
  }

  function addDetected(a: DetectedApp) {
    const games = a.source.kind === "steam" || a.source.kind === "epic";
    void add({
      name: a.name,
      category: games ? "jeux" : "autres",
      source: a.source,
      launch: a.launch,
      match: a.match,
      art: { poster: null, hero: null },
      moodId: null,
      favorite: false,
    });
  }

  return (
    <main className={styles.page}>
      <h1>Banc d’essai du lanceur</h1>
      <p className={styles.muted}>Dev seulement · état du magasin : {status}</p>

      <section>
        <h2>Applications ({apps.length})</h2>
        <ul className={styles.list}>
          {apps.map((a) => {
            const st = running[a.id];
            return (
              <li key={a.id} className={styles.row}>
                <span className={styles.name}>{a.name}</span>
                <code>{a.launch.kind}</code>
                <span className={st?.running ? styles.on : styles.off}>
                  {st === undefined ? "non suivi" : st.running ? "ouverte" : "fermée"}
                </span>
                {st?.foreground && <span className={styles.front}>premier plan</span>}
                <button onClick={() => void launch(a.id)}>Lancer</button>
                <button onClick={() => void focus(a.id)}>Focus</button>
                <button onClick={() => void hubStore.getState().removeApp(a.id)}>Retirer</button>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2>Ajouter à la main</h2>
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            void add({
              name,
              category: "autres",
              source: { kind: "manual" },
              launch: buildLaunch(kind, value, elevated),
              match: { exe: matchExe.trim() === "" ? null : matchExe.trim() },
              art: { poster: null, hero: null },
              moodId: null,
              favorite: false,
            });
          }}
        >
          <select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
            {KINDS.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
          <input placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} />
          <input
            placeholder="chemin / uri / aumid / url"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={styles.wide}
          />
          <input
            placeholder="match.exe (optionnel)"
            value={matchExe}
            onChange={(e) => setMatchExe(e.target.value)}
          />
          <label>
            <input
              type="checkbox"
              checked={elevated}
              disabled={kind !== "exe"}
              onChange={(e) => setElevated(e.target.checked)}
            />{" "}
            admin
          </label>
          <button type="submit">Ajouter</button>
        </form>
      </section>

      <section>
        <h2>Depuis le scan</h2>
        <button onClick={() => void scan()}>Scanner</button>
        <ul className={styles.list}>
          {found.map((a) => (
            <li key={a.id} className={styles.row}>
              <span className={styles.name}>{a.name}</span>
              <code>{a.source.kind}</code>
              <button onClick={() => addDetected(a)}>Ajouter</button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Journal</h2>
        <pre className={styles.log}>{log.join("\n")}</pre>
      </section>
    </main>
  );
}
