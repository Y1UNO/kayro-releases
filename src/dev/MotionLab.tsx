// Development page of the motion language (art direction round 4a, "Vivant intelligent"):
// `/dev/motion`, dev builds only (see main.tsx): every kind of interaction of the three levels,
// with the `motion` tokens of the art direction. Texts are not translated on purpose (dev page).
//   ?theme=<id>   ?fx=eco|balanced|high|ultra
//   ?cycle=panel|toggle|tab|notice|fail:ms (repeats that interaction every ms)
import { useEffect, useId, useState } from "react";
import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import {
  Button,
  Chip,
  Dialog,
  IconButton,
  QUALITIES,
  SearchIcon,
  SegmentedControl,
  ThemeProvider,
  Toggle,
  Tooltip,
  applyQuality,
} from "../design";
import { ACTIVE_THEME_ID } from "../design/da";
import { Atmosphere } from "../fx";
import { Carousel } from "../features/home/Carousel";
import { CategoryTabs } from "../features/home/CategoryTabs";
import type { CategoryId } from "../features/home/categories";
import { CommandPalette } from "../features/home/CommandPalette";
import { LaunchToast } from "../features/home/LaunchToast";
import type { HomeView } from "../features/home/homeState";
import { Notice } from "../features/home/Overlays";
import type { AppEntry } from "../ipc/bindings";
import { ipc } from "../ipc/commands";
import { hubStore } from "../store";
import { MotionLab4b } from "./MotionLab4b";
import styles from "./MotionLab.module.css";
import { SOUND_DEFAULTS, UPDATE_DEFAULTS, VISUAL_DEFAULTS, DETECT_DEFAULTS } from "../features/settings/settingsModel";
import { effectiveQuality } from "../design/quality";

const NAMES = ["Riot Client", "Minecraft", "Steam", "Epic Games", "Battle.net", "OBS Studio"];
const APPS: AppEntry[] = NAMES.map((name, i) => ({
  id: `lab-${i}`,
  name,
  category: "jeux",
  source: { kind: "manual" },
  launch: { kind: "exe", path: "C:/fake.exe", args: [], cwd: null, elevated: false },
  match: { exe: null },
  art: { poster: null, hero: null },
  moodId: null,
  favorite: false,
}));
const CATS: CategoryId[] = ["jeux", "stream", "creativite", "logiciels", "autres"];

function seedStore(params: URLSearchParams): true {
  hubStore.setState({
    status: "ready",
    apps: APPS,
    settings: {
      ...VISUAL_DEFAULTS,
      ...SOUND_DEFAULTS,
      ...UPDATE_DEFAULTS,
      ...DETECT_DEFAULTS,
      openingScreen: "last",
      schemaVersion: 2,
      themeId: params.get("theme") ?? ACTIVE_THEME_ID,
      quality: QUALITIES.find((q) => q === params.get("fx")) ?? "high",
      colorMode: "light",
      hotkey: "Ctrl+Alt+H",
      language: "fr",
      atmosphereIntensity: 1,
      displayMode: "immersive",
      islandAlways: true,
      islandTuck: false,
      islandTuckDelay: 1.5,
      islandPeekDelay: 0.1,
      hideOnEscape: true,
      hideOnBlur: false,
      economyMode: false,
    },
  });
  applyQuality(effectiveQuality(hubStore.getState().settings?.quality ?? "high"));
  return true;
}

