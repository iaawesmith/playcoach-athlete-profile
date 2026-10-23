import { describe, expect, it } from "vitest";
import {
  computeHeightCalibration,
  parseResolutionHeight,
  postureFactor,
  sampleFrameHeight,
  windowScale,
  scaleStaticPixelsPerYard,
} from "../../supabase/functions/analyze-athlete-video/calibration";

type P = [number, number];

// Upright athlete whose crown-to-floor height is `h` px, standing at x, top at y0.
function uprightFrame(h: number, x = 500, y0 = 100): P[] {
  const pts: P[] = Array.from({ length: 33 }, () => [0, 0] as P);
  const noseY = y0 + 0.07 * h;
  for (let i = 0; i <= 10; i++) pts[i] = [x, noseY];
  pts[11] = [x - 10, y0 + 0.18 * h];
  pts[12] = [x + 10, y0 + 0.18 * h];
  pts[23] = [x - 8, y0 + 0.5 * h];
  pts[24] = [x + 8, y0 + 0.5 * h];
  pts[25] = [x - 8, y0 + 0.75 * h];
  pts[26] = [x + 8, y0 + 0.75 * h];
  for (const i of [27, 28, 29, 30, 31, 32]) pts[i] = [x + (i % 2 ? -8 : 8), y0 + h];
  return pts;
}
const conf = Array.from({ length: 33 }, () => 0.9);
const HEIGHT_69_IN_YD = 69 / 36;

describe("height-based calibration", () => {
  it("scales the 80 px/yard 1080p fallback to 160 at 4K", () => {
    expect(scaleStaticPixelsPerYard(80, 1080)).toBe(80);
    expect(scaleStaticPixelsPerYard(80, 2160)).toBe(160);
    expect(scaleStaticPixelsPerYard(80, null)).toBe(80);
    expect(scaleStaticPixelsPerYard(null, 2160)).toBeNull();
  });
  it("390 px upright athlete at 69 in gives about 203.5 px/yd", () => {
    const s = sampleFrameHeight(uprightFrame(390), conf, 0, HEIGHT_69_IN_YD);
    expect(s?.upright).toBe(true);
    expect(s?.ppy).toBeCloseTo(203.5, 0);
  });

  it("posture factor is 1 standing and clamps at 0.8 in a deep crouch", () => {
    expect(postureFactor(0, 180)).toBeCloseTo(1, 5);
    expect(postureFactor(60, 60)).toBe(0.8);
  });

  it("per-frame mode follows a 28% shrink without being rejected and flags depth motion", () => {
    const n = 68;
    const frames = Array.from({ length: n }, (_, i) => uprightFrame(430 - (i / (n - 1)) * 0.28 * 430));
    const cal = computeHeightCalibration(frames, frames.map(() => conf), HEIGHT_69_IN_YD);
    expect(cal.perFrame.accepted).toBe(true);
    expect(cal.perFrame.residualSpread).toBeLessThan(1.05);
    const series = cal.perFrame.series as number[];
    expect(series[0]).toBeGreaterThan(215);
    expect(series[n - 1]).toBeLessThan(175);
    expect(cal.depthMotionPresent).toBe(true);
    // The single-value fallback still sees the raw perspective spread.
    expect(cal.single.rawSpread).toBeGreaterThan(1.25);
  });

  it("single-value fallback rejects raw p90/p10 spread above 1.35", () => {
    const frames = Array.from({ length: 40 }, (_, i) => uprightFrame(i < 20 ? 300 : 450));
    const cal = computeHeightCalibration(frames, frames.map(() => conf), HEIGHT_69_IN_YD);
    expect(cal.single.accepted).toBe(false);
    expect(cal.single.reason).toBe("raw_spread_exceeds_limit");
  });

  it("steady athlete is accepted in both modes with no depth motion", () => {
    const frames = Array.from({ length: 40 }, () => uprightFrame(390));
    const cal = computeHeightCalibration(frames, frames.map(() => conf), HEIGHT_69_IN_YD);
    expect(cal.perFrame.accepted).toBe(true);
    expect(cal.single.accepted).toBe(true);
    expect(cal.depthMotionPresent).toBe(false);
  });

  it("rejects per-frame mode when under 60% of frames are usable", () => {
    const empty = Array.from({ length: 33 }, () => 0);
    const frames = Array.from({ length: 10 }, () => uprightFrame(390));
    const scores = frames.map((_, i) => (i < 5 ? conf : empty));
    const cal = computeHeightCalibration(frames, scores, HEIGHT_69_IN_YD);
    expect(cal.perFrame.accepted).toBe(false);
    expect(cal.perFrame.reason).toBe("insufficient_valid_frames");
  });

  it("window scale is the median over the phase window", () => {
    expect(windowScale([200, 210, 220, 230, 240], 1, 3)).toBe(220);
  });

  it("parses clip resolution heights", () => {
    expect(parseResolutionHeight("3840x2160")).toBe(2160);
    expect(parseResolutionHeight("1080p")).toBe(1080);
    expect(parseResolutionHeight(null)).toBeNull();
  });
});
