import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../design";
import { t, type MessageKey } from "../../i18n";
import type { CalibScore, CalibSummary, Ratio, VoiceSettings } from "../../ipc/bindings";
import { voiceIpc } from "../../ipc/commands";
import { useHub, useScenes } from "../../store";
import { calibScript } from "../voice/calib";
import { useVoice } from "../voice/voiceStore";
import { CalibGuide } from "./CalibGuide";
import { ToggleRow } from "./SettingRow";
import { Block } from "./VoiceBlock";
import own from "./Calib.module.css";
import voiceCss from "./Voice.module.css";

const MODELS = ["silero", "wake", "parakeet", "canary"];

function Tile({ label, ratio }: { label: string; ratio: Ratio }) {
  if (ratio.total === 0) return null;
  return (
    <div className={own.tile} data-good={ratio.right === ratio.total || undefined}>
      <span className={own.tileValue}>
        {t("settings.voice.calib.score.ratio", { right: ratio.right, total: ratio.total })}
      </span>
      <span className={own.tileLabel}>{label}</span>
    </div>
  );
}

/**
 * What a missed saying came to: the brain's lines (« appel oui / kayro montrer ») read as what
 * it understood, else what the command model wrote down.
 */
export function missHeard(heard: string): string {
  const h = heard.trim();
  if (h.startsWith("appel non")) return t("settings.voice.calib.score.notCalled");
  if (h.startsWith("appel oui")) {
    const rest = h.replace(/^appel oui\s*(\/\s*)?/u, "").trim();
    return rest
      ? t("settings.voice.calib.score.understood", { heard: rest })
      : t("settings.voice.calib.score.calledOnly");
  }
  return h
    ? t("settings.voice.calib.score.heard", { heard: h })
    : t("settings.voice.calib.score.nothing");
}

