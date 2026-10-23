import { describe, expect, it } from "vitest";
import { measurementFrames } from "../../supabase/functions/analyze-athlete-video/measurementWindow";

describe("fixed measurement windows match the analyzer's previous defaults", () => {
  it("angle uses the phase midpoint ±2 (5 frames)", () => expect(measurementFrames("angle")).toBe(5));
  it("velocity needs at least 3 frames of net displacement", () => expect(measurementFrames("velocity")).toBe(3));
  it("distance_variance uses 10 frames", () => expect(measurementFrames("distance_variance")).toBe(10));
  it("speed_retention uses 5 frames", () => expect(measurementFrames("speed_retention")).toBe(5));
  it("acceleration uses 5 and frame_delta uses 10", () => {
    expect(measurementFrames("acceleration")).toBe(5);
    expect(measurementFrames("frame_delta")).toBe(10);
  });
});
