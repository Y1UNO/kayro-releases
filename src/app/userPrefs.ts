import { applyQuality, effectiveQuality } from "../design/quality";
import { daStore } from "../design/da/daStore";
import { sameUserChoices, withUser } from "../design/da/userDa";
import { setFollowSystemMotion } from "../fx/motionPref";
import type { Settings } from "../ipc/bindings";
import { hubStore } from "../store";

/**
 * Applies the user's « Visuel » settings (round 5) now and whenever they change, in this window:
 * the art direction's variants (userDa.ts), « Suivre Windows », and the quality level (`quality`:
 * the main window only; the widget has no atmosphere).
 */
export function installUserPrefs({ quality }: { quality: boolean }): void {
  const base = daStore.getState().values;
  const apply = (s: Settings | null, prev: Settings | null) => {
    if (!s) return;
    if (!sameUserChoices(s, prev)) daStore.getState().replace(withUser(base, s));
    setFollowSystemMotion(s.followSystemMotion);
    if (quality && s.quality !== prev?.quality) applyQuality(effectiveQuality(s.quality));
  };
  apply(hubStore.getState().settings, null);
  hubStore.subscribe((s, prev) => {
    if (s.settings !== prev.settings) apply(s.settings, prev.settings);
  });
}
