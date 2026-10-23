// Pure helpers for the admin pose overlay player. Read-only views of a stored
// run: no I/O, no writes, so everything here is unit-tested from src/test.
import { smoothKeypoints, type KeypointSmoothingSetting } from "../../../../supabase/functions/analyze-athlete-video/smoothing";
import type { KeyMetric } from "../types";

export type Pt = [number, number];
export type ConfidenceLevel = "reliable" | "marginal" | "unreliable";
export type FrameSourceKind = "main" | "leading_recovery" | "following_crop" | "missed" | "rejected";

/** Per-landmark thresholds: at or above 0.7 is reliable (the analyzer's per-keypoint bar), 0.4–0.7 marginal. */
export const RELIABLE_MIN = 0.7;
export const MARGINAL_MIN = 0.4;
export const SMOOTHING_WINDOW_FRAMES = 3;
export const FOLLOW_SMOOTH_FRAMES = 9;
export const FOLLOW_WIDTH_FRACTION = 1 / 3;

/** Standard MediaPipe Pose (33 landmarks) connections. */
export const POSE_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8], [9, 10],
  [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
  [11, 23], [12, 24], [23, 24], [23, 25], [24, 26], [25, 27], [26, 28],
  [27, 29], [28, 30], [29, 31], [30, 32], [27, 31], [28, 32],
];

export interface PhaseWindowLite { phase: string; start: number; end: number }
export interface PerFrameLite { frame: number; hip: Pt | null; scalePpy: number | null; athleteHeightPx: number | null; detected: boolean }
export interface OverlayMetric {
  name: string;
  value: number | null;
  unit: string;
  status: string;
  calculationType: string | null;
  indices: number[];
  frames: number[];
}
export interface Rect { x: number; y: number; w: number; h: number }

export interface OverlayData {
  fps: number;
  width: number;
  height: number;
  frameCount: number;
  keypoints: Array<Pt[] | null>;
  scores: Array<number[] | null> | null;
  /** Run-level status per landmark, used only when per-frame scores are absent. */
  landmarkStatus: Map<number, ConfidenceLevel>;
  confidenceSource: "per_frame" | "run_level";
  perFrame: PerFrameLite[];
  phaseWindows: PhaseWindowLite[];
  releaseAnchorFrame: number | null;
  catchAnchorFrame: number | null;
  zoomFactor: number | null;
  zoomCrop: Rect | null;
  missed: Set<number>;
  rejected: Map<number, string>;
  leadingRecovery: Set<number>;
  followingCrop: Set<number>;
  metrics: OverlayMetric[];
}

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const nums = (v: unknown): number[] => arr(v).map(num).filter((n): n is number => n !== null);

export function confidenceLevel(score: number): ConfidenceLevel {
  if (score >= RELIABLE_MIN) return "reliable";
  if (score >= MARGINAL_MIN) return "marginal";
  return "unreliable";
}

const RANK: Record<ConfidenceLevel, number> = { reliable: 2, marginal: 1, unreliable: 0 };
export const weakerLevel = (a: ConfidenceLevel, b: ConfidenceLevel): ConfidenceLevel => (RANK[a] <= RANK[b] ? a : b);

/** Map a native-pixel point into a display canvas showing `view` (native rect). */
export function toDisplay(pt: Pt, view: Rect, displayW: number, displayH: number): Pt {
  return [((pt[0] - view.x) / view.w) * displayW, ((pt[1] - view.y) / view.h) * displayH];
}

export function frameSource(frame: number, d: Pick<OverlayData, "missed" | "rejected" | "leadingRecovery" | "followingCrop">): FrameSourceKind {
  if (d.rejected.has(frame)) return "rejected";
  if (d.missed.has(frame)) return "missed";
  if (d.leadingRecovery.has(frame)) return "leading_recovery";
  if (d.followingCrop.has(frame)) return "following_crop";
  return "main";
}

export type FrameSourceSeam = { frame: number; from: FrameSourceKind; to: FrameSourceKind };

/**
 * Frames where the detection source changes (leading recovery → main,
 * main → following crop, …). Missed and rejected frames carry no source, so
 * they're skipped and the seam lands on the next frame with a real source.
 */
