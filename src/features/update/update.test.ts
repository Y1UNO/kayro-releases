import { describe, expect, it } from "vitest";
import { UPDATE_DEFAULTS } from "../settings/settingsModel";
import { notePoints } from "./updateStore";

describe("updates (step 18b)", () => {
  it("shows the release notes as points, list marks removed", () => {
    expect(notePoints("- Des sons doux\n- Les mises à jour\r\n\n✦ Signé")).toEqual([
      "Des sons doux",
      "Les mises à jour",
      "Signé",
    ]);
    expect(notePoints(null)).toEqual([]);
  });

  it("never looks for an update unless the user allows it", () => {
    expect(UPDATE_DEFAULTS.updateAuto).toBe(false);
  });
});
