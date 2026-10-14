import type { AppEntry, ArtImage, ArtRole } from "../../ipc/bindings";
import { imageOf, useArt } from "../../store";

/** Origin of the core's `kayro-art` protocol in WebView2 (Windows): `http://<scheme>.localhost`. */
export const ART_ORIGIN = "http://kayro-art.localhost";

const SLUGS: Record<ArtRole, string> = {
  poster: "poster",
  hero: "hero",
  heroBlur: "hero-blur",
  logo: "logo",
  icon: "icon",
};

/**
 * URL of one of an app's local images (step 14). The page names an app and a role, never a file;
 * the stamp changes with the file, so a new image never shows an old copy.
 */
export function artUrl(id: string, image: Pick<ArtImage, "role" | "stamp">): string {
  return `${ART_ORIGIN}/${id}/${SLUGS[image.role]}?v=${encodeURIComponent(image.stamp)}`;
}

/** The app's image for `role`, or null when it has none (or is not saved yet). */
export function useArtUrl(id: string, role: ArtRole): string | null {
  const image = useArt((s) => imageOf(s, id, role));
  return image && !id.startsWith("pending-") ? artUrl(id, image) : null;
}

/**
 * URL of an app's poster: the image the user dropped on its card, else Steam's own; null when there
 * is none (the card then keeps its A → B face with the icon or the letter).
 */
export function usePosterUrl(app: Pick<AppEntry, "id">): string | null {
  return useArtUrl(app.id, "poster");
}
