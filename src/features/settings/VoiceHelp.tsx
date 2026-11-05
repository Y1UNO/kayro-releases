import { t, type MessageKey } from "../../i18n";
import type { VoiceSettings } from "../../ipc/bindings";
import { useHub } from "../../store";
import { assistantName } from "../voice/name";
import { Block } from "./VoiceBlock";
import { VoiceMusic } from "./VoiceMusic";
import own from "./Voice.module.css";
import css from "./Assistant.module.css";

/** The phrases shown, by theme (each a key of `assistant.help.say`). */
const GROUPS: readonly (readonly [string, readonly string[]])[] = [
  ["apps", ["game", "screen", "kind", "two", "close"]],
  ["windows", ["full", "left", "small"]],
  ["music", ["play", "next", "which", "appVol", "vol"]],
  ["pc", ["lock", "desk", "shot", "time"]],
  ["more", ["timer", "type", "web", "settings", "stop"]],
];

/** Steam's tools filed under games. */
const TOOLS = /lossless|wallpaper|soundtrack|dedicated server|sdk|benchmark/i;

/**
 * « Ce qu'Arya sait faire » (step 21, 2026-11-05): what can be said, by theme, with the user's own
 * apps in the examples; then the user's music to play by its name.
 */
export function VoiceHelp({
  voice,
  set,
  music = true,
}: {
  voice: VoiceSettings;
  set: (patch: Partial<VoiceSettings>) => void;
  /** With « Votre musique » below (folded apart once the assistant is set up). */
  music?: boolean;
}) {
  const apps = useHub((s) => s.apps);
  const name = assistantName(voice.wakeWord);
  // A real game for the example (« Lossless Scaling » or « Wallpaper Engine » are in « Jeux » too).
  const games = apps.filter((a) => a.category === "jeux" && !TOOLS.test(a.name));
  const game = (games.find((a) => a.favorite) ?? games[0])?.name ?? "Steam";
  const soft = apps.find((a) => a.name === "Discord")?.name ?? "Discord";
  const target = (key: string) => (key === "game" ? game : soft);
  const lead = voice.mode === "always" ? `${name}, ` : "";
  return (
    <>
      <Block
        eyebrow={t(music ? "assistant.help.eyebrow" : "assistant.help.eyebrowPlain")}
        title={t(
          /^[aeiouyàâéèêëîïôöùûüh]/iu.test(name)
            ? "assistant.help.titleVowel"
            : "assistant.help.title",
          { name },
        )}
      >
        <p className={own.intro}>{t("assistant.help.intro")}</p>
        <div className={css.groups}>
          {GROUPS.map(([group, says]) => (
            <section key={group} className={css.group}>
              <h4 className={css.groupTitle}>{t(`assistant.help.${group}` as MessageKey)}</h4>
              <ul className={css.says}>
                {says.map((s) => (
                  <li key={s}>
                    {t("assistant.help.quote", {
                      lead,
                      text: t(`assistant.help.say.${s}` as MessageKey, { target: target(s) }),
                    })}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        {voice.mode === "always" && <p className={own.intro}>{t("assistant.help.follow")}</p>}
      </Block>
      {music && <VoiceMusic voice={voice} set={set} />}
    </>
  );
}
