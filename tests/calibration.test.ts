import { describe, expect, it } from "vitest";
import { applyFeedback } from "../lib/calibration";

describe("applyFeedback", () => {
  it("cold lowers the offset, warm raises it, right leaves it", () => {
    expect(applyFeedback(0, "cold", 30)).toBe(-0.5);
    expect(applyFeedback(0, "warm", 30)).toBe(0.5);
    expect(applyFeedback(1.5, "right", 30)).toBe(1.5);
  });

  it("ignores feedback after very short exposure", () => {
    expect(applyFeedback(1, "cold", 14)).toBe(1);
    expect(applyFeedback(1, "cold", 15)).toBe(0.5);
  });

  it("clamps to ±4", () => {
    expect(applyFeedback(-4, "cold", 30)).toBe(-4);
    expect(applyFeedback(3.8, "warm", 30)).toBe(4);
  });

  it("rounds to 0.1 without float noise", () => {
    expect(applyFeedback(0.1 + 0.2, "warm", 30)).toBe(0.8);
    expect(applyFeedback(0.5, "cold", 30)).toBe(0);
    expect(Object.is(applyFeedback(0.5, "cold", 30), -0)).toBe(false);
  });

  it("converges after repeated feedback", () => {
    let o = 0;
    for (let i = 0; i < 20; i++) o = applyFeedback(o, "cold", 40);
    expect(o).toBe(-4);
  });
});
