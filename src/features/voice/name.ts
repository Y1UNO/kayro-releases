/**
 * The assistant's name: the wake word's longest word (« Arya » in « Dis Arya »), as the core reads
 * it (src-tauri/src/voice/brain/prompt.rs, `name_of`).
 */
export function assistantName(wakeWord: string): string {
  const words = wakeWord.split(/[\s'’,-]+/u).filter(Boolean);
  const name = words.reduce((best, w) => ([...w].length > [...best].length ? w : best), "") || wakeWord;
  // « ARYA » (what the wake word learning writes) reads « Arya ».
  return name === name.toUpperCase() && name.length > 1
    ? name.charAt(0) + name.slice(1).toLowerCase()
    : name;
}

/** The same name, whatever its case (« ARYA » is « Arya »). */
export function sameName(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase("fr") === b.trim().toLocaleLowerCase("fr");
}

/** A few names that the small model hears well (two syllables, unlike everyday words). */
export const NAME_IDEAS = ["Arya", "Nova", "Kaïa", "Orion", "Luna", "Zéphyr"] as const;
