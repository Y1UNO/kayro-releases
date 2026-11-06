import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Button } from "../../design";
import { t } from "../../i18n";
import type { VoiceSettings } from "../../ipc/bindings";
import { voiceIpc } from "../../ipc/commands";
import { micOpen, useVoice } from "../voice/voiceStore";
import { ToggleRow } from "./SettingRow";
import { Block } from "./VoiceBlock";
import { WakeLearn } from "./WakeLearn";
import own from "./Voice.module.css";

/** The aura's colours on offer (and « Auto », and any other). */
const SWATCHES = ["#8b3dff", "#3dd6ff", "#ff4fa3", "#3dff7a", "#ffb13d", "#f3f7fb"] as const;

/** Same rule as the core (config/voice.rs): a few words of letters, spaces, ' and -. */
export function wakeWordOk(word: string): boolean {
  const w = word.trim();
  return w.length >= 2 && w.length <= 40 && /\p{L}/u.test(w) && /^[\p{L} '’-]+$/u.test(w);
}

export type Set = (patch: Partial<VoiceSettings>) => void;

/** The wake word, and its guided learning in the user's own voice. */
export function WakeBlock({ voice, set }: { voice: VoiceSettings; set: Set }) {
  // Remounted (`key`) when the saved word changes, so the draft starts from it.
  const [draft, setDraft] = useState(voice.wakeWord);
  const [learning, setLearning] = useState(false);
  const status = useVoice((s) => s.state.status);
  const ok = wakeWordOk(draft);
  const save = () => {
    // Another word: what was learned of the old one no longer applies.
    if (ok && draft.trim() !== voice.wakeWord) set({ wakeWord: draft.trim(), wakeHeard: [] });
  };
  const learned = voice.wakeHeard.length;
  return (
    <Block eyebrow={t("assistant.call.eyebrow")} title={t("assistant.call.title")}>
      <p className={own.intro}>{t("settings.voice.wake.help")}</p>
      <p className={own.lineLabel}>{t("settings.voice.wake.label")}</p>
      <input
        className={own.input}
        aria-label={t("settings.voice.wake.label")}
        value={draft}
        maxLength={40}
        spellCheck={false}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && save()}
      />
      {!ok && <p className={own.confirm}>{t("settings.voice.wake.invalid")}</p>}
      <div className={own.line}>
        <Button
          size="sm"
          variant="primary"
          disabled={!micOpen(status)}
          onClick={() => setLearning(true)}
        >
          {t(learned ? "settings.voice.learn.again" : "settings.voice.learn.button")}
        </Button>
        {learned > 0 && (
          <Button size="sm" onClick={() => set({ wakeHeard: [] })}>
            {t("settings.voice.learn.forget")}
          </Button>
        )}
      </div>
      <p className={own.intro}>
        {micOpen(status)
          ? learned
            ? t("settings.voice.learn.learned", { count: learned })
            : t("settings.voice.learn.why")
          : t("settings.voice.learn.needListening")}
      </p>
      {learning && (
        <WakeLearn
          wakeWord={voice.wakeWord}
          onClose={() => setLearning(false)}
          onDone={(heard) => {
            const keep = [...new Set(heard.map((h) => h.trim()).filter((h) => h.length >= 2))];
            set({ wakeHeard: keep.slice(0, 8) });
            setLearning(false);
          }}
        />
      )}
    </Block>
  );
}

/** « Kayro apprend de vous »: how many ways of naming things it learned, and forgetting them. */
export function MemoryBlock() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    void voiceIpc.memory().then((r) => r.ok && setCount(r.value));
  }, []);
  async function forget() {
    await voiceIpc.forget();
    setCount(0);
  }
  return (
    <Block eyebrow={t("settings.voice.eyebrow.voice")} title={t("settings.voice.memory.title")}>
      <p className={own.intro}>{t("settings.voice.memory.help")}</p>
      <div className={own.line}>
        <p className={own.status}>{t("settings.voice.memory.count", { count: count ?? 0 })}</p>
        {count ? (
          <Button size="sm" onClick={() => void forget()}>
            {t("settings.voice.memory.forget")}
          </Button>
        ) : null}
      </div>
    </Block>
  );
}

/** The island's aura while it listens: « Auto » (the island's colour), a few colours, any other. */
export function AuraBlock({ voice, set }: { voice: VoiceSettings; set: Set }) {
  const swatch = (hex: string) => ({ "--swatch": hex, "--swatch-glow": hex }) as CSSProperties;
  const custom =
    voice.aura && !(SWATCHES as readonly string[]).includes(voice.aura) ? voice.aura : "";
  return (
    <Block eyebrow={t("assistant.screen.eyebrow")} title={t("settings.voice.aura.title")}>
      <p className={own.intro}>{t("settings.voice.aura.help")}</p>
      <div className={own.swatches} role="radiogroup" aria-label={t("settings.voice.aura.title")}>
        <button
          type="button"
          role="radio"
          aria-checked={voice.aura === ""}
          aria-label={t("settings.voice.aura.auto")}
          title={t("settings.voice.aura.auto")}
          className={`${own.swatch} ${own.swatchAuto}`}
          onClick={() => set({ aura: "" })}
        />
        {SWATCHES.map((hex) => (
          <button
            key={hex}
            type="button"
            role="radio"
            aria-checked={voice.aura === hex}
            aria-label={t("settings.voice.aura.colour", { hex })}
            className={own.swatch}
            style={swatch(hex)}
            onClick={() => set({ aura: hex })}
          />
        ))}
        <label
          className={`${own.swatch} ${own.swatchCustom}`}
          style={swatch(custom || "#2a2838")}
          aria-checked={custom !== ""}
          role="radio"
          title={t("settings.voice.aura.custom")}
        >
          <input
            type="color"
            aria-label={t("settings.voice.aura.custom")}
            value={custom || "#8b3dff"}
            onChange={(e) => set({ aura: e.target.value.toLowerCase() })}
          />
        </label>
      </div>
      {voice.mode === "always" && (
        <ToggleRow
          label={t("settings.voice.inGame.label")}
          help={t("settings.voice.inGame.help")}
          checked={voice.inGame}
          onChange={(inGame) => set({ inGame })}
        />
      )}
    </Block>
  );
}
