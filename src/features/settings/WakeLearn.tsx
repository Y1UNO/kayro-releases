import { useEffect, useState } from "react";
import { Button, CheckIcon, Dialog, MicIcon } from "../../design";
import { t, type MessageKey } from "../../i18n";
import { voiceIpc } from "../../ipc/commands";
import { onVoiceLearned } from "../../ipc/events";
import { nameOf } from "../voice/calib";
import { micOpen, useVoice } from "../voice/voiceStore";
import own from "./WakeLearn.module.css";


/** What to say at each step: the word, its name alone, in real commands, the word again. */
const STEPS = ["alone", "name", "launch", "open", "again"] as const;

interface Props {
  wakeWord: string;
  /** The spellings heard, once every step is done. */
  onDone: (heard: string[]) => void;
  onClose: () => void;
}

/**
 * « Apprendre mon mot d'éveil » (step 21), guided like a phone's: four sayings, the microphone
 * lit while it hears, a tick at each step. What the small model heard of each is kept: the wake
 * word then matches the user's own voice. Nothing runs meanwhile (no command).
 */
export function WakeLearn({ wakeWord, onDone, onClose }: Props) {
  const [heard, setHeard] = useState<string[]>([]);
  const status = useVoice((s) => s.state.status);
  const step = Math.min(heard.length, STEPS.length);
  const done = step === STEPS.length;

  useEffect(() => {
    void voiceIpc.learn(true);
    const off = onVoiceLearned((h) =>
      setHeard((all) => (all.length < STEPS.length ? [...all, h] : all)),
    );
    return () => {
      void voiceIpc.learn(false);
      void off.then((u) => u());
    };
  }, []);

  useEffect(() => {
    if (done) void voiceIpc.learn(false);
  }, [done]);

  const say = (s: (typeof STEPS)[number]) =>
    t(`settings.voice.learn.say.${s}` as MessageKey, { word: wakeWord, name: nameOf(wakeWord) });

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("settings.voice.learn.title")}
      closeLabel={t("settings.voice.learn.cancel")}
    >
      <ol className={own.steps}>
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={own.step}
            data-state={i < step ? "done" : i === step ? "now" : "later"}
          >
            <span className={own.stepMark} aria-hidden="true">
              {i < step ? <CheckIcon size={14} /> : i + 1}
            </span>
            <span className={own.stepText}>{say(s)}</span>
          </li>
        ))}
      </ol>
      {done ? (
        <>
          <p className={own.learnNote}>{t("settings.voice.learn.done")}</p>
          <Button variant="primary" onClick={() => onDone(heard)}>
            {t("settings.voice.learn.save")}
          </Button>
        </>
      ) : (
        <div className={own.learnMic} data-hearing={status === "hearing" || undefined}>
          <MicIcon size={28} />
          <p className={own.learnNote} role="status">
            {micOpen(status)
              ? t("settings.voice.learn.listening")
              : t("settings.voice.learn.notListening")}
          </p>
        </div>
      )}
    </Dialog>
  );
}
