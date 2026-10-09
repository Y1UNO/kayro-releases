import { describe, expect, it } from "vitest";
import { APP_NAME } from "./appName";

describe("APP_NAME", () => {
  it("is a non-empty string", () => {
    expect(APP_NAME.length).toBeGreaterThan(0);
  });
});
