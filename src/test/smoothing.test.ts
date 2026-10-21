import { describe, expect, it } from "vitest";
import {
  isMissingPoint,
  smoothKeypoints,
  type SKeypoints,
  type SScores,
} from "../../supabase/functions/analyze-athlete-video/smoothing";
import fixture from "./fixtures/run_39702081_hips.json";

// Raw service output for run 39702081 (keypoints 23/24, frames 0-40), as sent to the analyzer.
function buildRun(): { kps: SKeypoints; scores: SScores } {
  const kps: SKeypoints = [];
  const scores: SScores = [];
  for (let i = 0; i < fixture.kp23.length; i += 1) {
    const pts = Array.from({ length: 33 }, () => [0, 0] as [number, number]);
    const sc = Array.from({ length: 33 }, () => 0);
    pts[23] = fixture.kp23[i] as [number, number];
    pts[24] = fixture.kp24[i] as [number, number];
    sc[23] = fixture.s23[i];
    sc[24] = fixture.s24[i];
    kps.push([pts]);
    scores.push([sc]);
  }
  return { kps, scores };
}

const hip = (k: SKeypoints, i: number) => [
  (k[i][0][23][0] + k[i][0][24][0]) / 2,
  (k[i][0][23][1] + k[i][0][24][1]) / 2,
];

const settings = new Map([
  [23, { windowSize: 15, confidenceThreshold: 0.4 }],
  [24, { windowSize: 15, confidenceThreshold: 0.4 }],
]);

describe("temporal smoothing on run 39702081", () => {
  const { kps, scores } = buildRun();
  const out = smoothKeypoints(kps, scores, settings, new Set(fixture.missed));

  it("frame 17 stays missing (no fabricated point)", () => {
    expect(out[17][0][23]).toEqual([0, 0]);
    expect(out[17][0][24]).toEqual([0, 0]);
  });

  it("frames 18, 21 and 29 keep their true coordinates", () => {
    const [x18, y18] = hip(out, 18);
    expect(Math.abs(x18 - 1191)).toBeLessThan(25);
    expect(Math.abs(y18 - 1265)).toBeLessThan(15);
    const [x21, y21] = hip(out, 21);
    expect(Math.abs(x21 - 1152)).toBeLessThan(25);
    expect(Math.abs(y21 - 1277)).toBeLessThan(15);
    const [x29, y29] = hip(out, 29);
    expect(Math.abs(x29 - 1341)).toBeLessThan(60);
    expect(Math.abs(y29 - 1251)).toBeLessThan(15);
  });

  it("the 7-frame gap 22-28 is not filled (longer than 5)", () => {
    for (let i = 22; i <= 28; i += 1) expect(out[i][0][23]).toEqual([0, 0]);
  });
});

describe("isMissingPoint", () => {
  it("treats (0,0), score 0 and excluded frames as missing", () => {
    expect(isMissingPoint([0, 0], 0.9, 1, new Set())).toBe(true);
    expect(isMissingPoint([10, 10], 0, 1, new Set())).toBe(true);
    expect(isMissingPoint([10, 10], 0.9, 1, new Set([1]))).toBe(true);
    expect(isMissingPoint([10, 10], 0.9, 1, new Set())).toBe(false);
  });

  it("short gaps between reliable frames are still interpolated", () => {
    const kps: SKeypoints = [[[[100, 0]]], [[[0, 0]]], [[[300, 0]]]].map((f) => f.map((p) => p.map((q) => [q[0], q[1] || 1] as [number, number])));
    kps[1][0][0] = [0, 0];
    const sc: SScores = [[[0.9]], [[0]], [[0.9]]];
    const r = smoothKeypoints(kps, sc, new Map([[0, { windowSize: 3, confidenceThreshold: 0.4 }]]));
    expect(r[1][0][0][0]).toBeCloseTo(200, 5);
  });
});