/** ?cycle=kind:ms — repeats one interaction (clicks, as a person would). */
function useCycle(params: URLSearchParams, act: Record<string, () => void>): void {
  useEffect(() => {
    const [kind, ms] = (params.get("cycle") ?? "").split(":");
    const every = Number(ms);
    const fn = kind ? act[kind] : undefined;
    if (!fn || !(every > 0)) return;
    const id = window.setInterval(fn, every);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export default function MotionLab() {
  const params = new URLSearchParams(location.search);
  const [ready] = useState(() => seedStore(params));
  const [category, setCategory] = useState<CategoryId>("jeux");
  const [view, setView] = useState<HomeView>("carousel");
  const [mode, setMode] = useState("immersive");
  const [toggles, setToggles] = useState([true, false, true]);
  const [chip, setChip] = useState(0);
  const [panel, setPanel] = useState(false);
  const [search, setSearch] = useState(false);
  const [notice, setNotice] = useState(0);
  const [list, setList] = useState(0);
  const [focus, setFocus] = useState(2);
  const panelId = useId();

  useCycle(params, {
    panel: () => setPanel((p) => !p),
    toggle: () => setToggles((t) => [!t[0], t[1]!, t[2]!]),
    tab: () => setCategory((c) => CATS[(CATS.indexOf(c) + 1) % CATS.length]!),
    notice: () => setNotice((n) => n + 1),
    fail: () =>
      hubStore.setState({
        lastError: { code: "launchNotFound", message: "", field: null },
        failedApp: APPS[focus]?.id ?? null,
      }),
  });

  useEffect(() => {
    if ("__TAURI_INTERNALS__" in window) void ipc.appReady();
  }, []);

  // A notification stays 2.5 s.
  useEffect(() => {
    if (notice === 0) return;
    const id = window.setTimeout(() => setNotice(0), 2500);
    return () => window.clearTimeout(id);
  }, [notice]);

  if (!ready) return null;
  return (
    <ThemeProvider initialThemeId={params.get("theme") ?? ACTIVE_THEME_ID}>
      <LazyMotion features={domAnimation}>
        <MotionConfig reducedMotion="user">
          <Atmosphere />
          <main className={styles.page}>
            <section className={styles.block}>
              <h2 className={styles.h}>Niveau 1 · net — survol, appui, champs</h2>
              <div className={styles.row}>
                <Button variant="primary">Lancer</Button>
                <Button>Annuler</Button>
                <Button size="sm">Petit</Button>
                <Tooltip content="Rechercher" placement="bottom">
                  <IconButton label="Rechercher">
                    <SearchIcon />
                  </IconButton>
                </Tooltip>
                {["Tout", "Favoris", "Récents"].map((c, i) => (
                  <Chip key={c} selected={chip === i} onClick={() => setChip(i)}>
                    {c}
                  </Chip>
                ))}
                <input className={styles.field} placeholder="Un champ" aria-label="Un champ" />
              </div>
            </section>

            <section className={styles.block}>
              <h2 className={styles.h}>Niveau 2 · vivant — pastille, interrupteurs, panneaux</h2>
              <div className={styles.row}>
                <CategoryTabs
                  category={category}
                  view={view}
                  panelId={panelId}
                  onCategory={setCategory}
                  onView={setView}
                />
              </div>
              <div className={styles.row}>
                <SegmentedControl
                  label="Mode"
                  glassPill
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "immersive", label: "Immersif" },
                    { value: "window", label: "Fenêtre" },
                  ]}
                />
                {toggles.map((on, i) => (
                  <Toggle
                    key={i}
                    checked={on}
                    aria-label={`Interrupteur ${i + 1}`}
                    onChange={(v) => setToggles((t) => t.map((x, k) => (k === i ? v : x)))}
                  />
                ))}
                <Button onClick={() => setPanel(true)}>Ouvrir un panneau</Button>
                <Button onClick={() => setSearch(true)}>Recherche</Button>
                <Button onClick={() => setNotice((n) => n + 1)}>Notification</Button>
                <Button onClick={() => setList((n) => n + 1)}>Rejouer la liste</Button>
              </div>
              <ul key={list} className={styles.list} data-cascade="">
                {NAMES.map((n) => (
                  <li key={n} className={styles.item}>
                    {n}
                  </li>
                ))}
              </ul>
            </section>

            <section className={styles.block} id={panelId}>
              <h2 className={styles.h}>Niveau 3 · magie — cartes du carrousel</h2>
              <p className={styles.hint}>
                Tab puis flèches : anneau de focus (immédiat, sans filets). Clic sur la carte
                centrale = lancement.
              </p>
              <Carousel
                apps={APPS}
                focus={focus}
                running={{}}
                onFocus={setFocus}
                onMove={(d) => setFocus((f) => Math.max(0, Math.min(APPS.length - 1, f + d)))}
                onLaunch={() => setNotice((n) => n + 1)}
              />
            </section>

            <MotionLab4b apps={APPS} failingApp={APPS[focus]?.id ?? ""} />
          </main>

          <Dialog open={panel} onClose={() => setPanel(false)} title="Réglages (démo)">
            <div className={styles.rows} data-cascade="">
              {["Mode économie", "Masquer avec Échap", "Masquer sans focus", "Démarrage"].map(
                (label, i) => (
                  <div key={label} className={styles.rowItem}>
                    <span>{label}</span>
                    <Toggle
                      checked={toggles[i % 3]!}
                      aria-label={label}
                      onChange={(v) => setToggles((t) => t.map((x, k) => (k === i % 3 ? v : x)))}
                    />
                  </div>
                ),
              )}
            </div>
          </Dialog>
          <CommandPalette
            open={search}
            apps={APPS}
            onClose={() => setSearch(false)}
            onPickApp={() => setNotice((n) => n + 1)}
            onPickCategory={setCategory}
          />
          {notice > 0 && <Notice key={notice} text="Steam : notification de démonstration" />}
          <LaunchToast onFix={() => setPanel(true)} />
        </MotionConfig>
      </LazyMotion>
    </ThemeProvider>
  );
}
