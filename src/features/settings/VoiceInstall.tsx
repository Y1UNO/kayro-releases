import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "../../design";
import { t } from "../../i18n";
import type { AppError, VoiceSettings } from "../../ipc/bindings";
import { voiceIpc } from "../../ipc/commands";
import { errorText } from "../../ipc/errors";
import { neededModels, refreshModels, useVoice } from "../voice/voiceStore";
import own from "./Voice.module.css";
import cards from "./VoiceModels.module.css";
import css from "./Assistant.module.css";

/** A size for people: « 670 Mo », « 5,9 Go ». */
export function size(mb: number): string {
  if (mb < 1000) return `${Math.round(mb)} Mo`;
  return `${(mb / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Go`;
}

/** Every model of the voice (« Désinstaller » removes them all). */
const VOICE_MODELS = ["silero", "wake", "parakeet", "canary", "speaker", "brain"];

/** The models still missing for this way of listening (the brain only when it is on). */
export function useMissing(voice: VoiceSettings | undefined): string[] {
  const models = useVoice((s) => s.models);
  if (!voice || models.length === 0) return [];
  return wantedModels(voice, voice.brain).filter(
    (id) => !models.find((m) => m.id === id)?.installed,
  );
}

/** What the assistant needs for this way of listening (and the brain, if wanted). */
export function wantedModels(voice: VoiceSettings, brain: boolean): string[] {
  const listen = voice.mode === "off" ? ["silero", "wake", voice.model] : neededModels(voice);
  const always = voice.mode !== "pushToTalk" ? ["speaker"] : [];
  return [...new Set([...listen, ...always, ...(brain ? ["brain"] : [])])];
}

/**
 * « Installer Arya »: every model the assistant needs, one after the other, behind one bar (step 21,
 * 2026-11-05: the six cards one by one were too much). The cards stay in « Avancé ».
 */
export function VoiceInstall({
  voice,
  name,
  onBrain,
  onOff,
  actions,
}: {
  voice: VoiceSettings;
  name: string;
  onBrain: (on: boolean) => void;
  /** Turns the voice off (before its models are removed). */
  onOff?: () => void;
  /** Buttons that go on the same line (« Changer de nom »). */
  actions?: ReactNode;
}) {
  const models = useVoice((s) => s.models);
  const progress = useVoice((s) => s.progress);
  const [brain, setBrain] = useState(true);
  const [plan, setPlan] = useState<string[] | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [asking, setAsking] = useState(false);
  const [removing, setRemoving] = useState(false);
  const stop = useRef(false);
  useEffect(() => {
    void refreshModels();
  }, []);
  const info = (id: string) => models.find((m) => m.id === id);
  const missing = wantedModels(voice, brain).filter((id) => !info(id)?.installed);
  const brainThere = info("brain")?.installed ?? false;
  const mb = (ids: string[]) => ids.reduce((sum, id) => sum + (info(id)?.sizeMb ?? 0), 0);

  async function install() {
    const ids = missing;
    setError(null);
    stop.current = false;
    setPlan(ids);
    for (const id of ids) {
      if (stop.current) break;
      const r = await voiceIpc.download(id);
      await refreshModels();
      if (!r.ok) {
        if (!stop.current) setError(r.error);
        break;
      }
    }
    if (ids.includes("brain") && !stop.current) onBrain(true);
    setPlan(null);
  }

  function cancel() {
    stop.current = true;
    const current = plan?.find((id) => !info(id)?.installed);
    if (current) void voiceIpc.cancel(current);
  }

  if (plan) {
    const total = mb(plan);
    const done = plan.reduce((sum, id) => {
      const m = info(id);
      if (m?.installed) return sum + (m.sizeMb ?? 0);
      return sum + (progress[id]?.doneMb ?? 0);
    }, 0);
    const fraction = total > 0 ? Math.min(1, done / total) : 0;
    return (
      <div className={cards.progress} role="status">
        <div className={cards.track}>
          <span className={cards.fill} style={{ transform: `scaleX(${fraction})` }} />
        </div>
        <div className={cards.progressLine}>
          <span>{t("assistant.install.progress", { done: size(done), total: size(total) })}</span>
          <Button size="sm" onClick={cancel}>
            {t("assistant.install.cancel")}
          </Button>
        </div>
      </div>
    );
  }

  const installed = models.filter((m) => m.installed && VOICE_MODELS.includes(m.id));

  async function uninstall() {
    setRemoving(true);
    setError(null);
    onOff?.();
    for (const m of installed) {
      const r = await voiceIpc.remove(m.id);
      if (!r.ok) setError(r.error);
    }
    await refreshModels();
    setRemoving(false);
    setAsking(false);
  }

  if (missing.length === 0) {
    const used = size(mb(installed.map((m) => m.id)));
    return (
      <div className={css.install}>
        <p className={own.status}>{t("assistant.install.size", { name, size: used })}</p>
        {asking ? (
          <>
            <p className={own.confirm}>{t("assistant.install.removeAsk", { name, size: used })}</p>
            <div className={own.line}>
              <Button
                size="sm"
                variant="primary"
                disabled={removing}
                onClick={() => void uninstall()}
              >
                {t(removing ? "assistant.install.removing" : "assistant.install.removeYes")}
              </Button>
              <Button size="sm" disabled={removing} onClick={() => setAsking(false)}>
                {t("assistant.install.keep")}
              </Button>
            </div>
          </>
        ) : (
          <div className={own.line}>
            {onOff && (
              <Button size="sm" onClick={() => setAsking(true)}>
                {t("assistant.install.remove", { name })}
              </Button>
            )}
            {actions}
          </div>
        )}
        {error && (
          <p className={own.confirm} role="alert">
            {errorText(error)}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={css.install}>
      <p className={own.intro}>
        {t("assistant.install.missing", { size: size(mb(missing)), name })}
      </p>
      {!brainThere && (
        <label className={css.check}>
          <input type="checkbox" checked={brain} onChange={(e) => setBrain(e.target.checked)} />
          <span>{t("assistant.install.brain", { size: size(info("brain")?.sizeMb ?? 0) })}</span>
        </label>
      )}
      <div className={own.line}>
        <Button variant="primary" onClick={() => void install()}>
          {t("assistant.install.button", { name, size: size(mb(missing)) })}
        </Button>
      </div>
      <p className={own.intro}>{t("assistant.install.network")}</p>
      {actions && <div className={own.line}>{actions}</div>}
      {error && (
        <p className={own.confirm} role="alert">
          {errorText(error)}
        </p>
      )}
    </div>
  );
}
