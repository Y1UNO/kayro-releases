import { APP_NAME } from "../app/appName";
import assistant from "./fr-assistant.json";
import base from "./fr.json";
import scenes from "./fr-scenes.json";
import settings from "./fr-settings.json";

/** The catalogue, in several files to keep each one short (round 5: scenes and settings apart;
 * step 21: the assistant's page). */
const fr = { ...base, ...scenes, ...settings, ...assistant };

type Flatten<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Flatten<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

/** Every key of the message catalogue (`section.name`); an unknown key is a compile error. */
export type MessageKey = Flatten<typeof fr>;
export type MessageParams = Record<string, string | number>;

function flatten(tree: object, prefix = "", out = new Map<string, string>()): Map<string, string> {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else if (value && typeof value === "object") flatten(value, path, out);
  }
  return out;
}

const messages = flatten(fr);

/** All keys of the catalogue (for tests and tooling). */
export const MESSAGE_KEYS: readonly string[] = [...messages.keys()];

/** Looks a message up and fills its `{name}` placeholders; `{app}` is always the display name. */
export function t(key: MessageKey, params?: MessageParams): string {
  const message = messages.get(key);
  if (message === undefined) return key;
  return message.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = name === "app" ? APP_NAME : params?.[name];
    return value === undefined ? whole : String(value);
  });
}
