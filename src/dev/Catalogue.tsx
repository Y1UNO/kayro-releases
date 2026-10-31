import { APP_NAME } from "../app/appName";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import {
  Button,
  Chip,
  Dialog,
  HandIcon,
  IconButton,
  MicIcon,
  Pill,
  QUALITY_LABELS,
  SearchIcon,
  SegmentedControl,
  Slider,
  Surface,
  ThemeProvider,
  Toggle,
  Tooltip,
  applyQuality,
  useTheme,
} from "../design";
import { Atmosphere } from "../fx";
import type { Quality } from "../design";
import { worstContrast } from "../design/contrast";
import {
  MAX_BACKDROP_SURFACES,
  backdropInUse,
  subscribeBackdrop,
} from "../design/glass/backdropBudget";
import styles from "./Catalogue.module.css";

// Dev-only page (route /dev/catalogue, see main.tsx). Texts are not translated on purpose.

type CatalogueQuality = Exclude<Quality, "ultra">; // Ultra only differs from Élevé from step 13 on
const QUALITY_OPTIONS = (["eco", "balanced", "high"] as const).map((value) => ({
  value,
  label: QUALITY_LABELS[value],
}));

const MODES = [
  { value: "off", label: "Désactivé" },
  { value: "light", label: "Léger" },
  { value: "immersive", label: "Immersif" },
] as const;
type Mode = (typeof MODES)[number]["value"];

const VIEWS = [
  { value: "immersive", label: "Immersif" },
  { value: "window", label: "Fenêtre" },
] as const;

const CATEGORIES = ["Jeux", "Stream", "Créativité", "Logiciels", "Autre"];
const APPS = [
  ["Riot Client", "R"],
  ["Minecraft", "M"],
  ["Steam", "S"],
  ["Epic Games", "E"],
  ["Battle.net", "B"],
] as const;

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>{title}</h2>
      {children}
    </section>
  );
}

function Toolbar({
  quality,
  onQuality,
}: {
  quality: CatalogueQuality;
  onQuality: (q: CatalogueQuality) => void;
}) {
  const { theme, themes, setThemeId } = useTheme();
  const used = useSyncExternalStore(subscribeBackdrop, backdropInUse);
  const worst = worstContrast(theme);
  return (
    <Surface as="header" radius="var(--radius-card)" className={styles.toolbar}>
      <div className={styles.toolbarRow}>
        <h1 className={styles.title}>Catalogue</h1>
        <div className={styles.chips} role="group" aria-label="Thème">
          {themes.map((t) => (
            <Chip key={t.id} selected={t.id === theme.id} onClick={() => setThemeId(t.id)}>
              {t.name}
            </Chip>
          ))}
        </div>
      </div>
      <div className={styles.toolbarRow}>
        <SegmentedControl
          label="Qualité"
          options={QUALITY_OPTIONS}
          value={quality}
          onChange={onQuality}
        />
        <Pill>
          Verre flouté : {used}/{MAX_BACKDROP_SURFACES}
        </Pill>
        <Pill>
          Pire contraste : {worst.ratio.toFixed(2)}:1 ({worst.name})
        </Pill>
      </div>
    </Surface>
  );
}

function Buttons() {
  return (
    <Panel title="Boutons, pastilles, puces">
      <div className={styles.row}>
        <Button variant="primary">Soirée gaming</Button>
        <Button>Stream</Button>
        <Button variant="primary" size="sm">
          Enregistrer
        </Button>
        <Button size="sm">Importer un thème</Button>
        <Button disabled>Désactivé</Button>
      </div>
      <div className={styles.row}>
        <Tooltip content="Commande vocale">
          <IconButton label="Commande vocale">
            <MicIcon size={20} />
          </IconButton>
        </Tooltip>
        <Tooltip content="Contrôle par les mains" placement="bottom">
          <IconButton label="Contrôle par les mains" size="sm">
            <HandIcon />
          </IconButton>
        </Tooltip>
        <Tooltip content="Rechercher">
          <IconButton label="Rechercher" size="sm">
            <SearchIcon />
          </IconButton>
        </Tooltip>
        <Pill>Léger</Pill>
        <Pill tone="accent">Nouveau</Pill>
        <Pill tone="key">Ctrl K</Pill>
      </div>
      <div className={styles.row}>
        {CATEGORIES.map((c, i) => (
          <ChipDemo key={c} label={c} initial={i === 0} />
        ))}
      </div>
    </Panel>
  );
}

