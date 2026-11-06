import { describe, expect, it } from "vitest";
import type { VoiceSettings } from "../../ipc/bindings";
import { calibScript, CHAPTERS, firstMissing, nameOf } from "./calib";

const voice: VoiceSettings = {
  mode: "always",
  wakeWord: "Dis Yuna",
  hotkey: "",
  model: "parakeet",
  inGame: false,
  wakeHeard: [],
  microphone: "",
  speakers: "",
  aura: "",
  links: [{ name: "Chill", uri: "spotify:album:4aawyAB9vmqN3uQ7FjRGTy" }],
  onlyMe: false,
  echoCancel: true,
  brain: true,
};
const apps = [
  { id: "discord", name: "Discord" },
  { id: "steam", name: "Steam" },
  { id: "dup", name: "discord" },
  { id: "long", name: "A very very long application name here" },
  { id: "elden", name: "Elden Ring" },
];
const scenes = [{ id: "soiree", name: "Soirée jeux" }];

describe("Calibrer ma voix", () => {
  const steps = calibScript(voice, apps, scenes);

  it("says the user's own wake word, its name and apps, in chapter order", () => {
    expect(nameOf("Dis Yuna")).toBe("Yuna");
    expect(steps.filter((s) => s.kind === "wake")).toHaveLength(5);
    expect(steps.find((s) => s.key === "name-1")?.text).toBe("Yuna");
    expect(steps.find((s) => s.key === "open-1")).toMatchObject({
      text: "Dis Yuna, ouvre Discord",
      expect: "app:discord",
    });
    expect(steps.find((s) => s.key === "scene-1")?.expect).toBe("scene:soiree");
    expect(steps.find((s) => s.key === "link-1")).toMatchObject({
      text: "Dis Yuna, mets l’album Chill",
      expect: "link:spotify:album:4aawyAB9vmqN3uQ7FjRGTy",
    });
    const order = steps.map((s) => CHAPTERS.indexOf(s.kind));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("names each app once and leaves the long names out", () => {
    const opened = steps.filter((s) => s.key.startsWith("open-")).map((s) => s.expect);
    expect(opened).toEqual(["app:discord", "app:steam", "app:elden"]);
  });

  it("gives every card a file-safe key, once, and traps that expect nothing", () => {
    const keys = steps.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(k).toMatch(/^[a-z0-9-]{1,40}$/);
    for (const s of steps.filter((x) => x.kind === "trap" || x.kind === "chat"))
      expect(s.expect).toBe("none");
    expect(steps.length).toBeGreaterThanOrEqual(35);
    expect(steps.length).toBeLessThanOrEqual(50);
  });

  it("goes on from the first card not said yet", () => {
    expect(firstMissing(steps, [])).toBe(0);
    expect(firstMissing(steps, ["wake-1", "wake-2"])).toBe(2);
    expect(
      firstMissing(
        steps,
        steps.map((s) => s.key),
      ),
    ).toBe(0);
  });

  it("works without apps, scenes or music", () => {
    const bare = calibScript({ ...voice, links: [] }, [], []);
    expect(bare.some((s) => s.kind === "command")).toBe(true);
    expect(bare.filter((s) => s.kind === "music").map((s) => s.expect)).toEqual([
      "music:pause",
      "music:louder",
    ]);
  });
});
