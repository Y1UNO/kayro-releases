/** First letter or digit of a name, upper-cased (the monogram shown when there is no poster). */
export function monogram(name: string): string {
  const first = Array.from(name).find((ch) => /[\p{L}\p{N}]/u.test(ch));
  return (first ?? "·").toLocaleUpperCase();
}

/** The mock-ups vary the card colour slightly from one card to the next. */
const SHADES = [0.9, 1, 1.1, 0.95, 1.05] as const;

/** Stable shade for an app (same card, same colour on every launch). */
export function shadeOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return SHADES[h % SHADES.length] ?? 1;
}
