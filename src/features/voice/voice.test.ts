import { describe, expect, it } from "vitest";
import type { VoiceSettings } from "../../ipc/bindings";
import { wakeWordOk } from "../settings/VoiceSection";
import { withoutSaid } from "./VoiceFeedback";
import { micOpen, neededModels } from "./voiceStore";

const voice = (patch: Partial<VoiceSettings>): VoiceSettings => ({
  mode: "off",
  wakeWord: "Hé Kayro",
  hotkey: "Ctrl+Alt+V",
  model: "parakeet",
  inGame: false,
  wakeHeard: [],
  microphone: "",
  speakers: "",
  aura: "",
  links: [],
  onlyMe: false,
  echoCancel: true,
  brain: true,
  ...patch,
});

describe("the voice's models", () => {
  it("needs nothing off, the command model to talk, and the two listeners always", () => {
    expect(neededModels(voice({}))).toEqual([]);
    expect(neededModels(voice({ mode: "pushToTalk", model: "canary" }))).toEqual(["canary"]);
    expect(neededModels(voice({ mode: "always" }))).toEqual(["silero", "wake", "parakeet"]);
  });
});

describe("the microphone indicator", () => {
  it("is lit only while the microphone listens", () => {
    for (const s of ["waiting", "hearing", "thinking", "following"] as const)
      expect(micOpen(s)).toBe(true);
    for (const s of ["off", "ready", "paused", "muted", "noModel", "loading"] as const)
      expect(micOpen(s)).toBe(false);
  });
});

describe("the wake word", () => {
  it("follows the core's rule: a few words of letters", () => {
    expect(wakeWordOk("Hé Kayro")).toBe(true);
    expect(wakeWordOk("Dis-moi l'île")).toBe(true);
    expect(wakeWordOk("a")).toBe(false);
    expect(wakeWordOk("Kayro 2")).toBe(false);
    expect(wakeWordOk("x".repeat(41))).toBe(false);
  });
});

describe("the island's aura", () => {
  it("is the user's colour, else the album's brighter one, else the theme's", async () => {
    const { auraColour } = await import("./aura");
    expect(auraColour("#3dd6ff", ["#ff0000"])).toBe("#3dd6ff");
    expect(auraColour("", ["#181c21", "#d04070"])).toBe("#d04070");
    // A near-black cover gives no glow: the CSS takes the theme's accent.
    expect(auraColour("", ["#181c21", "#04080f"])).toBeNull();
    expect(auraColour("", undefined)).toBeNull();
  });
});

describe("the user's music links", () => {
  it("keeps Spotify's own addresses only", async () => {
    const { spotifyUri } = await import("./voiceStore");
    const id = "37i9dQZF1DXcBWIGoYBM5M";
    expect(spotifyUri(`https://open.spotify.com/playlist/${id}?si=abc`)).toBe(
      `spotify:playlist:${id}`,
    );
    expect(spotifyUri(`https://open.spotify.com/intl-fr/album/${id}`)).toBe(`spotify:album:${id}`);
    expect(spotifyUri(`spotify:track:${id}`)).toBe(`spotify:track:${id}`);
    expect(spotifyUri("https://evil.example/playlist/" + id)).toBeNull();
    expect(spotifyUri("cmd /c calc")).toBeNull();
  });
});

describe("the user's music links, strictly", () => {
  it("does not take a look-alike site", async () => {
    const { spotifyUri } = await import("./voiceStore");
    expect(spotifyUri("https://openXspotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M")).toBeNull();
  });
});

describe("a note without what was said (the brain writes nothing down)", () => {
  it("keeps only what came of it", () => {
    expect(withoutSaid("«  » : Spotify se lance.")).toBe("Spotify se lance.");
    expect(withoutSaid("Pas compris : «  ». Dites par exemple « lance Steam ».")).toBe(
      "Pas compris. Dites par exemple « lance Steam ».",
    );
    expect(withoutSaid("Pause.")).toBe("Pause.");
  });
});
