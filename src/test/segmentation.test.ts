import { describe, expect, it } from "vitest";
import {
  computeReleaseAnchor,
  findCatchArrival,
  resolveSideRule,
  sideForRoute,
  type Pt,
} from "../../supabase/functions/analyze-athlete-video/segmentation";

// Hip centre (x, y) and per-frame scale (px/yd) from run 44c52897, frames 0-29.
const RUN = [
  [1007.958, 1249.796, 242.538], [1008.055, 1249.443, 242.729], [1008.641, 1248.602, 243.063],
  [1009.631, 1247.332, 243.634], [1010.9, 1246.148, 244.149], [1011.776, 1245.192, 244.665],
  [1012.783, 1244.513, 245.016], [1013.479, 1244.13, 244.902], [1014.085, 1244.691, 243.868],
  [1014.202, 1247.827, 241.861], [1014.664, 1254.036, 238.824], [1016.033, 1263.637, 234.889],
  [1020.589, 1273.195, 231.199], [1027.108, 1279.35, 228.268], [1037.077, 1281.728, 226.692],
  [1048.353, 1280.722, 226.598], [1061.661, 1279.399, 227.657], [1076.672, 1276.7, 228.813],
  [1092.995, 1274.255, 230.087], [1110.348, 1272.035, 231.2], [1127.985, 1270.612, 231.945],
  [1146.455, 1269.851, 232.465], [1166.147, 1268.641, 232.583], [1189.573, 1267.232, 231.01],
  [1213.658, 1264.695, 227.47], [1241.045, 1261.754, 223.846], [1268.796, 1256.519, 220.222],
  [1296.39, 1251.353, 217.683], [1319.882, 1246.083, 218.177], [1342.587, 1244.376, 220.416],
];
const hips: Pt[] = RUN.map(([x, y]) => [x, y]);
const ppy = RUN.map(([, , s]) => s);

describe("release anchor", () => {
  it("anchors run 44c52897 at frame 10-12", () => {
    const a = computeReleaseAnchor(hips, ppy);
    expect(a.applied).toBe(true);
    expect(a.frame).toBeGreaterThanOrEqual(10);
    expect(a.frame).toBeLessThanOrEqual(12);
  });

  it("never sets the threshold below 0.015 yd per frame", () => {
    const still: Pt[] = Array.from({ length: 30 }, (_, i) => [1000 + (i > 15 ? (i - 15) * 2 : 0), 500]);
    const a = computeReleaseAnchor(still, 200); // 2 px/frame = 0.01 yd < floor
    expect(a.threshold_yd).toBe(0.015);
    expect(a.applied).toBe(false);
  });
});

describe("plant side rule", () => {
  it("right break plants the left (outside) foot via heuristic", () => {
    const r = resolveSideRule({ calculationType: "angle", keypointIndices: [23, 25, 27], phaseName: "Break" });
    expect(r).toEqual({ rule: "outside_foot", source: "heuristic" });
    expect(sideForRoute("right", r.rule)).toBe("left");
    expect(sideForRoute("left", r.rule)).toBe("right");
  });

  it("mapping side_rule wins over the heuristic", () => {
    const r = resolveSideRule({ sideRule: "break_side", calculationType: "angle", keypointIndices: [23, 25, 27], phaseName: "Break" });
    expect(r).toEqual({ rule: "break_side", source: "mapping" });
  });

  it("heuristic does not apply outside the Break phase", () => {
    expect(resolveSideRule({ calculationType: "angle", keypointIndices: [23, 25, 27], phaseName: "Stem" }).source).toBe("default");
  });
});

describe("catch arrival", () => {
  const frame = (lw: [number, number], lc: number, rw: [number, number], rc: number) => {
    const kps = Array.from({ length: 33 }, () => [0, 0]);
    const sc = Array.from({ length: 33 }, () => 0.9);
    kps[15] = lw; sc[15] = lc;
    kps[16] = rw; sc[16] = rc;
    return { kps: [kps], sc: [sc] };
  };

  it("uses the more confident hand's highest point in the last 40%", () => {
    const frames = Array.from({ length: 10 }, (_, i) => frame([100, 50], 0.2, [200, i === 8 ? 300 : 400], 0.9));
    const r = findCatchArrival(frames.map((f) => f.kps), frames.map((f) => f.sc), 0.4);
    expect(r).toMatchObject({ ok: true, frame: 8, hand: "right" });
  });

  it("is unavailable when neither hand meets the threshold", () => {
    const frames = Array.from({ length: 10 }, () => frame([100, 50], 0.2, [200, 300], 0.3));
    const r = findCatchArrival(frames.map((f) => f.kps), frames.map((f) => f.sc), 0.4);
    expect(r).toMatchObject({ ok: false, reason: "catch_frames_unavailable" });
  });
});