export function frameSourceSeams(
  frameCount: number,
  d: Pick<OverlayData, "missed" | "rejected" | "leadingRecovery" | "followingCrop">,
): FrameSourceSeam[] {
  const seams: FrameSourceSeam[] = [];
  let prev: FrameSourceKind | null = null;
  for (let f = 0; f < frameCount; f++) {
    const kind = frameSource(f, d);
    if (kind === "missed" || kind === "rejected") continue;
    if (prev !== null && kind !== prev) seams.push({ frame: f, from: prev, to: kind });
    prev = kind;
  }
  return seams;
}

export const SOURCE_SHORT: Record<FrameSourceKind, string> = {
  main: "main",
  leading_recovery: "leading recovery",
  following_crop: "following crop",
  missed: "missed",
  rejected: "rejected",
};

export function frameSourceLabel(frame: number, d: OverlayData): string {
  const kind = frameSource(frame, d);
  if (kind === "main") return d.zoomFactor && d.zoomFactor > 1 ? `main pass (${d.zoomFactor}x zoom)` : "main pass";
  if (kind === "leading_recovery") return "leading recovery";
  if (kind === "following_crop") return "following crop";
  if (kind === "missed") return "missed";
  const reason = d.rejected.get(frame);
  return reason ? `rejected (${reason})` : "rejected";
}

export function activePhases(frame: number, windows: PhaseWindowLite[]): string[] {
  return windows.filter((w) => frame >= w.start && frame <= w.end).map((w) => w.phase);
}

export function phaseLabel(frame: number, windows: PhaseWindowLite[]): string {
  const active = activePhases(frame, windows);
  if (active.length > 0) return active.join(" + ");
  const first = windows.reduce((m, w) => Math.min(m, w.start), Number.POSITIVE_INFINITY);
  if (frame < first) return "pre-release (stance)";
  return "none";
}

const range = (a: number, b: number): number[] => {
  const out: number[] = [];
  for (let i = a; i <= b; i += 1) out.push(i);
  return out;
};

/**
 * Absolute clip frames a metric used, from its stored detail.
 * Catch-anchored and speed-retention details already hold clip frames;
 * other detail frame indices are relative to the metric's phase window.
 */
export function resolveMetricFrames(detail: Record<string, unknown>, window: PhaseWindowLite | null): number[] {
  const method = typeof detail.method === "string" ? detail.method : "";
  if (method === "speed_retention") {
    const out = new Set<number>();
    for (const key of ["end_window", "peak_window"]) {
      const w = rec(detail[key]);
      const s = num(w.start);
      const e = num(w.end);
      if (s !== null && e !== null) range(s, e).forEach((f) => out.add(f));
    }
    return [...out].sort((a, b) => a - b);
  }
  const used = nums(detail.framesUsed);
  if (method === "catch_anchored") return used;
  const offset = window?.start ?? 0;
  if (Array.isArray(detail.framesUsed)) return used.map((f) => f + offset);
  const first = num(detail.firstFrameIndex);
  const last = num(detail.lastFrameIndex);
  if (first !== null && last !== null) return range(first + offset, last + offset);
  return window ? range(window.start, window.end) : [];
}

/** Clip frame shown at a decoded media time, measured from the clip's first-frame timestamp. */
export function frameFromMediaTime(mediaTime: number, firstFrameTime: number, fps: number, startSeconds: number, frameCount: number): number {
  const f = Math.floor((mediaTime - firstFrameTime - startSeconds) * fps + 1e-3);
  return Math.max(0, Math.min(frameCount - 1, f));
}

/** Seek target for a clip frame: mid-frame, offset from the first-frame timestamp. */
export function mediaTimeForFrame(frame: number, firstFrameTime: number, fps: number, startSeconds: number): number {
  return firstFrameTime + startSeconds + (frame + 0.5) / fps;
}

