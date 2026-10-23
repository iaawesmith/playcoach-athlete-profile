import { describe, expect, it } from "vitest";
import { EMPTY_CLIP_METADATA, type CalibrationClip } from "@/services/calibrationLibrary";
import { libraryAnalysisContext, libraryClipValues, libraryContextDifferences } from "@/services/libraryRunContext";

const clip: CalibrationClip = {
  ...EMPTY_CLIP_METADATA, id: "clip-1", storage_path: "calibration-library/clip.mp4",
  title: "Slant", notes: "Contested catch", duration_seconds: 2.27, catch_status: "partial",
  route_direction: "straight", athlete_height: 69, athlete_wingspan: null,
  expected_route_depth_yards: null, archived: false, created_at: "2026-10-20", run_count: 0, node: null,
};

describe("library run provenance", () => {
  it("uses the stored duration, not the node minimum, capped at 3 seconds", () => {
    expect(libraryClipValues(clip).end_seconds).toBe(2.27);
    expect(libraryClipValues({ ...clip, duration_seconds: 8 }).end_seconds).toBe(8);
    expect(libraryClipValues({ ...clip, duration_seconds: null }).end_seconds).toBeNull();
  });
  it("retains partial catch and straight direction exactly", () => {
    const context = libraryAnalysisContext(libraryClipValues(clip));
    expect(context.catch_status).toBe("partial");
    expect(context.catch_included).toBe(true);
    expect(context.route_direction).toBe("straight");
  });
  it("maps notes to description and blanks unsupported focus and absent wingspan", () => {
    const values = libraryClipValues(clip);
    expect(values.performance_description).toBe("Contested catch");
    expect(values.focus_area).toBe("");
    expect(libraryAnalysisContext(values).athlete_wingspan).toBeNull();
  });
  it("records only changed fields and original/run values", () => {
    const values = libraryClipValues(clip);
    expect(libraryContextDifferences(clip, values)).toEqual([]);
    expect(libraryContextDifferences(clip, { ...values, athlete_height: 70 })).toEqual([
      { field: "athlete_height", clip_value: 69, run_value: 70 },
    ]);
  });
  it("detects a clip record changed after load", () => {
    expect(libraryContextDifferences({ ...clip, camera_angle: "endzone" }, libraryClipValues(clip))).toEqual([
      { field: "camera_angle", clip_value: "endzone", run_value: "sideline" },
    ]);
  });
});