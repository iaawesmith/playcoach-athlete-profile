import { describe, expect, it } from "vitest";
import {
  buildDepthComparison,
  buildLibraryRunTag,
  checkClipSize,
  computeExpectedDepth,
  isLibraryRun,
  yardMetricNames,
} from "@/services/calibrationLibrary";
import type { KeyMetric, PipelineMetricResult } from "@/features/athlete-lab/types";

describe("calibration library rules", () => {
  it("rejects files over 500 MB and accepts exactly 500 MB", () => {
    expect(checkClipSize(500 * 1024 * 1024)).toBeNull();
    expect(checkClipSize(500 * 1024 * 1024 + 1)).toContain("500 MB");
  });

  it("computes route depth from start and break yard lines", () => {
    expect(computeExpectedDepth(25, 32)).toBe(7);
    expect(computeExpectedDepth(40, 30)).toBe(10);
    expect(computeExpectedDepth(null, 30)).toBeNull();
  });

  it("tags library runs with source and clip id", () => {
    const tag = buildLibraryRunTag({ id: "clip-1", start_yard_line: 25, break_yard_line: 30, expected_calibration_source: "dynamic", depth_metric_key: "Route Depth" });
    expect(tag.source).toBe("calibration_library");
    expect(tag.calibration_clip_id).toBe("clip-1");
    expect(tag.ground_truth.expected_route_depth_yards).toBe(5);
    expect(isLibraryRun({ ...tag })).toBe(true);
    expect(isLibraryRun({ camera_angle: "sideline" })).toBe(false);
  });

  it("only offers yard-unit metrics for the depth dropdown", () => {
    const metric = (name: string, unit: string): KeyMetric => ({ name, unit, description: "", eliteTarget: "", weight: 25 });
    expect(yardMetricNames({ key_metrics: [metric("Hands", "yards"), metric("Speed", "mph"), metric("Angle", "degrees")] })).toEqual(["Hands"]);
  });

  it("compares expected depth only against the chosen metric", () => {
    const r = (name: string, value: number): PipelineMetricResult => ({ name, value, unit: "yards", elite_target: "", weight: 1, status: "scored" });
    const cmp = buildDepthComparison(7, "Depth", ["Depth", "Hands"], [r("Depth", 6.5), r("Hands", 0.4)]);
    expect(cmp.primary).toEqual({ name: "Depth", measured: 6.5, difference: -0.5 });
    expect(cmp.others).toEqual([{ name: "Hands", measured: 0.4 }]);
  });
});
