import { useEffect, useState } from "react";
import { Button, Dialog, MicIcon } from "../../design";
import { t, type MessageKey } from "../../i18n";
import type { VoiceSettings } from "../../ipc/bindings";
import { voiceIpc } from "../../ipc/commands";
import { onVoiceRecorded } from "../../ipc/events";
import { useHub, useScenes } from "../../store";
import { calibScript, firstMissing } from "../voice/calib";
import { micOpen, useVoice } from "../voice/voiceStore";
import own from "./Calib.module.css";

interface Props {
  voice: VoiceSettings;
  /** The cards already said: the screen goes on from the first one missing. */
  said: string[];
  /** `evaluate`: every card was said, the score is wanted now. */
  onClose: (evaluate: boolean) => void;
}

/**
 * « Calibrer ma voix » (step 21), guided like a phone's: one card at a time (the sentence to
 * say, big), the microphone lit while it hears, the next card as soon as the saying is kept. The
 * voice listens whatever its mode and runs nothing meanwhile; « Terminer plus tard » keeps what
 * was said. Music chapter: only once the user says the music plays (or it is skipped).
 */
export function CalibGuide({ voice, said, onClose }: Props) {
  const apps = useHub((s) => s.apps);
  const scenes = useScenes((s) => s.scenes);
  const [steps] = useState(() => calibScript(voice, apps, scenes));
  const [at, setAt] = useState(() => firstMissing(steps, said));
  const [tries, setTries] = useState(0);
  const [failed, setFailed] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const state = useVoice((s) => s.state);
  const step = steps[at];
  const gated = step?.kind === "music" && !musicOn;

  useEffect(() => {
    void voiceIpc.calibrate(true);
    const off = onVoiceRecorded((r) => {
      setFailed(!r.ok);
      if (r.ok) setAt((i) => (steps[i]?.key === r.key ? i + 1 : i));
      else setTries((n) => n + 1);
    });
    return () => {
      void voiceIpc.calibrate(false);
      void off.then((u) => u());
    };
  }, [steps]);

  // The card shown is the one kept next (none while the music is not on yet).
  useEffect(() => {
    const prompt = step && !gated ? { ...step } : null;
    if (prompt) delete prompt.hint;
    void voiceIpc.calibRecord(prompt);
  }, [step, gated, tries]);

  const skipChapter = () => {
    const next = steps.findIndex((s, i) => i > at && s.kind !== step?.kind);
    setAt(next < 0 ? steps.length : next);
  };

  if (!step) {
    return (
      <Dialog open onClose={() => onClose(false)} title={t("settings.voice.calib.title")}>
        <p className={own.help}>{t("settings.voice.calib.guide.done")}</p>
        <div className={own.actions}>
          <Button variant="primary" onClick={() => onClose(true)}>
            {t("settings.voice.calib.guide.evaluate")}
          </Button>
        </div>
      </Dialog>
    );
  }

  const listening = micOpen(state.status);
  const status = listening
    ? t("settings.voice.calib.guide.listening")
    : t(`settings.voice.status.${state.status}` as MessageKey, {
        model: state.missing ? t(`settings.voice.models.${state.missing}.name` as MessageKey) : "",
      });

  return (
    <Dialog
      open
      onClose={() => onClose(false)}
      title={t("settings.voice.calib.title")}
      closeLabel={t("settings.voice.calib.guide.later")}
    >
      <div className={own.head}>
        <p className={own.chapter}>
          {t(`settings.voice.calib.chapter.${step.kind}` as MessageKey)}
        </p>
        <span className={own.count}>
          {t("settings.voice.calib.guide.progress", { n: at + 1, total: steps.length })}
        </span>
      </div>
      <div
        className={own.track}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={at}
      >
        <div className={own.fill} style={{ transform: `scaleX(${at / steps.length})` }} />
      </div>
      <p className={own.help}>{t(`settings.voice.calib.chapter.${step.kind}Help` as MessageKey)}</p>
      {gated ? (
        <>
          <p className={own.help}>{t("settings.voice.calib.guide.musicGate")}</p>
          <div className={own.actions}>
            <Button onClick={skipChapter}>{t("settings.voice.calib.guide.musicSkip")}</Button>
            <Button variant="primary" onClick={() => setMusicOn(true)}>
              {t("settings.voice.calib.guide.musicStart")}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className={own.card}>
            <p className={own.say} aria-live="polite">
              {step.text}
            </p>
            {step.hint && <p className={own.hint}>{step.hint}</p>}
          </div>
          <div className={own.mic} data-hearing={state.status === "hearing" || undefined}>
            <MicIcon size={24} />
            <p className={own.note} role="status">
              {failed ? t("settings.voice.calib.guide.failed") : status}
            </p>
          </div>
          <div className={own.actions}>
            <Button size="sm" disabled={at === 0} onClick={() => setAt((i) => Math.max(0, i - 1))}>
              {t("settings.voice.calib.guide.back")}
            </Button>
            <Button size="sm" onClick={() => setAt((i) => i + 1)}>
              {t("settings.voice.calib.guide.skip")}
            </Button>
          </div>
        </>
      )}
    </Dialog>
  );
}
