// Pure height-based calibration helpers (no Deno / network APIs) so they can be
// unit-tested from src/test. MediaPipe Pose-33 indices throughout.

export type Pt = [number, number]
export type FrameKeypoints = (Pt | number[] | undefined)[]

const HEAD = [0, 1, 2, 3, 4, 5, 6, 7, 8]
const FEET = [27, 28, 29, 30, 31, 32]
// Nose/eye line sits ~7% of standing height below the crown.
export const HEAD_SPAN_RATIO = 0.93
export const SPREAD_LIMIT = 1.35
export const DEPTH_MOTION_THRESHOLD = 0.15
export const MIN_VALID_FRAME_SHARE = 0.6
export const MIN_UPRIGHT_FRAMES = 8
export const MAX_STEP_CHANGE = 0.03

function ok(p: unknown, s: number | undefined, minConf: number): p is Pt {
  return Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])
    && !(p[0] === 0 && p[1] === 0) && typeof s === 'number' && s >= minConf
}

function angleAt(a: Pt, b: Pt, c: Pt): number | null {
  const v1 = [a[0] - b[0], a[1] - b[1]]
  const v2 = [c[0] - b[0], c[1] - b[1]]
  const m = Math.hypot(v1[0], v1[1]) * Math.hypot(v2[0], v2[1])
  if (m === 0) return null
  const cos = Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / m))
  return (Math.acos(cos) * 180) / Math.PI
}

function mid(a: Pt, b: Pt): Pt {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
}

export function percentile(values: number[], pct: number): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((x, y) => x - y)
  const k = Math.max(0, Math.min(s.length - 1, Math.round(pct * (s.length - 1))))
  return s[k]
}

export type FrameHeightSample = {
  frame: number
  spanPx: number
  postureFactor: number
  torsoTiltDeg: number | null
  kneeAngleDeg: number | null
  upright: boolean
  ppy: number
}

/**
 * Posture factor = apparent standing-height share given torso lean and knee bend.
 * Upper body (~47% of height) shortens with cos(tilt); legs (~53%) with sin(knee/2).
 */
export function postureFactor(torsoTiltDeg: number | null, kneeAngleDeg: number | null): number {
  const tilt = torsoTiltDeg ?? 0
  const knee = kneeAngleDeg ?? 180
  const f = 0.47 * Math.cos((tilt * Math.PI) / 180) + 0.53 * Math.sin(((knee / 2) * Math.PI) / 180)
  return Math.max(0.8, Math.min(1, f))
}

export function sampleFrameHeight(
  kp: FrameKeypoints | undefined,
  sc: (number | undefined)[] | undefined,
  frame: number,
  heightYards: number,
  minConf = 0.5,
): FrameHeightSample | null {
  if (!kp || !sc || heightYards <= 0) return null
  const headYs = HEAD.filter((i) => ok(kp[i], sc[i], minConf)).map((i) => (kp[i] as Pt)[1])
  const footYs = FEET.filter((i) => ok(kp[i], sc[i], minConf)).map((i) => (kp[i] as Pt)[1])
  if (headYs.length === 0 || footYs.length === 0) return null
  const spanPx = Math.max(...footYs) - Math.min(...headYs)
  if (!(spanPx > 0)) return null

  let tilt: number | null = null
  if (ok(kp[11], sc[11], minConf) && ok(kp[12], sc[12], minConf) && ok(kp[23], sc[23], minConf) && ok(kp[24], sc[24], minConf)) {
    const sh = mid(kp[11] as Pt, kp[12] as Pt)
    const hp = mid(kp[23] as Pt, kp[24] as Pt)
    const dx = sh[0] - hp[0]
    const dy = hp[1] - sh[1]
    tilt = (Math.atan2(Math.abs(dx), Math.max(1e-6, dy)) * 180) / Math.PI
  }
  const knees: number[] = []
  for (const [h, k, a] of [[23, 25, 27], [24, 26, 28]]) {
    if (ok(kp[h], sc[h], minConf) && ok(kp[k], sc[k], minConf) && ok(kp[a], sc[a], minConf)) {
      const ang = angleAt(kp[h] as Pt, kp[k] as Pt, kp[a] as Pt)
      if (ang !== null) knees.push(ang)
    }
  }
  const knee = knees.length ? knees.reduce((s, v) => s + v, 0) / knees.length : null
  const factor = postureFactor(tilt, knee)
  const upright = tilt !== null && tilt <= 20 && knee !== null && knee >= 150
  const standingPx = spanPx / HEAD_SPAN_RATIO / factor
  return { frame, spanPx, postureFactor: factor, torsoTiltDeg: tilt, kneeAngleDeg: knee, upright, ppy: standingPx / heightYards }
}

/** Fill gaps by linear interpolation (edges hold nearest value). */
export function interpolate(series: (number | null)[]): number[] | null {
  const idx = series.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0)
  if (idx.length === 0) return null
  return series.map((v, i) => {
    if (v !== null) return v
    const prev = [...idx].reverse().find((j) => j < i)
    const next = idx.find((j) => j > i)
    if (prev === undefined) return series[next as number] as number
    if (next === undefined) return series[prev] as number
    const t = (i - prev) / (next - prev)
    return (series[prev] as number) * (1 - t) + (series[next] as number) * t
  })
}

