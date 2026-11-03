/**
 * Kysland's music mode: the album's cover drawn square (its middle, 256 px: plenty for the
 * player's label), for its texture and its colours. Null if it cannot be read.
 */
export async function squareCover(src: string): Promise<HTMLCanvasElement | null> {
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  try {
    await img.decode();
  } catch {
    return null;
  }
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  if (!g) return null;
  const s = Math.min(img.naturalWidth, img.naturalHeight);
  g.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, 256, 256);
  return c;
}
