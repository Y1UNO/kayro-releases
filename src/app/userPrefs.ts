import { autoQualityStore } from "../design/autoQualityStore";
import { applyQuality, effectiveQuality } from "../design/quality";
import type { AutoRung } from "../fx/autoQuality";
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
  const rungNow = () => autoQualityStore.getState().state.rung;
  let lastRung = rungNow();
  const apply = (s: Settings | null, prev: Settings | null, prevRung: AutoRung) => {
    if (!s) return;
    const rung = rungNow();
    if (!sameUserChoices(s, prev, rung, prevRung))
      daStore.getState().replace(withUser(base, s, rung));
    setFollowSystemMotion(s.followSystemMotion);
    const level = effectiveQuality(s.quality);
    if (quality && (s.quality !== prev?.quality || rung !== prevRung)) applyQuality(level);
  };
  apply(hubStore.getState().settings, null, lastRung);
  hubStore.subscribe((s, prev) => {
    if (s.settings !== prev.settings) apply(s.settings, prev.settings, lastRung);
  });
  // Step 24: « Auto » moved (main window): the level drawn, the hover and the float follow.
  autoQualityStore.subscribe(() => {
    const prevRung = lastRung;
    lastRung = rungNow();
    if (lastRung !== prevRung) {
      const s = hubStore.getState().settings;
      apply(s, s, prevRung);
    }
  });
}