function ChipDemo({ label, initial }: { label: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  return (
    <Chip selected={on} onClick={() => setOn(!on)} className={styles.chipOnPanel}>
      {label}
    </Chip>
  );
}

function Controls() {
  const [mode, setMode] = useState<Mode>("light");
  const [sun, setSun] = useState(false);
  const [notifs, setNotifs] = useState(true);
  const [intensity, setIntensity] = useState(0.8);
  return (
    <Panel title="Interrupteurs, curseur, segments">
      <div className={styles.controls}>
        <div className={styles.stack}>
          <div className={styles.setting}>
            <div>
              <div className={styles.settingLabel}>Couleurs du jeu</div>
              <div className={styles.settingHint}>La lumière prend les couleurs de l’affiche.</div>
            </div>
            <SegmentedControl
              size="sm"
              label="Couleurs du jeu"
              options={MODES}
              value={mode}
              onChange={setMode}
            />
          </div>
          <div className={styles.setting}>
            <div>
              <div className={styles.settingLabel} id="sun-label">
                Suivre le soleil
              </div>
              <div className={styles.settingHint}>La lumière suit l’heure de ta ville.</div>
            </div>
            <Toggle aria-labelledby="sun-label" checked={sun} onChange={setSun} />
          </div>
          <div className={styles.setting}>
            <div className={styles.settingLabel} id="notif-label">
              Notifications (activé)
            </div>
            <Toggle aria-labelledby="notif-label" checked={notifs} onChange={setNotifs} />
          </div>
        </div>
        <div className={styles.stack}>
          <div className={styles.setting}>
            <label className={styles.settingLabel} htmlFor="intensity">
              Intensité de l’atmosphère
            </label>
            <span>{Math.round(intensity * 100)} %</span>
          </div>
          <Slider
            id="intensity"
            value={intensity}
            min={0.3}
            max={1}
            step={0.05}
            onChange={setIntensity}
          />
        </div>
      </div>
    </Panel>
  );
}

function GlassDemo() {
  const [focus, setFocus] = useState(2);
  const [cat, setCat] = useState(0);
  const [view, setView] = useState<(typeof VIEWS)[number]["value"]>("immersive");
  return (
    <Panel title="Verre liquide : aperçu d’accueil (pas un composant)">
      <div className={styles.home}>
        <Surface as="nav" radius="29px" className={styles.topbar}>
          <span className={styles.logo}>{APP_NAME}</span>
          <div className={styles.search}>
            <SearchIcon size={16} />
            <span className={styles.searchText}>Rechercher une app ou une scène</span>
            <Pill tone="key">Ctrl K</Pill>
          </div>
          <SegmentedControl
            label="Mode d’affichage"
            options={VIEWS}
            value={view}
            onChange={setView}
          />
        </Surface>

        <div className={styles.cards}>
          {APPS.map(([name, letter], i) => (
            <button
              key={name}
              type="button"
              aria-label={name}
              aria-pressed={i === focus}
              className={`${styles.card} ${i === focus ? styles.cardFocus : ""}`}
              onClick={() => setFocus(i)}
            >
              <span className={styles.letter}>{letter}</span>
              <Surface radius="var(--radius-md)" flat={i !== focus} className={styles.plate}>
                {name}
              </Surface>
            </button>
          ))}
        </div>

        <Surface radius="28px" className={styles.tabs}>
          {CATEGORIES.map((c, i) => (
            <Chip key={c} selected={i === cat} onClick={() => setCat(i)}>
              {c}
            </Chip>
          ))}
        </Surface>

        <Surface radius="var(--radius-panel)" className={styles.dock}>
          <Button variant="primary">Soirée gaming</Button>
          <Button>Stream</Button>
          <Button>Créa</Button>
          <span className={styles.sep} />
          <IconButton label="Commande vocale">
            <MicIcon size={20} />
          </IconButton>
        </Surface>
      </div>
    </Panel>
  );
}

function DialogDemo() {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  return (
    <Panel title="Dialogue (focus piégé, Échap)">
      <div className={styles.row}>
        <Button onClick={() => setOpen(true)}>Ouvrir le dialogue</Button>
        <span className={styles.settingHint}>
          Tab reste dans le dialogue ; Échap ou clic hors panneau le ferme.
        </span>
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title="Fermer cette app ?">
        <p style={{ margin: "0 0 16px" }}>
          La fermeture est douce : l’app reçoit un message de fermeture de fenêtre.
        </p>
        <div className={styles.setting}>
          <span id="dlg-label">Ne plus demander</span>
          <Toggle aria-labelledby="dlg-label" checked={checked} onChange={setChecked} />
        </div>
        <div className={styles.dialogActions}>
          <Button size="sm" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button variant="primary" size="sm" onClick={() => setOpen(false)}>
            Fermer l’app
          </Button>
        </div>
      </Dialog>
    </Panel>
  );
}

function Page() {
  const [quality, setQuality] = useState<CatalogueQuality>("high");
  useEffect(() => {
    applyQuality(quality);
  }, [quality]);
  return (
    <>
      <Atmosphere quality={quality} />
      <main className={styles.page}>
        <Toolbar quality={quality} onQuality={setQuality} />
        <Buttons />
        <Controls />
        <GlassDemo />
        <DialogDemo />
      </main>
    </>
  );
}

export default function Catalogue() {
  return (
    <ThemeProvider>
      <Page />
    </ThemeProvider>
  );
}
