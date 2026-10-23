import { describe, expect, it } from "vitest";
import {
  followWindow,
  frameFromMediaTime,
  frameSource,
  mediaTimeForFrame,
  phaseLabel,
  parseOverlayData,
  resolveMetricFrames,
  toDisplay,
} from "@/features/athlete-lab/utils/poseOverlay";

const windows = [
  { phase: "Release", start: 10, end: 24 },
  { phase: "Stem", start: 19, end: 45 },
  { phase: "Break", start: 38, end: 53 },
  { phase: "Catch Window", start: 46, end: 80 },
];

describe("historical pose log compatibility", () => {
  it("loads phase windows, confidence and release anchor from stored log_data.rtmlib", () => {
    const stored = { result_data: {
      diagnostics: { raw_keypoints: [[[[10, 20]]]], service: { frame_count: 90, fps: 30 } },
      log_data: { rtmlib: {
        phase_windows: windows,
        release_anchor: { applied: true, frame: 10 },
        keypoint_confidence: [{ index: 25, status: "RELIABLE" }],
      } },
    } };
    const data = parseOverlayData(stored, []);
    expect(data?.frameCount).toBe(90);
    expect(data?.phaseWindows).toEqual(windows);
    expect(data?.releaseAnchorFrame).toBe(10);
    expect(data?.landmarkStatus.get(25)).toBe("reliable");
    expect(data?.keypoints[0]).toEqual([[10, 20]]);
  });
});

describe("coordinate scaling", () => {
  it("maps 4K native pixels to a 960x540 display", () => {
    expect(toDisplay([1920, 1080], { x: 0, y: 0, w: 3840, h: 2160 }, 960, 540)).toEqual([480, 270]);
  });
  it("maps into a follow crop", () => {
    expect(toDisplay([1640, 960], { x: 1000, y: 600, w: 1280, h: 720 }, 1280, 720)).toEqual([640, 360]);
  });
  it("follow window is a third of frame width and clamped inside the frame", () => {
    expect(followWindow([100, 100], 3840, 2160)).toEqual({ x: 0, y: 0, w: 1280, h: 720 });
  });
});

describe("frame sync", () => {
  it("counts frames from the first-frame timestamp, not zero", () => {
    expect(frameFromMediaTime(0.1 + 46 / 30, 0.1, 30, 0, 90)).toBe(46);
    expect(frameFromMediaTime(mediaTimeForFrame(46, 0.1, 30, 0), 0.1, 30, 0, 90)).toBe(46);
  });
});

describe("frame source", () => {
  const d = { missed: new Set([5]), rejected: new Map([[6, "jump"]]), leadingRecovery: new Set([0, 1]), followingCrop: new Set([80]) };
  it("labels each source", () => {
    expect(frameSource(0, d)).toBe("leading_recovery");
    expect(frameSource(5, d)).toBe("missed");
    expect(frameSource(6, d)).toBe("rejected");
    expect(frameSource(80, d)).toBe("following_crop");
    expect(frameSource(40, d)).toBe("main");
  });
});

describe("phase labels", () => {
  it("shows both phases on overlap and stance before release", () => {
    expect(phaseLabel(46, windows)).toBe("Break + Catch Window");
    expect(phaseLabel(3, windows)).toBe("pre-release (stance)");
  });
});

describe("metric highlight frames", () => {
  it("offsets window-relative framesUsed by the phase start (Plant Leg 6-10 in Break 38 -> 44-48)", () => {
    expect(resolveMetricFrames({ framesUsed: [6, 7, 8, 9, 10] }, windows[2])).toEqual([44, 45, 46, 47, 48]);
  });
  it("uses first/last frame indices for velocity metrics", () => {
    expect(resolveMetricFrames({ firstFrameIndex: 0, lastFrameIndex: 2 }, windows[0])).toEqual([10, 11, 12]);
  });
  it("keeps catch-anchored frames absolute", () => {
    expect(resolveMetricFrames({ method: "catch_anchored", framesUsed: [60, 61] }, windows[3])).toEqual([60, 61]);
  });
  it("uses end and peak windows for speed retention", () => {
    expect(resolveMetricFrames({ method: "speed_retention", end_window: { start: 33, end: 37 }, peak_window: { start: 20, end: 24 } }, windows[1]))
      .toEqual([20, 21, 22, 23, 24, 33, 34, 35, 36, 37]);
  });
});
