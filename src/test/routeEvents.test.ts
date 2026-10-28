import { describe, expect, it } from "vitest";
import {
  anchorPhaseWindows,
  detectBreak,
  detectCatch,
  phaseRoles,
  type FrameKps,
  type FrameScores,
  type Pt,
  type RouteEvents,
} from "../../supabase/functions/analyze-athlete-video/segmentation";

const PPY = 100; // px per yard
const straight = (n: number): Pt[] => Array.from({ length: n }, (_, i) => [1000, 2000 - i * 8] as Pt); // 0.08 yd/frame upfield

describe("break detection", () => {
  it("never detects a break on a straight-line run", () => {
    const e = detectBreak(straight(120), PPY, 10);
    expect(e.detected).toBe(false);
  });

  it("detects a 90-degree cut at the frame it happens", () => {
    const hips: Pt[] = straight(60);
    const [x0, y0] = hips[59];
    for (let k = 1; k <= 60; k++) hips.push([x0 + k * 8, y0]);
    const e = detectBreak(hips, PPY, 10);
    expect(e.detected).toBe(true);
    if (e.detected) expect(Math.abs(e.frame - 59)).toBeLessThanOrEqual(3);
  });
});

// 33 keypoints; shoulders at y=500, x 480/520.
function pose(lw: Pt, rw: Pt): number[][] {
  const p = Array.from({ length: 33 }, () => [500, 700]);
  p[11] = [480, 500]; p[12] = [520, 500]; p[15] = lw; p[16] = rw;
  return p;
}
const conf = (): number[] => Array.from({ length: 33 }, () => 0.9);

describe("catch detection", () => {
  it("rejects a mid-stride arm swing on the last frame", () => {
    const kps: FrameKps[] = Array.from({ length: 90 }, (_, i) => [pose([440, 650], [i === 89 ? 560 : 560, i === 89 ? 450 : 600])]);
    const sc: FrameScores[] = kps.map(() => [conf()]);
    expect(detectCatch(kps, sc, 0.5, 0).detected).toBe(false);
  });

  it("detects hands raised together", () => {
    const kps: FrameKps[] = Array.from({ length: 90 }, (_, i) => [i >= 70 && i <= 75 ? pose([495, 460 - (i === 72 ? 20 : 0)], [515, 460 - (i === 72 ? 20 : 0)]) : pose([440, 650], [560, 600])]);
    const sc: FrameScores[] = kps.map(() => [conf()]);
    const e = detectCatch(kps, sc, 0.5, 0);
    expect(e.detected).toBe(true);
    if (e.detected) expect(e.frame).toBe(72);
  });
});

describe("event-anchored phase windows", () => {
  const phases = ["Release", "Stem", "Break", "Catch Window", "YAC (After Catch)"].map((name, i) => ({ id: `p${i}`, name, proportion_weight: 20, frame_buffer: 0 }));
  const split = (count: number, group: Array<{ id: string }>) => {
    const per = Math.floor(count / group.length);
    return Object.fromEntries(group.map((g, i) => [g.id, { start: i * per, end: i === group.length - 1 ? count - 1 : (i + 1) * per - 1 }]));
  };
  const ev = (frame: number, start = frame, end = frame) => ({ detected: true as const, frame, start, end, confidence: 1, detail: {} });

  it("classifies Slant phases", () => {
    expect(phaseRoles(phases).roles).toEqual(["pre_break", "pre_break", "break", "catch", "post_catch"]);
  });

  it("anchors windows to snap, break and catch", () => {
    const events: RouteEvents = { snap: ev(10), break: ev(60, 58, 64), catch: ev(150) };
    const out = anchorPhaseWindows(240, phases, events, split);
    expect(out[0].window?.start).toBe(10);
    expect(out[1].window?.end).toBe(57);
    expect(out[2].window).toEqual({ start: 58, end: 64 });
    expect(out[3].window).toEqual({ start: 140, end: 155 });
    expect(out[4].window).toEqual({ start: 156, end: 239 });
  });

  it("gives no window to phases bounded by an undetected break", () => {
    const events: RouteEvents = { snap: ev(10), break: { detected: false, reason: "no_sustained_heading_change", detail: {} }, catch: ev(150) };
    const out = anchorPhaseWindows(240, phases, events, split);
    expect(out.slice(0, 3).map((p) => p.missing_event)).toEqual(["break", "break", "break"]);
    expect(out.slice(0, 3).every((p) => p.window === null)).toBe(true);
    expect(out[3].window).toEqual({ start: 140, end: 155 });
  });

  it("skips catch phases when the catch is not detected", () => {
    const events: RouteEvents = { snap: ev(10), break: ev(60), catch: { detected: false, reason: "no_hands_together", detail: {} } };
    const out = anchorPhaseWindows(240, phases, events, split);
    expect(out[3].missing_event).toBe("catch");
    expect(out[4].missing_event).toBe("catch");
    expect(out[0].window).not.toBeNull();
  });
});
