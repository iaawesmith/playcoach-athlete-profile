import { describe, expect, it } from "vitest";
import { computeSpeedRetention, frameSpeedYps, type HipPoint } from "../../supabase/functions/analyze-athlete-video/speedRetention";
import { scoreMetric } from "../../supabase/functions/analyze-athlete-video/scoring";
import { buildPhaseStatuses, athleteVisiblePhases } from "@/features/athlete-lab/utils/phaseStatus";

// Hip moves `stepPx[f]` pixels right on frame f (from f-1).
function track(stepPx: number[]): HipPoint[] {
  let x = 0;
  return stepPx.map((d) => { x += d; return [x, 100] as const; });
}

describe("speed into the break", () => {
  it("uses the 5 frames immediately before the next phase, not the end of the phase", () => {
    // Phase 0..19, next phase starts at 15 (overlap 15..19 decelerates hard).
    const steps = Array.from({ length: 20 }, (_, f) => (f >= 15 ? 1 : f >= 10 ? 8 : 10));
    const r = computeSpeedRetention({ hip: track(steps), scale: steps.map(() => 30), fps: 30, phase: { start: 0, end: 19 }, nextPhaseStart: 15 });
    expect(r.value).toBe(0.8);
    if (r.value === null) throw new Error("skipped");
    expect(r.detail.end_window).toEqual({ start: 10, end: 14 });
    expect(r.detail.peak_window).toEqual({ start: 1, end: 5 });
  });

  it("searches the peak only in frames before the next phase starts", () => {
    // Fast frames 16..19 sit after nextPhaseStart (15) and must be ignored.
    const steps = Array.from({ length: 20 }, (_, f) => (f >= 15 ? 20 : f >= 10 ? 8 : 10));
    const r = computeSpeedRetention({ hip: track(steps), scale: steps.map(() => 30), fps: 30, phase: { start: 0, end: 19 }, nextPhaseStart: 15, peakEnd: 14 });
    if (r.value === null) throw new Error("skipped");
    expect(r.detail.peak_window.end).toBeLessThanOrEqual(14);
    expect(r.detail.peak_search).toEqual({ start: 1, end: 14 });
    expect(r.value).toBe(0.8);
  });

  it("converts each frame with its own scale", () => {
    const hip = track([0, 30, 30]);
    expect(frameSpeedYps(hip, [30, 30, 60], 30, 1)).toBe(30);
    expect(frameSpeedYps(hip, [30, 30, 60], 30, 2)).toBe(15);
  });

  it("skips with stem_end_overlaps_break when fewer than 5 usable frames precede the next phase", () => {
    const steps = Array.from({ length: 10 }, () => 10);
    const r = computeSpeedRetention({ hip: track(steps), scale: steps.map(() => 30), fps: 30, phase: { start: 0, end: 9 }, nextPhaseStart: 4 });
    expect(r.value).toBeNull();
    expect("reason" in r ? r.reason : null).toBe("stem_end_overlaps_break");
  });

  it("skips when a frame in the end window is missing", () => {
    const steps = Array.from({ length: 20 }, () => 10);
    const hip = track(steps);
    hip[12] = null;
    const r = computeSpeedRetention({ hip, scale: steps.map(() => 30), fps: 30, phase: { start: 0, end: 19 }, nextPhaseStart: 15 });
    expect("reason" in r ? r.reason : null).toBe("stem_end_overlaps_break");
  });

  it("scores at_least 0.9 with tolerance 0.2", () => {
    expect(scoreMetric(0.95, 0.9, 0.2, "at_least")).toBe(100);
    expect(scoreMetric(0.9, 0.9, 0.2, "at_least")).toBe(100);
    expect(scoreMetric(0.7, 0.9, 0.2, "at_least")).toBeLessThan(100);
  });
});

describe("phase display", () => {
  const phases = [{ id: "rel", name: "Release" }, { id: "stem", name: "Stem" }, { id: "catch", name: "Catch Window" }];
  const statuses = buildPhaseStatuses(phases, { rel: 70 }, [{ phase_id: "rel" }, { phase_id: "stem" }]);

  it("gives admin reasons for unscored phases", () => {
    expect(statuses.map((p) => p.reason)).toEqual([null, "metric not measurable this run", "no active metric"]);
  });

  it("athletes see only phases with a scored metric", () => {
    expect(athleteVisiblePhases(statuses).map((p) => p.name)).toEqual(["Release"]);
  });
});
