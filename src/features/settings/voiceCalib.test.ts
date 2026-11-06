import { describe, expect, it } from "vitest";
import { missHeard } from "./VoiceCalib";

describe("a missed calibration saying", () => {
  it("reads the brain's lines as what it understood", () => {
    expect(missHeard("appel oui / kayro montrer")).toBe("compris : kayro montrer");
    expect(missHeard("appel oui")).toBe("appelé, rien compris de plus");
    expect(missHeard("appel non")).toBe("pas compris comme un appel");
  });

  it("shows what the command model wrote, or that nothing was heard", () => {
    expect(missHeard("Duna Cash Kayro.")).toBe("entendu « Duna Cash Kayro. »");
    expect(missHeard("  ")).toBe("rien entendu");
  });
});
