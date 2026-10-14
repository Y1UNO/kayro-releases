/** First letter or digit of a name, upper-cased (the monogram shown when there is no poster). */
export function monogram(name: string): string {
  const first = Array.from(name).find((ch) => /[\p{L}\p{N}]/u.test(ch));
  return (first ?? "·").toLocaleUpperCase();
}

/** The mock-ups vary the card colour slightly from one card to the next. */
const SHADES = [0.9, 1, 1.1, 0.95, 1.05] as const;

/** Where an app's face sits between the theme's A and B (round 5): same draw as its shade. */
const MIXES = [0, 25, 50, 75, 100] as const;

function draw(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % SHADES.length;
}

/** Stable shade for an app (same card, same colour on every launch). */
export function shadeOf(id: string): number {
  return SHADES[draw(id)] ?? 1;
}

/** Stable A → B mix (%) of the face of an app without a poster (round 5, proposal 7). */
export function faceMixOf(id: string): number {
  return MIXES[draw(id)] ?? 50;
}
