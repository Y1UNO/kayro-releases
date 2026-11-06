import { useState } from "react";
import { t, type MessageKey } from "../../i18n";
import { hubStore, useDesktop, useHub } from "../../store";
import { HotkeyField } from "../scenes/HotkeyField";
import { assistantName } from "../voice/name";
import { useVoice } from "../voice/voiceStore";
import { MicPicker, OutputPicker } from "./MicPicker";
import { ToggleRow } from "./SettingRow";
import { Block } from "./VoiceBlock";
import { AuraBlock, MemoryBlock, WakeBlock, type Set } from "./VoiceBlocks";
import { VoiceCalib } from "./VoiceCalib";
import { VoiceHelp } from "./VoiceHelp";
import { VoiceHero } from "./VoiceHero";
import { useMissing } from "./VoiceInstall";
import { VoiceIntro } from "./VoiceIntro";
import { VoiceMusic } from "./VoiceMusic";
import { VoiceModels } from "./VoiceModels";
import own from "./Voice.module.css";
import css from "./Assistant.module.css";

export { wakeWordOk } from "./VoiceBlocks";

/** What comes later: shown, not usable. */
const LATER = ["name", "deep", "light", "assistant"] as const;

/**
 * Réglages › Assistant vocal (step 21; made simpler on 2026-11-05, then 2026-11-06 at the user's
 * request): the first time, an introduction (its name, how to talk to it, one install); then a card
 * with its name and state, how to call it (until it listens), the phrases, and everything else
 * folded under « Détails ».
 */
export function VoiceSection() {
  const settings = useHub((s) => s.settings);
  const hotkeys = useDesktop((s) => s.hotkeys);
  const models = useVoice((s) => s.models);
  const [chosen, setIntro] = useState<boolean | null>(null);
  const [firstTime, setFirstTime] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const voice = settings?.voice;
  // The first time (the voice off and nothing downloaded), the introduction opens by itself:
  // decided once, when the models are known (not again while they download).
  if (firstTime === null && voice && models.length > 0) {
    setFirstTime(voice.mode === "off" && !models.some((m) => m.installed));
  }
  const intro = chosen ?? firstTime ?? false;
  const missing = useMissing(voice);

  if (!settings || !voice) return null;
  const set: Set = (patch) =>
    void hubStore.getState().setSettings({ voice: { ...voice, ...patch } });
  const name = assistantName(voice.wakeWord);
  const ready = voice.mode !== "off" && models.length > 0 && missing.length === 0;
  const taken = [
    settings.hotkey,
    settings.searchHotkey,
    ...(hotkeys?.scenes ?? []).map((s) => s.hotkey),
  ];
  const hotkey = (
    <HotkeyField
      value={voice.hotkey || null}
      taken={taken}
      unregistered={hotkeys?.voice?.problem != null}
      onChange={(k) => set({ hotkey: k ?? "" })}
    />
  );

  if (intro) {
    return (
      <div className={own.capri} data-cascade="">
        <VoiceIntro voice={voice} set={set} hotkey={hotkey} onDone={() => setIntro(false)} />
        <p className={own.privacy}>{t("settings.voice.privacy")}</p>
      </div>
    );
  }

  // What calls it: needed to get it working, so always shown (not folded).
  const call =
    voice.mode === "always" ? (
      <WakeBlock key={voice.wakeWord} voice={voice} set={set} />
    ) : voice.mode === "pushToTalk" ? (
      <Block eyebrow={t("assistant.call.eyebrow")} title={t("settings.voice.hotkey.label")}>
        <p className={own.intro}>{t("settings.voice.hotkey.help")}</p>
        {hotkey}
      </Block>
    ) : null;
  // Everything else, under « Détails » (2026-11-06: « plus simplifié visuellement »).
  const details = (
    <>
      {voice.mode !== "off" && (
        <Block eyebrow={t("assistant.hear.eyebrow")} title={t("assistant.hear.title")}>
          <p className={own.intro}>{t("assistant.hear.help", { name })}</p>
          <div className={own.line}>
            <p className={own.lineLabel}>{t("settings.voice.mic.label")}</p>
            <MicPicker value={voice.microphone} onChange={(microphone) => set({ microphone })} />
          </div>
          {voice.mode === "always" && (
            <ToggleRow
              label={t("settings.voice.echo.label")}
              help={t("settings.voice.echo.help")}
              checked={voice.echoCancel}
              onChange={(echoCancel) => set({ echoCancel })}
            />
          )}
          {voice.mode === "always" && voice.echoCancel && (
            <div className={own.line}>
              <p className={own.lineLabel}>{t("settings.voice.output.label")}</p>
              <OutputPicker value={voice.speakers} onChange={(speakers) => set({ speakers })} />
            </div>
          )}
        </Block>
      )}
      {voice.mode === "always" && <VoiceCalib voice={voice} set={set} />}
      {voice.mode !== "off" && <VoiceMusic voice={voice} set={set} />}
      {voice.mode !== "off" && <AuraBlock voice={voice} set={set} />}
      <VoiceModels
        voice={voice}
        onPick={(model) => set({ model })}
        onBrain={(brain) => set({ brain })}
      />
      {voice.mode !== "off" && <MemoryBlock />}
      <Block eyebrow={t("settings.voice.eyebrow.later")} title={t("settings.voice.later.label")}>
        <ul className={own.later}>
          {LATER.map((id) => (
            <li key={id} className={own.laterRow}>
              <span>
                <strong>{t(`settings.voice.later.${id}` as MessageKey)}</strong>
                {" — "}
                {t(`settings.voice.later.${id}Help` as MessageKey)}
              </span>
            </li>
          ))}
        </ul>
      </Block>
    </>
  );

  // The card, how to call it, the phrases (once it listens); the rest folded under « Détails ».
  return (
    <div className={own.capri} data-cascade="">
      {voice.mode === "off" && <p className={own.intro}>{t("settings.voice.intro")}</p>}
      <VoiceHero voice={voice} set={set} onRename={() => setIntro(true)} />
      {!ready && call}
      {voice.mode !== "off" && <VoiceHelp voice={voice} set={set} music={false} />}
      <button
        type="button"
        className={css.fold}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {t(open ? "assistant.details.hide" : "assistant.details.show")}
      </button>
      {!open && <p className={own.intro}>{t("assistant.details.help", { name })}</p>}
      {open && (
        <>
          {ready && call}
          {details}
        </>
      )}
      <p className={own.privacy}>{t("settings.voice.privacy")}</p>
    </div>
  );
}
