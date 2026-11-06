import { playSound } from "../../sound";
import { useEffect, useRef, useState } from "react";
import { Button, Chip, Slider } from "../../design";
import { CUSTOM_MOODS } from "../../fx/mood/custom";
import { PACK_IDS } from "../../fx/mood/packs";
import type { Mood } from "../../fx/mood/types";
import { t } from "../../i18n";
import type { AppEntry, MoodFile } from "../../ipc/bindings";
import { moodsIpc } from "../../ipc/commands";
import { hubStore, useHub } from "../../store";
import { useFileDrop } from "../add-app/useFileDrop";
import { moodById, NO_MOOD, useUserMoods } from "./moodsStore";
import styles from "./AppMoodChoice.module.css";

interface Tune {
  density: number;
  speed: number;
}
/** A slider writes apps.json once it rests this long (not at each step of a drag). */
const SAVE_MS = 250;

/** Saves the app's ambience at once (the dialog's form keeps the rest of the entry). */
function save(id: string, patch: Pick<AppEntry, "moodId"> | { moodTune: Tune | null }): void {
  const latest = hubStore.getState().apps.find((a) => a.id === id);
  if (latest) void hubStore.getState().updateApp({ ...latest, ...patch });
}

function Choice(props: {
  id: string;
  label: string;
  current: string;
  onPick: (id: string) => void;
}) {
  return (
    <Chip selected={props.current === props.id} onClick={() => props.onPick(props.id)}>
      {props.label}
    </Chip>
  );
}

/**
 * Steps 16–17, edit dialog › Apparence: the app's ambience (« Ambiance du jeu »). The choice is
 * applied at once: when this app is the selected one, the home behind the dialog shows it live.
 * Built-in packs, made-to-measure ones, the user's imported `.hubmood` files (dropped on the
 * window); density and speed × 0.25–2; export of the chosen one, deletion of an imported one.
 */
export function AppMoodChoice({ app }: { app: AppEntry }) {
  const entry = useHub((s) => s.apps.find((a) => a.id === app.id)) ?? app;
  const off = useHub((s) => s.settings?.colorMode === "off");
  const mine = useUserMoods();
  const [status, setStatus] = useState<{ text: string; kind: "ok" | "error" } | null>(null);
  const current = moodById(entry.moodId) ? entry.moodId! : NO_MOOD;
  const [tune, setTune] = useState<Tune>({
    density: entry.moodTune?.density ?? 1,
    speed: entry.moodTune?.speed ?? 1,
  });
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const pick = (moodId: string) => save(app.id, { moodId: moodId === NO_MOOD ? null : moodId });
  const dose = (next: Tune) => {
    setTune(next);
    window.clearTimeout(timer.current);
    const same = next.density === 1 && next.speed === 1;
    timer.current = window.setTimeout(
      () => save(app.id, { moodTune: same ? null : next }),
      SAVE_MS,
    );
  };

  useFileDrop((paths) => {
    const files = paths.filter((p) => /\.hubmood$/i.test(p));
    void (async () => {
      for (const path of files) {
        const file = path.split(/[\\/]/).pop() ?? path;
        const r = await moodsIpc.importFile(path);
        if (r.ok) pick(r.value.id);
        setStatus(
          r.ok
            ? { text: t("addApps.look.mood.imported", { name: r.value.name }), kind: "ok" }
            : { text: t("addApps.look.mood.importFailed", { file }), kind: "error" },
        );
      }
    })();
  });

  const chosen = moodById(current);
  const imported = mine.some((m) => m.id === current);
  async function exportIt(mood: Mood) {
    const r = await moodsIpc.exportFile(mood as unknown as MoodFile);
    if (r.ok) playSound("export");
    setStatus(
      r.ok
        ? { text: t("addApps.look.mood.exported"), kind: "ok" }
        : { text: t("addApps.look.mood.exportFailed"), kind: "error" },
    );
  }
  async function remove(id: string) {
    const r = await moodsIpc.remove(id);
    if (r.ok) {
      pick(NO_MOOD);
      setStatus({ text: t("addApps.look.mood.removed"), kind: "ok" });
    }
  }

  return (
    <div className={styles.mood}>
      <div className={styles.head}>
        <span className={styles.title}>{t("addApps.look.mood.title")}</span>
        <p className={styles.help}>{t(off ? "addApps.look.mood.off" : "addApps.look.mood.help")}</p>
      </div>
      <div className={styles.chips} role="group" aria-label={t("addApps.look.mood.choices")}>
        {PACK_IDS.map((id) => (
          <Choice
            key={id}
            id={id}
            label={t(`addApps.look.mood.packs.${id}`)}
            current={current}
            onPick={pick}
          />
        ))}
      </div>
      {CUSTOM_MOODS.length > 0 && (
        <div className={styles.chips} role="group" aria-label={t("addApps.look.mood.custom")}>
          <span className={styles.group}>{t("addApps.look.mood.custom")}</span>
          {CUSTOM_MOODS.map((m) => (
            <Choice key={m.id} id={m.id} label={m.name} current={current} onPick={pick} />
          ))}
        </div>
      )}
      {mine.length > 0 && (
        <div className={styles.chips} role="group" aria-label={t("addApps.look.mood.mine")}>
          <span className={styles.group}>{t("addApps.look.mood.mine")}</span>
          {mine.map((m) => (
            <Choice key={m.id} id={m.id} label={m.name} current={current} onPick={pick} />
          ))}
        </div>
      )}
      {chosen && (
        <div className={styles.dose}>
          <label className={styles.slider}>
            <span>{t("addApps.look.mood.density")}</span>
            <Slider
              min={0.25}
              max={2}
              step={0.05}
              value={tune.density}
              onChange={(density) => dose({ ...tune, density })}
            />
          </label>
          <label className={styles.slider}>
            <span>{t("addApps.look.mood.speed")}</span>
            <Slider
              min={0.25}
              max={2}
              step={0.05}
              value={tune.speed}
              onChange={(speed) => dose({ ...tune, speed })}
            />
          </label>
          <div className={styles.actions}>
            <Button size="sm" variant="soft" onClick={() => void exportIt(chosen)}>
              {t("addApps.look.mood.export")}
            </Button>
            {imported && (
              <Button size="sm" variant="soft" onClick={() => void remove(current)}>
                {t("addApps.look.mood.remove")}
              </Button>
            )}
          </div>
        </div>
      )}
      <p className={styles.help} role="status" data-kind={status?.kind}>
        {status?.text ?? t("addApps.look.mood.drop")}
      </p>
    </div>
  );
}