function windowed(values: number[], radius: number, fn: (w: number[]) => number): number[] {
  return values.map((_, i) => fn(values.slice(Math.max(0, i - radius), Math.min(values.length, i + radius + 1))))
}

/** Centered median(5) → moving average(5) → clamp frame-to-frame change. */
export function smoothScale(values: number[], maxStep = MAX_STEP_CHANGE): number[] {
  const med = windowed(values, 2, (w) => percentile(w, 0.5) as number)
  const avg = windowed(med, 2, (w) => w.reduce((s, v) => s + v, 0) / w.length)
  const out: number[] = []
  for (let i = 0; i < avg.length; i++) {
    if (i === 0) { out.push(avg[0]); continue }
    const prev = out[i - 1]
    out.push(Math.max(prev * (1 - maxStep), Math.min(prev * (1 + maxStep), avg[i])))
  }
  return out
}

export type HeightCalibration = {
  perFrame: {
    accepted: boolean
    reason: string
    series: number[] | null
    validFrames: number
    totalFrames: number
    residualSpread: number | null
    min: number | null
    max: number | null
    changePct: number | null
  }
  single: {
    accepted: boolean
    reason: string
    ppy: number | null
    uprightFrames: number
    p10: number | null
    p50: number | null
    p90: number | null
    rawSpread: number | null
  }
  depthMotionPresent: boolean
}

export function computeHeightCalibration(
  keypoints: (FrameKeypoints | undefined)[],
  scores: ((number | undefined)[] | undefined)[],
  heightYards: number,
): HeightCalibration {
  const total = keypoints.length
  const samples = keypoints.map((kp, i) => sampleFrameHeight(kp, scores[i], i, heightYards))
  const valid = samples.filter((s): s is FrameHeightSample => s !== null)

  // Per-frame mode — spread gate on residuals after removing the smoothed trend.
  let perFrame: HeightCalibration['perFrame']
  const share = total > 0 ? valid.length / total : 0
  const filled = interpolate(samples.map((s) => (s ? s.ppy : null)))
  if (!filled || share < MIN_VALID_FRAME_SHARE) {
    perFrame = { accepted: false, reason: 'insufficient_valid_frames', series: null, validFrames: valid.length, totalFrames: total, residualSpread: null, min: null, max: null, changePct: null }
  } else {
    const series = smoothScale(filled)
    const residuals = valid.map((s) => s.ppy / series[s.frame])
    const p10 = percentile(residuals, 0.1) as number
    const p90 = percentile(residuals, 0.9) as number
    const residualSpread = p10 > 0 ? p90 / p10 : Infinity
    const min = Math.min(...series)
    const max = Math.max(...series)
    const accepted = residualSpread <= SPREAD_LIMIT
    perFrame = {
      accepted,
      reason: accepted ? 'per_frame_height_accepted' : 'residual_spread_exceeds_limit',
      series: series.map((v) => Number(v.toFixed(3))),
      validFrames: valid.length,
      totalFrames: total,
      residualSpread: Number(residualSpread.toFixed(4)),
      min: Number(min.toFixed(3)),
      max: Number(max.toFixed(3)),
      changePct: Number(((max - min) / max).toFixed(4)),
    }
  }

  // Single-value fallback — raw p90/p10 gate across upright frames.
  const upright = valid.filter((s) => s.upright).map((s) => s.ppy)
  const sp10 = percentile(upright, 0.1)
  const sp50 = percentile(upright, 0.5)
  const sp90 = percentile(upright, 0.9)
  const rawSpread = sp10 && sp90 ? sp90 / sp10 : null
  let single: HeightCalibration['single']
  if (upright.length < MIN_UPRIGHT_FRAMES) {
    single = { accepted: false, reason: 'insufficient_upright_frames', ppy: null, uprightFrames: upright.length, p10: sp10, p50: sp50, p90: sp90, rawSpread }
  } else {
    const accepted = rawSpread !== null && rawSpread <= SPREAD_LIMIT
    const ppy = percentile(upright, 0.8)
    single = {
      accepted,
      reason: accepted ? 'single_height_accepted' : 'raw_spread_exceeds_limit',
      ppy: ppy !== null ? Number(ppy.toFixed(3)) : null,
      uprightFrames: upright.length,
      p10: sp10, p50: sp50, p90: sp90,
      rawSpread: rawSpread !== null ? Number(rawSpread.toFixed(4)) : null,
    }
  }

  const depthMotionPresent = perFrame.accepted && (perFrame.changePct ?? 0) > DEPTH_MOTION_THRESHOLD
  return { perFrame, single, depthMotionPresent }
}

/** Scale to apply to a phase window [start, end] from a per-frame series. */
export function windowScale(series: number[], start: number, end: number): number | null {
  const slice = series.slice(Math.max(0, start), Math.min(series.length, end + 1))
  return percentile(slice, 0.5)
}

/** Parse "3840x2160" / "1920×1080" / "4K" style strings to a frame height. */
export function parseResolutionHeight(resolution: unknown): number | null {
  if (typeof resolution !== 'string') return null
  const m = resolution.match(/(\d{3,5})\s*[x×]\s*(\d{3,5})/i)
  if (m) return Math.min(Number(m[1]), Number(m[2]))
  const p = resolution.match(/(\d{3,4})p/i)
  if (p) return Number(p[1])
  if (/4k/i.test(resolution)) return 2160
  return null
}

export const STATIC_ASSUMED_HEIGHT_PX = 1080
