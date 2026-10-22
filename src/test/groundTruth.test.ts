import { describe, expect, it } from "vitest";
import { computeGroundTruthDistance, findBreakAnchor, groundTruthFromRun, groundTruthLines, type HipPoint } from "../../supabase/functions/analyze-athlete-video/groundTruth";
import { frameSourceSeams } from "@/features/athlete-lab/utils/poseOverlay";

describe("ground truth distance", () => {
  it("break anchor is the lowest hip (max y) in the Break window", () => {
    const hip: HipPoint[] = [[0, 100], [0, 120], [0, 140], [0, 130], [0, 200]];
    expect(findBreakAnchor(hip, { start: 1, end: 3 })).toEqual({ frame: 2, reason: "lowest_hip_in_break_window", hip_y: 140 });
  });

  it("sums per-frame displacement with each frame's own scale; PASS within 10%", () => {
    // 10 px per frame; scale 100 then 50 px/yd -> 0.1 + 0.2 yd per frame.
    const hip: HipPoint[] = [[0, 0], [10, 0], [20, 0], [30, 0], [40, 0]];
    const scale = [100, 100, 100, 50, 50];
    const g = computeGroundTruthDistance({ hip, scale, fps: 2, releaseFrame: 0, breakAnchor: { frame: 4, reason: "lowest_hip_in_break_window", hip_y: 0 }, startYardLine: 5, breakYardLine: 5.6 });
    expect(g?.measured_yd).toBe(0.7);
    expect(g?.expected_yd).toBe(0.6);
    expect(g?.status).toBe("WARN");
    expect(g?.expected_yps).toBe(0.3);
  });

  it("formats both log lines", () => {
    const hip: HipPoint[] = [[0, 0], [100, 0], [200, 0]];
    const g = computeGroundTruthDistance({ hip, scale: [50, 50, 50], fps: 1, releaseFrame: 0, breakAnchor: { frame: 2, reason: "lowest_hip_in_break_window", hip_y: 0 }, startYardLine: 5, breakYardLine: 9 });
    if (!g) throw new Error("null");
    expect(groundTruthLines(g)[0]).toBe("Ground truth distance: expected 4.00 yd, measured 4.00 yd (0.0% off), PASS");
    expect(groundTruthLines(g)[1]).toContain("expected 2.00 yd/s, measured 2.00 yd/s");
  });

  it("only runs for library runs with both yard lines", () => {
    const base = { perFrame: [], phaseWindows: [{ phase: "Break", start: 0, end: 1 }], releaseFrame: 0, fps: 30 };
    expect(groundTruthFromRun({ ...base, context: { camera_angle: "sideline" } })).toBeNull();
    expect(groundTruthFromRun({ ...base, context: { source: "calibration_library", ground_truth: { start_yard_line: 5, break_yard_line: null } } })).toBeNull();
  });
});

describe("frame source seams", () => {
  it("marks leading recovery -> main and main -> following crop, skipping missed frames", () => {
    const seams = frameSourceSeams(8, { missed: new Set([2]), rejected: new Map(), leadingRecovery: new Set([0, 1]), followingCrop: new Set([6, 7]) });
    expect(seams).toEqual([{ frame: 3, from: "leading_recovery", to: "main" }, { frame: 6, from: "main", to: "following_crop" }]);
  });
});