export function jointAngle(a: Pt, b: Pt, c: Pt): number {
  const v1 = [a[0] - b[0], a[1] - b[1]];
  const v2 = [c[0] - b[0], c[1] - b[1]];
  const dot = v1[0] * v2[0] + v1[1] * v2[1];
  const m = Math.hypot(v1[0], v1[1]) * Math.hypot(v2[0], v2[1]);
  if (m === 0) return 0;
  return (Math.acos(Math.max(-1, Math.min(1, dot / m))) * 180) / Math.PI;
}

/** Centered moving average of the stored hip path, skipping frames without one. */
export function smoothedHipPath(perFrame: PerFrameLite[], windowFrames = FOLLOW_SMOOTH_FRAMES): Array<Pt | null> {
  const half = Math.floor(windowFrames / 2);
  return perFrame.map((_, i) => {
    let sx = 0, sy = 0, n = 0;
    for (let j = i - half; j <= i + half; j += 1) {
      const h = perFrame[j]?.hip;
      if (h) { sx += h[0]; sy += h[1]; n += 1; }
    }
    return n > 0 ? [sx / n, sy / n] : null;
  });
}

/** Follow window: one third of the frame width, frame aspect, centered on the hip, clamped inside the frame. */
export function followWindow(center: Pt, width: number, height: number, fraction = FOLLOW_WIDTH_FRACTION): Rect {
  const w = width * fraction;
  const h = w * (height / width);
  const x = Math.max(0, Math.min(width - w, center[0] - w / 2));
  const y = Math.max(0, Math.min(height - h, center[1] - h / 2));
  return { x, y, w, h };
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const toPt = (v: unknown): Pt | null => {
  const a = arr(v);
  const x = num(a[0]);
  const y = num(a[1]);
  return x !== null && y !== null ? [x, y] : null;
};

/** Builds the overlay view model from a stored result row. Returns null when there are no stored keypoints. */
export function parseOverlayData(resultRow: Record<string, unknown> | null, nodeMetrics: KeyMetric[]): OverlayData | null {
  const resultData = rec(resultRow?.result_data);
  const diag = rec(resultData.diagnostics);
  const rawFrames = arr(diag.raw_keypoints);
  if (rawFrames.length === 0) return null;
  const service = rec(diag.service);
  const logData = rec(resultData.log_data);
  const poseLog = rec(logData.rtmlib);
  const keypoints: Array<Pt[] | null> = rawFrames.map((f) => {
    const person = arr(arr(f)[0]);
    if (person.length === 0) return null;
    return person.map((p) => toPt(p) ?? [0, 0]);
  });
  if (keypoints.every((k) => k === null)) return null;
  const rawScores = arr(diag.raw_scores);
  const scores = rawScores.length === rawFrames.length
    ? rawScores.map((f) => { const p = arr(f)[0]; return Array.isArray(p) ? nums(p) : null; })
    : null;

  const landmarkStatus = new Map<number, ConfidenceLevel>();
  for (const e of arr(poseLog.keypoint_confidence)) {
    const r = rec(e);
    const idx = num(r.index);
    if (idx === null) continue;
    landmarkStatus.set(idx, r.status === "RELIABLE" ? "reliable" : r.status === "MARGINAL" ? "marginal" : "unreliable");
  }

  const perFrame: PerFrameLite[] = arr(diag.per_frame).map((e) => {
    const r = rec(e);
    const x = num(r.hip_center_x);
    const y = num(r.hip_center_y);
    return {
      frame: num(r.frame) ?? 0,
      hip: x !== null && y !== null ? [x, y] : null,
      scalePpy: num(r.scale_ppy),
      athleteHeightPx: num(r.athlete_height_px),
      detected: r.detected === true,
    };
  });

  const phaseWindows: PhaseWindowLite[] = arr(poseLog.phase_windows).map((e) => {
    const r = rec(e);
    return { phase: String(r.phase ?? ""), start: num(r.start) ?? 0, end: num(r.end) ?? 0 };
  });

  const autoZoom = rec(service.auto_zoom);
  const crop = rec(autoZoom.crop_rect ?? resultData.auto_zoom_crop_rect);
  const cx = num(crop.x), cy = num(crop.y), cw = num(crop.w), ch = num(crop.h);
  const zoomCrop = autoZoom.applied !== false && cx !== null && cy !== null && cw !== null && ch !== null ? { x: cx, y: cy, w: cw, h: ch } : null;

  const release = rec(poseLog.release_anchor);
  const rejectedReasons = rec(service.rejected_frame_reasons);
  const rejected = new Map<number, string>();
  for (const f of nums(service.rejected_frame_indices)) {
    const reason = rejectedReasons[String(f)];
    rejected.set(f, typeof reason === "string" ? reason : "");
  }

  const logMetrics = arr(logData.metrics).map(rec);
  let catchAnchorFrame: number | null = null;
  const metrics: OverlayMetric[] = arr(diag.metrics).map((e) => {
    const m = rec(e);
    const name = String(m.name ?? "");
    const detail = rec(m.detail);
    const node = nodeMetrics.find((k) => k.name === name);
    const logEntry = logMetrics.find((l) => l.name === name);
    const phaseName = typeof logEntry?.phase === "string" ? logEntry.phase : null;
    const window = phaseWindows.find((w) => w.phase === phaseName) ?? null;
    const ca = rec(detail.catchAnchor);
    const caFrame = num(ca.frame);
    if (caFrame !== null && ca.ok !== false && catchAnchorFrame === null) catchAnchorFrame = caFrame;
    const indices = nums(detail.indices).length > 0 ? nums(detail.indices) : node?.keypoint_mapping?.keypoint_indices ?? [];
    return {
      name,
      value: num(m.value),
      unit: String(m.unit ?? node?.unit ?? ""),
      status: String(m.status ?? ""),
      calculationType: (typeof m.calculation_type === "string" ? m.calculation_type : null) ?? node?.keypoint_mapping?.calculation_type ?? null,
      indices,
      frames: m.status === "scored" || m.status === "flagged" || m.value !== null ? resolveMetricFrames(detail, window) : [],
    };
  });

  const width = num(service.frame_width) ?? 1920;
  const height = num(service.frame_height) ?? 1080;
  return {
    fps: num(service.fps) ?? 30,
    width,
    height,
    frameCount: num(service.frame_count) ?? rawFrames.length,
    keypoints,
    scores,
    landmarkStatus,
    confidenceSource: scores ? "per_frame" : "run_level",
    perFrame,
    phaseWindows,
    releaseAnchorFrame: release.applied === true ? num(release.frame) : null,
    catchAnchorFrame,
    zoomFactor: num(autoZoom.factor),
    zoomCrop,
    missed: new Set(nums(service.missed_frame_indices)),
    rejected,
    leadingRecovery: new Set(nums(service.recovered_frame_indices)),
    followingCrop: new Set(nums(service.zoom_fallback_frame_indices)),
    metrics,
  };
}

/** Smoothed keypoints exactly as the analyzer smoothed them (metric keypoints, 3-frame window, missed/rejected excluded). */
export function smoothOverlayKeypoints(d: OverlayData, nodeMetrics: KeyMetric[]): Array<Pt[] | null> {
  const settings = new Map<number, KeypointSmoothingSetting>();
  for (const m of nodeMetrics) {
    if (m.active === false || !m.keypoint_mapping) continue;
    const t = m.keypoint_mapping.confidence_threshold;
    const threshold = typeof t === "number" && Number.isFinite(t) ? Math.max(0, Math.min(1, t)) : 0.7;
    for (const k of m.keypoint_mapping.keypoint_indices ?? []) {
      const prev = settings.get(k);
      settings.set(k, { windowSize: SMOOTHING_WINDOW_FRAMES, confidenceThreshold: prev ? Math.max(prev.confidenceThreshold, threshold) : threshold });
    }
  }
  const kp = d.keypoints.map((f) => (f ? [f] : []));
  const sc = d.keypoints.map((f, i) => (f ? [d.scores?.[i] ?? f.map(() => 1)] : []));
  const excluded = new Set<number>([...d.missed, ...d.rejected.keys()]);
  const out = smoothKeypoints(kp, sc, settings, excluded);
  return out.map((f) => (f[0] ? (f[0] as Pt[]) : null));
}
