import { describe, expect, it } from "vitest";
import { CUSTOM_MOODS } from "../../fx/mood/custom";
import { CARD_CELLS, eraseWhen } from "./cinema/cardQuad";
import { TIMING } from "./cinema/scene";
import { GOMMAGE, gommageFrame } from "./gommage";

describe("launch sequence « Gommage » (30/10)", () => {
  it("opens over the card, paints the scene, then holds for the game", () => {
    const at0 = gommageFrame(0, null, null);
    expect(at0.cover).toBe(0);
    expect(at0.card.z).toBe(0);
    expect(at0.erase).toBe(0);
    const mid = gommageFrame(4400, null, null);
    expect(mid.cover).toBe(1);
    expect(mid.light).toBeGreaterThan(0.9);
    expect(mid.strokes).toBe(1);
    expect(mid.mono.rise).toBe(1);
    expect(mid.mono.paint).toBe(1);
    expect(mid.filigree).toBe(1);
    expect(mid.petals).toBeGreaterThan(0.9);
    expect(mid.done).toBe(false);
  });

  it("erases the card into petals in the finale, then ends black", () => {
    const at = TIMING.minHold;
    const during = gommageFrame(at + 600, 1000, null);
    expect(during.erase).toBeGreaterThan(0.4);
    expect(during.erase).toBeLessThan(1);
    const end = gommageFrame(at + GOMMAGE.finale.ms, 1000, null);
    expect(end.done).toBe(true);
    expect(end.erase).toBe(1);
    expect(end.black).toBe(1);
  });

  it("the wind blows harder in the finale, never backwards", () => {
    let last = -1;
    for (let t = 0; t <= TIMING.ceiling; t += 50) {
      const w = gommageFrame(t, 2000, null).windT;
      expect(w).toBeGreaterThanOrEqual(last);
      last = w;
    }
    const calm = gommageFrame(3000, null, null).windT;
    expect(gommageFrame(TIMING.ceiling, null, null).windT - calm).toBeGreaterThan(9);
  });

  it("every cell of the card is erased within the finale's erasing", () => {
    for (let j = 0; j < CARD_CELLS[1]; j++)
      for (let i = 0; i < CARD_CELLS[0]; i++) {
        const w = eraseWhen(i, j);
        expect(w).toBeGreaterThanOrEqual(0);
        expect(w).toBeLessThanOrEqual(1);
      }
    expect(eraseWhen(0, 0)).toBeLessThan(eraseWhen(CARD_CELLS[0] - 1, CARD_CELLS[1] - 1));
  });

  it("the Clair Obscur ambience asks for the Gommage", () => {
    const mood = CUSTOM_MOODS.find((m) => m.id === "petales-gommage");
    expect(mood?.launch).toBe("gommage");
    expect(mood?.gameHint).toContain("Clair Obscur");
  });
});
