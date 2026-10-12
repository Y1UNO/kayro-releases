// Art direction workshop (step 12b): `/dev/atelier`, development builds only (see main.tsx).
// Left: controls generated from the catalogue. Right: the real screens in iframes, updated live.
// Presets are JSON files in src/design/presets/ (written by the dev server, vite/atelier.ts).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BUILTIN_THEMES, QUALITIES, QUALITY_LABELS, type Quality } from "../../design";
import {
  ACTIVE_THEME_ID,
  ELEMENTS,
  daStore,
  defaultValues,
  elementDefaults,
  parsePreset,
  type DaPreset,
  type DaValue,
  type DaValues,
} from "../../design/da";
import type { BenchResult } from "../bench";
import { Controls } from "./Controls";
import { Measures, type Cost } from "./Measures";
import { CHANNEL, type FromPreview, type Side, type ToPreview } from "./sync";
import styles from "./Atelier.module.css";

const SCREENS: Record<string, { label: string; url: (q: string) => string }> = {
  accueil: { label: "Accueil", url: (q) => `/dev/home?apps=12&${q}` },
  grille: { label: "Accueil (grille)", url: (q) => `/dev/home?view=grid&${q}` },
  ajout: { label: "Ajout d'apps", url: (q) => `/dev/home?addmock=1&${q}` },
  scenes: { label: "Scènes", url: (q) => `/dev/scenes?screen=scenes&${q}` },
  editeur: { label: "Éditeur de scène", url: (q) => `/dev/scenes?screen=editor&${q}` },
  composants: { label: "Composants", url: (q) => `/dev/catalogue?${q}` },
  ouverture: { label: "Ouverture (rejouable)", url: (q) => `/dev/home?opening=1&${q}` },
  categories: { label: "Catégories (rejouable)", url: (q) => `/dev/home?fan=1&${q}` },
  survol: { label: "Catégories (survol)", url: (q) => `/dev/home?fan=1&hover=2&${q}` },
  mouvement: { label: "Mouvement (jetons, niveaux)", url: (q) => `/dev/motion?${q}` },
  widget: { label: "Widget (dépliage)", url: (q) => `/dev/widget?open=1&${q}` },
};

interface Listed {
  file: string;
  preset: DaPreset;
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await r.json()) as T & { error?: string };
  if (!r.ok) throw new Error(json.error ?? r.statusText);
  return json;
}

function parseList(raw: { file: string; preset: unknown }[]): Listed[] {
  return raw.flatMap(({ file, preset }) => {
    const p = parsePreset(preset);
    return p.ok ? [{ file, preset: p.preset }] : [];
  });
}

