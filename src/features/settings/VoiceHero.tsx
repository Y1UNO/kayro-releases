import { Button, SegmentedControl } from "../../design";
import { t, type MessageKey } from "../../i18n";
import type { VoiceMode, VoiceSettings } from "../../ipc/bindings";
import { assistantName } from "../voice/name";
import { useVoice } from "../voice/voiceStore";
import { Block } from "./VoiceBlock";
import { VoiceInstall } from "./VoiceInstall";
import own from "./Voice.module.css";
import css from "./Assistant.module.css";

const MODES: readonly VoiceMode[] = ["always", "pushToTalk", "off"];

/**
 * The page's first card: the assistant by its name, where it stands, how it listens, and what is
 * left to install (one button). « Changer de nom » goes back to the introduction.
 */
export function VoiceHero({
  voice,
  set,
  onRename,
}: {
  voice: VoiceSettings;
  set: (patch: Partial<VoiceSettings>) => void;
  onRename: () => void;
}) {
  const state = useVoice((s) => s.state);
  const name = assistantName(voice.wakeWord);
  const status =
    voice.mode === "off"
      ? t("assistant.hero.off", { name })
      : t(`settings.voice.status.${state.status}` as MessageKey, {
          model: state.missing
            ? t(`settings.voice.models.${state.missing}.name` as MessageKey)
            : "",
        });
  const rename = (
    <Button size="sm" onClick={onRename}>
      {t("assistant.hero.rename")}
    </Button>
  );
  return (
    <Block eyebrow={t("assistant.hero.eyebrow")} title={name}>
      {/* A model missing: the install below says it, with its button. */}
      {!(voice.mode !== "off" && state.status === "noModel") && (
        <p className={own.status} data-status={state.status} role="status">
          {status}
        </p>
      )}
      <SegmentedControl<VoiceMode>
        label={t("settings.voice.mode.label")}
        size="sm"
        value={voice.mode}
        onChange={(mode) => set({ mode })}
        options={MODES.map((v) => ({
          value: v,
          label: t(
            v === "always"
              ? "assistant.intro.always"
              : v === "pushToTalk"
                ? "assistant.intro.push"
                : "settings.voice.mode.off",
          ),
        }))}
      />
      {voice.mode !== "off" && (
        <p className={own.intro}>
          {voice.mode === "always"
            ? t("assistant.hero.say", { name })
            : t("assistant.hero.sayPush")}
        </p>
      )}
      {voice.mode !== "off" && (
        <VoiceInstall
          voice={voice}
          name={name}
          onBrain={(brain) => set({ brain })}
          onOff={() => set({ mode: "off" })}
          actions={rename}
        />
      )}
      {voice.mode === "off" && <div className={css.heroActions}>{rename}</div>}
    </Block>
  );
}
