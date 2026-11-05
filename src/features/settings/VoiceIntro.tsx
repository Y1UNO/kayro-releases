import { useState } from "react";
import type { ReactNode } from "react";
import { Button } from "../../design";
import { t } from "../../i18n";
import type { VoiceSettings } from "../../ipc/bindings";
import { NAME_IDEAS, assistantName, sameName } from "../voice/name";
import { Block } from "./VoiceBlock";
import { VoiceInstall } from "./VoiceInstall";
import own from "./Voice.module.css";
import css from "./Assistant.module.css";
import { wakeWordOk } from "./VoiceBlocks";

type Set = (patch: Partial<VoiceSettings>) => void;

/**
 * The assistant's introduction (step 21, 2026-11-05, the user's wish): its name first, then how
 * to talk to it, then one button that installs it all. Shown the first time (the voice off and
 * nothing downloaded), and again from « Changer de nom ».
 */
export function VoiceIntro({
  voice,
  set,
  hotkey,
  onDone,
}: {
  voice: VoiceSettings;
  set: Set;
  /** The push-to-talk shortcut's field, when that way is chosen. */
  hotkey: ReactNode;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(assistantName(voice.wakeWord));
  const [renamed, setRenamed] = useState(false);
  const name = draft.trim() || assistantName(voice.wakeWord);
  const ok = wakeWordOk(draft);

  function saveName() {
    if (!ok) return;
    if (!sameName(draft, voice.wakeWord)) {
      // Another name: what was learned of the old one no longer applies.
      setRenamed(voice.wakeHeard.length > 0);
      set({ wakeWord: draft.trim(), wakeHeard: [] });
    }
    setStep(1);
  }

  const steps = [
    <>
      <p className={own.intro}>{t("assistant.intro.nameHelp")}</p>
      <input
        className={`${own.input} ${css.name}`}
        aria-label={t("assistant.intro.nameTitle")}
        value={draft}
        maxLength={40}
        spellCheck={false}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && saveName()}
      />
      {!ok && <p className={own.confirm}>{t("settings.voice.wake.invalid")}</p>}
      <div className={css.ideas} aria-label={t("assistant.intro.ideas")}>
        {NAME_IDEAS.map((idea) => (
          <button
            key={idea}
            type="button"
            className={css.idea}
            aria-pressed={sameName(draft, idea)}
            onClick={() => setDraft(idea)}
          >
            {idea}
          </button>
        ))}
      </div>
      {ok && <p className={own.status}>{t("assistant.intro.example", { name })}</p>}
    </>,
    <>
      {renamed && <p className={own.confirm}>{t("assistant.intro.renamed")}</p>}
      <div
        className={css.choices}
        role="radiogroup"
        aria-label={t("assistant.intro.modeTitle", { name })}
      >
        {(["always", "pushToTalk"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={voice.mode === mode}
            className={css.choice}
            onClick={() => set({ mode })}
          >
            <strong>
              {t(mode === "always" ? "assistant.intro.always" : "assistant.intro.push")}
            </strong>
            <span>
              {t(mode === "always" ? "assistant.intro.alwaysHelp" : "assistant.intro.pushHelp")}
            </span>
          </button>
        ))}
      </div>
      {voice.mode === "pushToTalk" && hotkey}
    </>,
    <VoiceInstall voice={voice} name={name} onBrain={(brain) => set({ brain })} />,
    <p className={own.intro}>{t("assistant.intro.doneHelp", { name })}</p>,
  ];
  const titles = [
    t("assistant.intro.nameTitle"),
    t("assistant.intro.modeTitle", { name }),
    t("assistant.intro.installTitle", { name }),
    t("assistant.intro.doneTitle", { name }),
  ];
  const last = step === steps.length - 1;
  const canGo = step === 0 ? ok : step === 1 ? voice.mode !== "off" : true;

  return (
    <Block
      eyebrow={last ? t("assistant.hero.eyebrow") : t("assistant.intro.step", { n: step + 1 })}
      title={titles[step] ?? ""}
    >
      {steps[step]}
      <div className={own.line}>
        {step > 0 && !last && (
          <Button size="sm" onClick={() => setStep(step - 1)}>
            {t("assistant.intro.back")}
          </Button>
        )}
        <Button
          size="sm"
          // On the install step, « Installer » is the one main button.
          variant={step === 2 ? "soft" : "primary"}
          disabled={!canGo}
          onClick={() => (step === 0 ? saveName() : last ? onDone() : setStep(step + 1))}
        >
          {t(last ? "assistant.intro.finish" : "assistant.intro.next")}
        </Button>
      </div>
    </Block>
  );
}