export default function Atelier() {
  const [values, setValues] = useState<Record<Side, DaValues>>(() => ({
    A: daStore.getState().values,
    B: daStore.getState().values,
  }));
  const [names, setNames] = useState<Record<Side, string>>({ A: "Actif", B: "Actif" });
  const [side, setSide] = useState<Side>("A");
  const [ab, setAb] = useState(false);
  const [themeId, setThemeId] = useState(ACTIVE_THEME_ID || "lavande-peche");
  const [screen, setScreen] = useState("accueil");
  const [quality, setQuality] = useState<Quality>("high");
  const [presets, setPresets] = useState<Listed[]>([]);
  const [history, setHistory] = useState<Listed[]>([]);
  const [saveName, setSaveName] = useState("");
  const [status, setStatus] = useState("");
  const [bench, setBench] = useState<Partial<Record<Side, BenchResult>>>({});
  const [cost, setCost] = useState<Cost | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const channel = useRef<BroadcastChannel | null>(null);
  const latest = useRef(values);
  useEffect(() => {
    latest.current = values;
  }, [values]);

  const post = useCallback((m: ToPreview) => channel.current?.postMessage(m), []);

  useEffect(() => {
    const ch = new BroadcastChannel(CHANNEL);
    channel.current = ch;
    ch.onmessage = (e: MessageEvent<FromPreview>) => {
      const m = e.data;
      if (m.type === "hello") post({ to: m.from, type: "values", values: latest.current[m.from] });
      else if (m.type === "bench") setBench((b) => ({ ...b, [m.from]: m.result }));
    };
    return () => ch.close();
  }, [post]);

  useEffect(() => post({ to: "A", type: "values", values: values.A }), [post, values.A]);
  useEffect(() => post({ to: "B", type: "values", values: values.B }), [post, values.B]);

  const refresh = useCallback(() => {
    api<{ presets: Listed[]; history: Listed[] }>("/__atelier/presets").then(
      (r) => {
        setPresets(parseList(r.presets));
        setHistory(parseList(r.history).reverse());
      },
      (e: unknown) => setStatus(`Liste des préréglages indisponible : ${String(e)}`),
    );
  }, []);
  useEffect(refresh, [refresh]);

  const edit = (id: string, key: string, v: DaValue) =>
    setValues((all) => {
      const cur = all[side][id];
      if (!cur) return all;
      return { ...all, [side]: { ...all[side], [id]: { ...cur, [key]: v } } };
    });
  const resetEl = (id: string) =>
    setValues((all) => {
      const el = ELEMENTS.get(id);
      return el ? { ...all, [side]: { ...all[side], [id]: elementDefaults(el) } } : all;
    });

  const load = (p: DaPreset, to: Side) => {
    setValues((all) => ({ ...all, [to]: p.values }));
    setNames((n) => ({ ...n, [to]: p.name }));
    setThemeId(p.themeId);
    setStatus(`« ${p.name} » chargé dans ${to}.`);
  };

  const asPreset = (name: string): DaPreset => ({
    schemaVersion: 1,
    name,
    savedAt: new Date().toISOString(),
    themeId,
    values: values[side],
  });

  const save = async () => {
    const name = saveName.trim() || names[side];
    try {
      const r = await api<{ file: string }>("/__atelier/presets", asPreset(name));
      setNames((n) => ({ ...n, [side]: name }));
      setStatus(`Enregistré : ${r.file} (+ copie datée dans l'historique).`);
      refresh();
    } catch (e) {
      setStatus(`Échec de l'enregistrement : ${String(e)}`);
    }
  };

  const exportActive = async () => {
    try {
      const r = await api<{ file: string }>("/__atelier/export", asPreset(names[side]));
      setStatus(`Exporté dans ${r.file} : c'est maintenant la DA de l'app.`);
    } catch (e) {
      setStatus(`Échec de l'export : ${String(e)}`);
    }
  };

  const measure = async () => {
    setMeasuring(true);
    setBench({});
    setCost(null);
    post({ to: "A", type: "bench", ms: 10_000, keyHz: 0 });
    if (ab) post({ to: "B", type: "bench", ms: 10_000, keyHz: 0 });
    try {
      setCost(await api<Cost>("/__atelier/cost?seconds=10"));
    } catch (e) {
      setCost({ error: String(e) });
    }
    setMeasuring(false);
  };

  const query = (s: Side) => `atelier=${s}&theme=${themeId}&fx=${quality}`;
  const sides: Side[] = ab ? ["A", "B"] : ["A"];
  const theme = useMemo(() => BUILTIN_THEMES.find((t) => t.id === themeId), [themeId]);

  return (
    <div className={styles.page}>
      <aside className={styles.panel}>
        <header className={styles.head}>
          <h1 className={styles.title}>Atelier de DA</h1>
          <div className={styles.line}>
            <label>
              Thème{" "}
              <select value={themeId} onChange={(e) => setThemeId(e.target.value)}>
                {BUILTIN_THEMES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Écran{" "}
              <select value={screen} onChange={(e) => setScreen(e.target.value)}>
                {Object.entries(SCREENS).map(([k, s]) => (
                  <option key={k} value={k}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            {screen === "ouverture" && (
              <button
                type="button"
                className={styles.small}
                onClick={() => sides.forEach((to) => post({ to, type: "replay" }))}
              >
                Rejouer
              </button>
            )}
            <label>
              Qualité{" "}
              <select value={quality} onChange={(e) => setQuality(e.target.value as Quality)}>
                {QUALITIES.map((q) => (
                  <option key={q} value={q}>
                    {QUALITY_LABELS[q]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className={styles.line}>
            <label>
              <input type="checkbox" checked={ab} onChange={(e) => setAb(e.target.checked)} />{" "}
              Comparer A / B
            </label>
            {ab &&
              (["A", "B"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={styles.small}
                  data-on={side === s ? "" : undefined}
                  onClick={() => setSide(s)}
                >
                  Régler {s} ({names[s]})
                </button>
              ))}
          </div>
          <div className={styles.line}>
            <input
              className={styles.name}
              placeholder={`Nom du préréglage (${names[side]})`}
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
            />
            <button type="button" className={styles.small} onClick={() => void save()}>
              Enregistrer
            </button>
            <button type="button" className={styles.small} onClick={() => void exportActive()}>
              Exporter
            </button>
          </div>
          <div className={styles.line}>
            <select
              value=""
              onChange={(e) => {
                const [list, i, to] = e.target.value.split(":");
                const p = (list === "h" ? history : presets)[Number(i)];
                if (p) load(p.preset, to as Side);
              }}
            >
              <option value="">Charger un préréglage…</option>
              {presets.map((p, i) =>
                sides.map((s) => (
                  <option key={`${p.file}${s}`} value={`p:${i}:${s}`}>
                    {p.preset.name} → {s}
                  </option>
                )),
              )}
              {history.slice(0, 30).map((p, i) => (
                <option key={p.file} value={`h:${i}:${side}`}>
                  Historique {p.file.slice(0, 15)} · {p.preset.name} → {side}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.small}
              onClick={() => setValues((all) => ({ ...all, [side]: defaultValues() }))}
            >
              Tout réinitialiser
            </button>
          </div>
          <Measures
            quality={quality}
            bench={bench}
            cost={cost}
            measuring={measuring}
            onMeasure={() => void measure()}
          />
          {status && <p className={styles.status}>{status}</p>}
          {theme && (
            <p className={styles.hint}>
              Réglage de {side} · thème {theme.name}
            </p>
          )}
        </header>
        <Controls values={values[side]} onChange={edit} onReset={resetEl} />
      </aside>
      <main className={styles.previews} data-ab={ab ? "" : undefined}>
        {sides.map((s) => {
          const url = SCREENS[screen]?.url(query(s)) ?? "/dev/home";
          return (
            <section key={s} className={styles.preview}>
              {ab && <span className={styles.badge}>{`${s} · ${names[s]}`}</span>}
              <iframe key={url} title={`Aperçu ${s}`} src={url} className={styles.frame} />
            </section>
          );
        })}
      </main>
    </div>
  );
}
