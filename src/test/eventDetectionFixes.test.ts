import { describe, expect, it } from "vitest";
import {
  computeReleaseAnchor,
  detectBreak,
  detectCatch,
  snapEvent,
  type FrameKps,
  type FrameScores,
  type Pt,
} from "../../supabase/functions/analyze-athlete-video/segmentation";

const PPY = 100; // px per yard

describe("snap without a stance", () => {
  it("falls back to the first sustained forward acceleration when the athlete enters late", () => {
    // Off-screen for 8 frames, then speeding up 0.01 yd/frame each frame.
    const hips: Array<Pt | null> = Array.from({ length: 100 }, (_, i) => (i < 8 ? null : [1000 + 100 * 0.005 * (i - 8) ** 2, 1000] as Pt));
    const anchor = computeReleaseAnchor(hips, PPY);
    const snap = snapEvent(anchor);
    expect(snap.detected).toBe(true);
    if (snap.detected) {
      expect(snap.detail.method).toBe("forward_acceleration");
      expect(snap.frame).toBeGreaterThanOrEqual(9);
      expect(snap.frame).toBeLessThanOrEqual(14);
      expect(snap.confidence).toBeLessThan(1);
    }
  });

  it("uses the first tracked frame when the athlete is already running", () => {
    const hips: Array<Pt | null> = Array.from({ length: 100 }, (_, i) => (i < 6 ? null : [1000 + 12 * i, 1000] as Pt)); // 0.12 yd/frame
    const snap = snapEvent(computeReleaseAnchor(hips, PPY));
    expect(snap.detected).toBe(true);
    if (snap.detected) {
      expect(snap.detail.method).toBe("in_motion_at_start");
      expect(snap.frame).toBe(6);
    }
  });

  it("keeps the stance method when a stance is visible", () => {
    const hips: Pt[] = Array.from({ length: 100 }, (_, i) => [i < 20 ? 1000 : 1000 + 8 * (i - 20), 1000] as Pt);
    const snap = snapEvent(computeReleaseAnchor(hips, PPY));
    expect(snap.detected && snap.detail.method).toBe("sustained_hip_movement");
  });
});

/** Upfield for `stem` frames at 0.1 yd/frame, then `turnDeg` off that line. */
function route(stem: number, turnDeg: number, after = 50): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < stem; i++) pts.push([1000, 3000 - i * 10]);
  const [x0, y0] = pts[pts.length - 1];
  const a = (turnDeg * Math.PI) / 180;
  for (let k = 1; k <= after; k++) pts.push([x0 + Math.sin(a) * 10 * k, y0 - Math.cos(a) * 10 * k]);
  return pts;
}

describe("break relative to the clip's own motion", () => {
  it("finds a shallow 3-yard cut", () => {
    const e = detectBreak(route(30, 40), PPY, 0);
    expect(e.detected).toBe(true);
    if (e.detected) expect(Math.abs(e.frame - 29)).toBeLessThanOrEqual(3);
  });

  it("finds a 45-degree post cut at 8 yards", () => {
    const e = detectBreak(route(80, 45), PPY, 0);
    expect(e.detected).toBe(true);
    if (e.detected) expect(Math.abs(e.frame - 79)).toBeLessThanOrEqual(3);
  });

  it("never breaks on a straight run", () => {
    expect(detectBreak(route(130, 0, 0), PPY, 0).detected).toBe(false);
  });
});

// Shoulders centred at (500, 500), hips at (500, 700): torso = 200 px.
function body(lw: Pt, rw: Pt): number[][] {
  const p = Array.from({ length: 33 }, () => [500, 900]);
  p[11] = [495, 500]; p[12] = [505, 500]; p[23] = [495, 700]; p[24] = [505, 700];
  p[15] = lw; p[16] = rw;
  return p;
}
const conf = (): number[] => Array.from({ length: 33 }, () => 0.9);
const swing = (i: number): number[][] => (i % 2 ? body([440, 620], [560, 620]) : body([560, 620], [440, 620]));

describe("catch at chest height", () => {
  it("detects hands converging with a forward reach below the shoulders", () => {
    const kps: FrameKps[] = Array.from({ length: 100 }, (_, i) => [i >= 70 && i <= 75 ? body([580, 560], [i === 73 ? 584 : 600, 560]) : swing(i)]);
    const sc: FrameScores[] = kps.map(() => [conf()]);
    const e = detectCatch(kps, sc, 0.5, 0);
    expect(e.detected).toBe(true);
    if (e.detected) {
      expect(e.detail.method).toBe("hands_converging_forward_reach");
      expect(e.frame).toBe(73);
    }
  });

  it("rejects a running arm swing", () => {
    const kps: FrameKps[] = Array.from({ length: 100 }, (_, i) => [swing(i)]);
    const sc: FrameScores[] = kps.map(() => [conf()]);
    expect(detectCatch(kps, sc, 0.5, 0).detected).toBe(false);
  });
});
