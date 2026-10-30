import { followWindowVisible } from "../app/windowVisible";
import type { Settings } from "../ipc/bindings";
import { hubStore, sceneStore } from "../store";
import { doneCount } from "../store/runView";
import { configureSounds, playSound, setSoundsVisible } from "./engine";
import { SILENT, type SoundPrefs } from "./gate";

export { playSound };
export { previewSound, soundWave, stopSound, type PlayOptions } from "./engine";
export type { SoundEvent } from "./manifest";

/** The sound choices of the settings (null: not read yet, silent). */
export function soundPrefs(s: Settings | null): SoundPrefs {
  if (!s) return SILENT;
  return {
    on: s.soundsOn,
    pack: s.soundPack,
    volume: s.soundVolume ?? 0.4,
    families: {
      interface: s.soundInterface,
      transitions: s.soundTransitions,
      launch: s.soundLaunch,
    },
  };
}

let started = false;

/**
 * Step 17b: follows the settings and the window; a launch that fails sounds « error »; a scene
 * plays a rising note for each step done, then « réussite ». Once per page (main.tsx).
 */
export function startSounds(): void {
  if (started) return;
  started = true;
  configureSounds(soundPrefs(hubStore.getState().settings));
  hubStore.subscribe((s, before) => {
    if (s.settings !== before.settings) configureSounds(soundPrefs(s.settings));
    if (s.lastError && s.lastError !== before.lastError) playSound("error");
  });
  followWindowVisible(setSoundsVisible);
  sceneStore.subscribe((s, before) => {
    if (s.run?.status === "completed" && before.run?.status !== "completed") playSound("success");
    else if (s.run && s.run.status === null) {
      const done = doneCount(s.run);
      if (before.run && done > doneCount(before.run)) playSound("progress", { degree: done });
    }
  });
}
