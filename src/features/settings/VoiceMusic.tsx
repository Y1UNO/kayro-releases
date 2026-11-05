import { useState } from "react";
import { Button } from "../../design";
import { t, type MessageKey } from "../../i18n";
import type { VoiceLink, VoiceSettings } from "../../ipc/bindings";
import { spotifyUri } from "../voice/voiceStore";
import { Block } from "./VoiceBlock";
import { wakeWordOk } from "./VoiceSection";
import own from "./Voice.module.css";

/** At most this many (config/voice.rs `LINKS_MAX`). */
const MAX = 50;

/**
 * « Votre musique » (step 21): a Spotify playlist, album or track by a name the user picks
 * (« Chill »), then « mets ma playlist chill ». The shared link becomes Spotify's own address;
 * nothing else can be added (the core checks it again).
 */
export function VoiceMusic({
  voice,
  set,
}: {
  voice: VoiceSettings;
  set: (patch: Partial<VoiceSettings>) => void;
}) {
  const [name, setName] = useState("");
  const [link, setLink] = useState("");
  const uri = spotifyUri(link);
  const ok = uri !== null && wakeWordOk(name) && voice.links.length < MAX;
  const kind = (u: string) => u.split(":")[1] ?? "playlist";

  function add() {
    if (!ok || !uri) return;
    const next: VoiceLink[] = [
      ...voice.links.filter((l) => l.name.toLowerCase() !== name.trim().toLowerCase()),
      { name: name.trim(), uri },
    ];
    set({ links: next });
    setName("");
    setLink("");
  }

  return (
    <Block eyebrow={t("assistant.help.eyebrow")} title={t("settings.voice.music.title")}>
      <p className={own.intro}>{t("settings.voice.music.help")}</p>
      {voice.links.length > 0 && (
        <ul className={own.links}>
          {voice.links.map((l) => (
            <li key={l.uri + l.name} className={own.linkRow}>
              <span className={own.linkName}>{l.name}</span>
              <span className={own.linkKind}>
                {t(`settings.voice.music.kind.${kind(l.uri)}` as MessageKey)}
              </span>
              <Button size="sm" onClick={() => set({ links: voice.links.filter((x) => x !== l) })}>
                {t("settings.voice.music.remove")}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className={own.line}>
        <input
          className={own.input}
          aria-label={t("settings.voice.music.name")}
          placeholder={t("settings.voice.music.name")}
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className={own.input}
          aria-label={t("settings.voice.music.link")}
          placeholder={t("settings.voice.music.link")}
          value={link}
          spellCheck={false}
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <Button size="sm" variant="primary" disabled={!ok} onClick={add}>
          {t("settings.voice.music.add")}
        </Button>
      </div>
      {link.trim() !== "" && !uri && <p className={own.confirm}>{t("settings.voice.music.bad")}</p>}
    </Block>
  );
}
