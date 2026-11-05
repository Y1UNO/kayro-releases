import { useMemo } from "react";
import { Button, Dialog } from "../../design";
import { t, type MessageKey } from "../../i18n";
import type { VoiceCandidate, VoiceHeard, VoiceOutcome } from "../../ipc/bindings";
import { ipc, scenesIpc, voiceIpc } from "../../ipc/commands";
import { Message, type MessageContent } from "../home/Message";
import { dismissHeard, useVoice } from "./voiceStore";
import styles from "./VoiceFeedback.module.css";

const say = (key: string, vars: Record<string, string | number> = {}) =>
  t(`voice.heard.${key}` as MessageKey, vars);

/** What one of the wider outcomes says (2026-11-05), or undefined when it is one of the first. */
function wider(o: VoiceOutcome): string | null | undefined {
  switch (o.kind) {
    case "settings":
      return null;
    case "window": {
      const name = o.name || say("window.theWindow");
      return o.ok ? say(`window.${o.what}`, { name }) : say("windowNone");
    }
    case "volumeTo":
      return say("volumeTo", { level: o.level });
    case "appVolume":
      return o.ok
        ? say(`appVolume.${o.what}`, { name: o.name })
        : say("appVolumeNone", { name: o.name });
    case "mic":
      return o.ok ? say(`mic.${o.muted ? "off" : "on"}`) : say("micNone");
    case "theme":
      return o.ok ? say("theme", { name: o.name }) : say("themeNone");
    case "kysland":
      return say(`kysland.${o.on ? "on" : "off"}`);
    case "hands":
      return o.ok ? say(`hands.${o.on ? "on" : "off"}`) : say("handsNone");
    case "nowPlaying":
      return o.title
        ? say("nowPlaying", { title: o.title, artist: o.artist })
        : say("nowPlayingNone");
    case "timer":
    case "timerDone":
      return say(o.kind, { minutes: o.minutes });
    case "time":
      return say("time", { text: o.text });
    case "webSearch":
      return say("webSearch", { query: o.query });
    case "dictated":
      return say(o.ok ? "dictated" : "dictatedNone");
    case "lock":
    case "desktop":
    case "files":
    case "screenshot":
    case "unknown":
      return say(o.kind);
    default:
      return undefined;
  }
}

/** What one outcome says (nothing when Kayro just came or went, or asks). */
function line(o: VoiceOutcome, said: string): string | null {
  if (o.kind === "showKayro" || o.kind === "hideKayro" || o.kind === "doubt") return null;
  const more = wider(o);
  if (more !== undefined) return more;
  const name = "name" in o ? o.name : "";
  const query = o.kind === "search" ? o.query : "";
  const kind =
    o.kind === "music"
      ? `music.${o.action}`
      : o.kind === "musicMode"
        ? `musicMode.${o.on ? "on" : "off"}`
        : o.kind;
  const text = t(`voice.heard.${kind}` as MessageKey, { said, name, query });
  return said.trim() ? text : withoutSaid(text);
}

/**
 * A short note after a command: what was heard and what came of it; several things asked at once
 * (the brain) make one note.
 */
function note(heard: VoiceHeard): MessageContent | null {
  const lines = [heard.outcome, ...(heard.also ?? [])]
    .map((o) => line(o, heard.text))
    .filter((l): l is string => l !== null);
  return lines.length ? { id: heard, text: lines.join(" ") } : null;
}

/**
 * The brain hears the sentence itself and writes nothing down: the note says only what came of it
 * (« « » : Spotify se lance. » → « Spotify se lance. »).
 */
export function withoutSaid(text: string): string {
  const rest = text
    .replace(/^«\s*»\s*:?\s*/u, "")
    .replace(/\s*«\s*»/gu, "")
    .replace(/\s*:\s*\./u, ".")
    .trim();
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

/** Several sound alike: the user picks one (nothing started until then). */
function DoubtDialog({
  said,
  words,
  candidates,
}: {
  said: string;
  words: string;
  candidates: VoiceCandidate[];
}) {
  function pick(c: VoiceCandidate) {
    dismissHeard();
    // The choice teaches Kayro the user's way of naming it (memory.rs).
    void voiceIpc.teach(words, c.scene, c.id);
    if (c.scene) void scenesIpc.run(c.id, false);
    else void ipc.appLaunch(c.id);
  }
  return (
    <Dialog
      open
      onClose={dismissHeard}
      title={t("voice.doubt.title")}
      closeLabel={t("voice.doubt.cancel")}
    >
      <p className={styles.help}>{t("voice.doubt.help", { said })}</p>
      <div className={styles.choices}>
        {candidates.map((c) => (
          <Button key={`${c.scene}-${c.id}`} onClick={() => pick(c)}>
            {c.scene ? t("voice.doubt.scene", { name: c.name }) : c.name}
          </Button>
        ))}
      </div>
    </Dialog>
  );
}

/**
 * Step 21, Kayro's window: what the voice heard. A note for each command; a doubt waits for an
 * answer here (the core shows Kayro for it). « Ferme X » closes at once (the user's choice).
 */
export function VoiceFeedback() {
  const heard = useVoice((s) => s.heard);
  const content = useMemo(() => (heard ? note(heard) : null), [heard]);
  const o = heard?.outcome;
  if (o?.kind === "doubt" && heard)
    return <DoubtDialog said={heard.text} words={o.said} candidates={o.candidates} />;
  return <Message content={content} onClose={dismissHeard} />;
}