function Score({ score }: { score: CalibScore }) {
  const misses = score.results.filter((r) => !r.right);
  return (
    <>
      <p className={own.note}>{t("settings.voice.calib.score.title")}</p>
      <div className={own.tiles}>
        <Tile label={t("settings.voice.calib.score.wake")} ratio={score.wake} />
        <Tile label={t("settings.voice.calib.score.commands")} ratio={score.commands} />
        <Tile label={t("settings.voice.calib.score.music")} ratio={score.music} />
        <Tile label={t("settings.voice.calib.score.calm")} ratio={score.calm} />
        <Tile label={t("settings.voice.calib.score.voice")} ratio={score.voice} />
        {score.medianMs > 0 && (
          <div className={own.tile}>
            <span className={own.tileValue}>
              {t("settings.voice.calib.score.ms", { ms: score.medianMs })}
            </span>
            <span className={own.tileLabel}>{t("settings.voice.calib.score.time")}</span>
          </div>
        )}
      </div>
      {score.learned.length > 0 && (
        <p className={own.note}>
          {t("settings.voice.calib.score.learned", { count: score.learned.length })}
        </p>
      )}
      {misses.length > 0 && (
        <details className={own.misses}>
          <summary>{t("settings.voice.calib.score.misses", { count: misses.length })}</summary>
          <ul className={own.missList}>
            {misses.map((r) => (
              <li key={r.key} className={own.miss}>
                <span>{r.text}</span>
                <span className={own.missHeard}>
                  {r.kind === "trap" || r.kind === "chat"
                    ? t("settings.voice.calib.score.woke")
                    : missHeard(r.heard)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

/**
 * « Calibrer ma voix » (step 21): the user's voice recorded on demand (the guided screen), kept on
 * the PC, replayed through the whole always mode for a score; removed in one click.
 */
export function VoiceCalib({
  voice,
  set,
}: {
  voice: VoiceSettings;
  set: (patch: Partial<VoiceSettings>) => void;
}) {
  const models = useVoice((s) => s.models);
  const apps = useHub((s) => s.apps);
  const scenes = useScenes((s) => s.scenes);
  const has = (id: string) => models.some((m) => m.id === id && m.installed);
  const ready = ["silero", "wake", voice.model].every(has);
  const [summary, setSummary] = useState<CalibSummary | null>(null);
  const [guide, setGuide] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  const refresh = useCallback(() => {
    void voiceIpc.calibSummary().then((r) => r.ok && setSummary(r.value));
  }, []);
  useEffect(refresh, [refresh]);

  const left = useMemo(() => {
    const said = new Set(summary?.keys ?? []);
    return calibScript(voice, apps, scenes).filter((s) => !said.has(s.key)).length;
  }, [summary, voice, apps, scenes]);

  async function evaluate() {
    setBusy(true);
    setProblem(null);
    const r = await voiceIpc.calibEvaluate();
    setBusy(false);
    // What the small model hears of the wake word in the user's voice: kept in Réglages.
    if (r.ok && r.value.learned.join("|") !== voice.wakeHeard.join("|")) {
      set({ wakeHeard: r.value.learned });
    }
    if (!r.ok) {
      const m = r.error.message;
      setProblem(MODELS.includes(m) ? t(`settings.voice.models.${m}.name` as MessageKey) : m);
    }
    refresh();
  }

  async function clear() {
    setAsking(false);
    await voiceIpc.calibClear();
    refresh();
  }

  const count = summary?.count ?? 0;
  const startLabel =
    count === 0
      ? t("settings.voice.calib.start")
      : left > 0
        ? t("settings.voice.calib.resume", { left })
        : t("settings.voice.calib.again");

  return (
    <Block eyebrow={t("assistant.hear.eyebrow")} title={t("settings.voice.calib.title")}>
      <p className={voiceCss.intro}>{t("settings.voice.calib.help")}</p>
      {!ready && <p className={own.alert}>{t("settings.voice.calib.needModels")}</p>}
      <p className={own.note}>
        {count > 0
          ? t("settings.voice.calib.count", { count, seconds: summary?.seconds ?? 0 })
          : t("settings.voice.calib.none")}
      </p>
      <div className={own.row}>
        <Button
          size="sm"
          variant="primary"
          disabled={!ready || busy}
          onClick={() => setGuide(true)}
        >
          {startLabel}
        </Button>
        <Button size="sm" disabled={!ready || busy || count === 0} onClick={() => void evaluate()}>
          {t("settings.voice.calib.evaluate")}
        </Button>
        {count > 0 && (
          <Button size="sm" disabled={busy} onClick={() => setAsking(true)}>
            {t("settings.voice.calib.clear")}
          </Button>
        )}
      </div>
      {asking && (
        <div className={own.row}>
          <p className={own.alert}>{t("settings.voice.calib.clearAsk", { count })}</p>
          <Button size="sm" onClick={() => setAsking(false)}>
            {t("settings.voice.calib.keep")}
          </Button>
          <Button size="sm" variant="primary" onClick={() => void clear()}>
            {t("settings.voice.calib.clearYes")}
          </Button>
        </div>
      )}
      {busy && (
        <p className={own.note} role="status">
          {t("settings.voice.calib.evaluating", { seconds: Math.max(5, Math.round(count * 0.6)) })}
        </p>
      )}
      {problem && (
        <p className={own.alert} role="alert">
          {t("settings.voice.calib.failed", { reason: problem })}
        </p>
      )}
      {!busy && summary?.score && <Score score={summary.score} />}
      <ToggleRow
        label={t("settings.voice.calib.onlyMe")}
        help={
          has("speaker") && summary?.voiceprint
            ? t("settings.voice.calib.onlyMeHelp")
            : t("settings.voice.calib.onlyMeNeed")
        }
        checked={voice.onlyMe}
        disabled={!voice.onlyMe && !(has("speaker") && summary?.voiceprint)}
        onChange={(onlyMe) => set({ onlyMe })}
      />
      {guide && (
        <CalibGuide
          voice={voice}
          said={summary?.keys ?? []}
          onClose={(now) => {
            setGuide(false);
            refresh();
            if (now) void evaluate();
          }}
        />
      )}
    </Block>
  );
}
