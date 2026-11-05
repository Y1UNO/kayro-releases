import { useState } from "react";
import { Button, Pill } from "../../design";
import { t, type MessageKey } from "../../i18n";
import type { AppError, VoiceModel, VoiceSettings } from "../../ipc/bindings";
import { voiceIpc } from "../../ipc/commands";
import { errorText } from "../../ipc/errors";
import { neededModels, refreshModels, useVoice } from "../voice/voiceStore";
import { ToggleRow } from "./SettingRow";
import { Block } from "./VoiceBlock";
import own from "./Voice.module.css";
import cards from "./VoiceModels.module.css";

/** The models that write the command down (one is used), then the always mode's two. */
const COMMAND: readonly VoiceModel[] = ["parakeet", "canary"];
const LISTEN = ["silero", "wake"] as const;
const SPEAKER = ["speaker"] as const;
const BRAIN = ["brain"] as const;

const text = (id: string, part: string) => t(`settings.voice.models.${id}.${part}` as MessageKey);

interface Props {
  voice: VoiceSettings;
  onPick: (model: VoiceModel) => void;
}

interface SectionProps extends Props {
  /** The brain turned on or off (it stays downloaded). */
  onBrain: (on: boolean) => void;
}

/** One model: a line on what it is for, « Détails » for the rest, download / remove with a bar. */
function ModelCard({ id, voice, onPick }: Props & { id: string }) {
  const info = useVoice((s) => s.models.find((m) => m.id === id));
  const progress = useVoice((s) => s.progress[id]);
  const [error, setError] = useState<AppError | null>(null);
  const [details, setDetails] = useState(false);
  const [asking, setAsking] = useState(false);
  const downloading = info?.downloading || progress?.step === "downloading";
  const inUse = neededModels(voice).includes(id);
  const isCommand = (COMMAND as readonly string[]).includes(id);
  const chosen = isCommand && voice.model === id;

  async function download() {
    setError(null);
    const r = await voiceIpc.download(id);
    if (!r.ok && progress?.step !== "cancelled") setError(r.error);
    void refreshModels();
  }

  async function remove() {
    setAsking(false);
    setError(null);
    const r = await voiceIpc.remove(id);
    if (!r.ok) setError(r.error);
    void refreshModels();
  }

  const fraction = downloading ? (progress?.fraction ?? 0) : 0;
  return (
    <article className={cards.card} data-chosen={chosen || undefined}>
      <div className={cards.cardHead}>
        <h4 className={cards.cardName}>{text(id, "name")}</h4>
        {chosen && <Pill tone="accent">{t("settings.voice.models.chosen")}</Pill>}
        {info?.installed && !chosen && (
          <Pill tone="soft">{t("settings.voice.models.installed")}</Pill>
        )}
      </div>
      <p className={cards.desc}>{text(id, "desc")}</p>
      <button
        type="button"
        className={cards.more}
        aria-expanded={details}
        onClick={() => setDetails(!details)}
      >
        {t(details ? "settings.voice.models.less" : "settings.voice.models.details")}
      </button>
      {details && (
        <p className={cards.details}>
          <span>{text(id, "when")}</span>
          <strong>{text(id, "facts")}</strong>
          <span>{text(id, "licence")}</span>
        </p>
      )}
      {downloading ? (
        <div className={cards.progress} role="status">
          <div className={cards.track}>
            <span className={cards.fill} style={{ transform: `scaleX(${fraction})` }} />
          </div>
          <div className={cards.progressLine}>
            <span>
              {t("settings.voice.models.progress", {
                done: progress?.doneMb ?? 0,
                total: info?.sizeMb ?? 0,
              })}
            </span>
            <Button size="sm" onClick={() => void voiceIpc.cancel(id)}>
              {t("settings.voice.models.cancel")}
            </Button>
          </div>
        </div>
      ) : asking ? (
        <div className={cards.actions}>
          <p className={own.confirm}>{t("settings.voice.models.removeAsk")}</p>
          <Button size="sm" variant="primary" onClick={() => void remove()}>
            {t("settings.voice.models.remove")}
          </Button>
          <Button size="sm" onClick={() => setAsking(false)}>
            {t("settings.voice.models.cancel")}
          </Button>
        </div>
      ) : (
        <div className={cards.actions}>
          {info?.installed ? (
            <>
              {isCommand && !chosen && (
                <Button size="sm" variant="primary" onClick={() => onPick(id as VoiceModel)}>
                  {t("settings.voice.models.use")}
                </Button>
              )}
              <Button size="sm" onClick={() => (inUse ? setAsking(true) : void remove())}>
                {t("settings.voice.models.remove")}
              </Button>
            </>
          ) : (
            <Button size="sm" variant="primary" onClick={() => void download()}>
              {t("settings.voice.models.download", { size: info?.sizeMb ?? 0 })}
            </Button>
          )}
        </div>
      )}
      {error && (
        <p className={own.confirm} role="alert">
          {errorText(error)}
        </p>
      )}
    </article>
  );
}

/** Réglages › Assistant vocal et IA › Modèles: everything stays on this PC once downloaded. */
export function VoiceModels({ onBrain, ...props }: SectionProps) {
  const brainThere = useVoice((s) => s.models.some((m) => m.id === "brain" && m.installed));
  return (
    <Block eyebrow={t("settings.voice.eyebrow.models")} title={t("settings.voice.models.label")}>
      <p className={own.intro}>{t("settings.voice.models.help")}</p>
      <div className={cards.cards}>
        {COMMAND.map((id) => (
          <ModelCard key={id} id={id} {...props} />
        ))}
      </div>
      <p className={cards.subLabel}>{t("settings.voice.models.listenLabel")}</p>
      <div className={cards.cards}>
        {LISTEN.map((id) => (
          <ModelCard key={id} id={id} {...props} />
        ))}
      </div>
      <p className={cards.subLabel}>{t("settings.voice.models.brainLabel")}</p>
      <div className={cards.cards}>
        {BRAIN.map((id) => (
          <ModelCard key={id} id={id} {...props} />
        ))}
      </div>
      {brainThere && (
        <ToggleRow
          label={t("settings.voice.models.brainUse")}
          help={t("settings.voice.models.brainUseHelp")}
          checked={props.voice.brain}
          onChange={onBrain}
        />
      )}
      <p className={cards.subLabel}>{t("settings.voice.models.speakerLabel")}</p>
      <div className={cards.cards}>
        {SPEAKER.map((id) => (
          <ModelCard key={id} id={id} {...props} />
        ))}
      </div>
      <p className={own.intro}>{t("settings.voice.models.rhythm")}</p>
    </Block>
  );
}
