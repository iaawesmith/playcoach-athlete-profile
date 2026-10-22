import { describe, expect, it } from "vitest";
import { noScaleSkip, unitNeedsScale } from "../../supabase/functions/analyze-athlete-video/scaleGate";
import { athleteHeightError } from "../../supabase/functions/_shared/athleteHeight";

const noScale = { source: "none", pixelsPerYard: null };
const scaled = { source: "height_based", pixelsPerYard: 190 };

describe("no-scale safety rule", () => {
  it("skips distance and speed metrics when the run has no real scale", () => {
    for (const unit of ["yards", "mph", "yd/s", "mph/s"]) expect(noScaleSkip(unit, noScale)).toBe(true);
  });
  it("angle, ratio, time and frame metrics still score without a scale", () => {
    for (const unit of ["degrees", "ratio", "sec", "frames"]) expect(noScaleSkip(unit, noScale)).toBe(false);
  });
  it("distance metrics score when a real scale exists", () => {
    expect(noScaleSkip("mph", scaled)).toBe(false);
    expect(unitNeedsScale("yards")).toBe(true);
  });
});

describe("athlete height sanity range", () => {
  it("requires a value", () => expect(athleteHeightError("", "inches")).toMatch(/required/));
  it("accepts 48 and 90 inches", () => {
    expect(athleteHeightError(48, "inches")).toBeNull();
    expect(athleteHeightError(90, "inches")).toBeNull();
    expect(athleteHeightError(69, "inches")).toBeNull();
  });
  it("rejects 47 and 91 inches", () => {
    expect(athleteHeightError(47, "inches")).toMatch(/48–90 inches/);
    expect(athleteHeightError(91, "inches")).toMatch(/48–90 inches/);
  });
  it("uses the cm equivalent", () => {
    expect(athleteHeightError(175, "cm")).toBeNull();
    expect(athleteHeightError(121, "cm")).toMatch(/122–229 cm/);
    expect(athleteHeightError(230, "cm")).not.toBeNull();
  });
});
