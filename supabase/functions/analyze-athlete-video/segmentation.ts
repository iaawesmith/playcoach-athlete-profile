// Pure analyzer helpers for movement-anchored phases, catch anchoring and
// plant-side selection. No I/O so they can be unit-tested from src/test.

export type Pt = [number, number]
/** One frame: persons → 33 keypoints. */
export type FrameKps = Array<number[][] | undefined>
/** One frame: persons → 33 scores. */
export type FrameScores = Array<number[] | undefined>

const HIP_L = 23
const HIP_R = 24
const MIN_HIP_CONF = 0.5

// ---------------------------------------------------------------------------
// Release anchor (first sustained hip movement)
// ---------------------------------------------------------------------------

export const RELEASE_STANCE_FRAMES = 10
export const RELEASE_JITTER_MULTIPLE = 3
export const RELEASE_RUN_LENGTH = 3
export const RELEASE_FLOOR_YD_PER_FRAME = 0.015
export const RELEASE_MAX_ANCHOR_FRACTION = 0.4

export type ReleaseAnchor = {
  frame: number
  applied: boolean
  reason: string
  stance_jitter_yd: number | null
  threshold_yd: number | null
  units: 'yards' | 'pixels'
}

/** Hip centre per frame from person-0 keypoints; null when hips are missing or low confidence. */
export function hipSeries(keypoints: FrameKps[], scores: FrameScores[]): Array<Pt | null> {
  return keypoints.map((frame, i) => {
    const person = frame?.[0]
    const s = scores[i]?.[0]
    const l = person?.[HIP_L]
    const r = person?.[HIP_R]
    if (!l || !r) return null
    if (s && ((s[HIP_L] ?? 0) < MIN_HIP_CONF || (s[HIP_R] ?? 0) < MIN_HIP_CONF)) return null
    if ((l[0] === 0 && l[1] === 0) || (r[0] === 0 && r[1] === 0)) return null
    return [(l[0] + r[0]) / 2, (l[1] + r[1]) / 2]
  })
}

/**
 * Anchor = first frame where hip movement is >= 3x the stance jitter (mean
 * frame-to-frame movement over the first frames) for 3 frames in a row, with a
 * floor of 0.015 yd/frame when a scale is available.
 */
export function computeReleaseAnchor(
  hips: Array<Pt | null>,
  ppy: Array<number | null> | number | null,
): ReleaseAnchor {
  const scaleAt = (i: number): number | null => {
    const v = Array.isArray(ppy) ? ppy[i] : ppy
    return typeof v === 'number' && v > 0 ? v : null
  }
  const hasScale = hips.some((_, i) => scaleAt(i) !== null)
  const units: 'yards' | 'pixels' = hasScale ? 'yards' : 'pixels'
  const moves: Array<number | null> = hips.map((h, i) => {
    if (i === 0) return null
    const p = hips[i - 1]
    if (!h || !p) return null
    const d = Math.hypot(h[0] - p[0], h[1] - p[1])
    if (!hasScale) return d
    const s = scaleAt(i)
    return s ? d / s : null
  })
  const stance = moves.slice(1, RELEASE_STANCE_FRAMES + 1).filter((m): m is number => m !== null)
  const none = (reason: string, jitter: number | null = null, threshold: number | null = null): ReleaseAnchor =>
    ({ frame: 0, applied: false, reason, stance_jitter_yd: jitter, threshold_yd: threshold, units })
  if (stance.length < 3) return accelerationAnchor(moves, hips.length, units) ?? none('insufficient_stance_frames')
  const jitter = stance.reduce((a, b) => a + b, 0) / stance.length
  const threshold = Math.max(RELEASE_JITTER_MULTIPLE * jitter, hasScale ? RELEASE_FLOOR_YD_PER_FRAME : 0)
  const maxFrame = Math.floor(hips.length * RELEASE_MAX_ANCHOR_FRACTION)
  for (let i = 1; i + RELEASE_RUN_LENGTH - 1 < moves.length; i++) {
    let ok = true
    for (let k = 0; k < RELEASE_RUN_LENGTH; k++) {
      const m = moves[i + k]
      if (m === null || m < threshold) { ok = false; break }
    }
    if (!ok) continue
    if (i > maxFrame) return none('anchor_beyond_max_fraction', jitter, threshold)
    return { frame: i, applied: i > 0, reason: 'sustained_hip_movement', stance_jitter_yd: jitter, threshold_yd: threshold, units }
  }
  return accelerationAnchor(moves, hips.length, units) ?? none('no_sustained_movement', jitter, threshold)
}

/** Snap fallback thresholds, yd per frame (30 fps: 0.033 = 1 yd/s). */
export const SNAP_ACCEL_RISE_YD_PER_FRAME = 0.02
export const SNAP_ACCEL_MIN_YD_PER_FRAME = 0.033
export const SNAP_IN_MOTION_YD_PER_FRAME = 0.067
/** Fallback snaps are less certain than a measured stance. */
export const SNAP_ACCEL_CONFIDENCE = 0.7
export const SNAP_IN_MOTION_CONFIDENCE = 0.5

/**
 * Snap without a usable stance (athlete off-screen or already moving at the
 * start): first frame from which the 3-frame mean hip speed rises by at least
 * SNAP_ACCEL_RISE over the next RELEASE_RUN_LENGTH frames and reaches
 * SNAP_ACCEL_MIN. If the athlete is already at SNAP_IN_MOTION speed when first
 * tracked, snap is that first tracked frame. Calibrated (yard) units only.
 */
function accelerationAnchor(moves: Array<number | null>, n: number, units: 'yards' | 'pixels'): ReleaseAnchor | null {
  if (units !== 'yards') return null
  const v: Array<number | null> = moves.map((_, i) => {
    const w = [moves[i - 1], moves[i], moves[i + 1]]
    return w.every((x) => typeof x === 'number') ? (w as number[]).reduce((a, b) => a + b, 0) / 3 : null
  })
  const maxFrame = Math.floor(n * RELEASE_MAX_ANCHOR_FRACTION)
  const first = v.findIndex((x) => x !== null)
  if (first < 0 || first > maxFrame) return null
  const base = { applied: true, stance_jitter_yd: null, units } as const
  // First tracked frame index = the move into it, so the athlete is visible from first - 1.
  if ((v[first] as number) >= SNAP_IN_MOTION_YD_PER_FRAME) {
    return { ...base, frame: Math.max(0, first - 1), reason: 'in_motion_at_start', threshold_yd: SNAP_IN_MOTION_YD_PER_FRAME }
  }
  for (let i = first; i + RELEASE_RUN_LENGTH < v.length && i <= maxFrame; i++) {
    let ok = true
    for (let k = 0; k <= RELEASE_RUN_LENGTH; k++) if (v[i + k] === null || (k > 0 && (v[i + k] as number) < (v[i + k - 1] as number))) { ok = false; break }
    if (!ok) continue
    const end = v[i + RELEASE_RUN_LENGTH] as number
    if (end - (v[i] as number) >= SNAP_ACCEL_RISE_YD_PER_FRAME && end >= SNAP_ACCEL_MIN_YD_PER_FRAME) {
      return { ...base, frame: i, reason: 'forward_acceleration', threshold_yd: SNAP_ACCEL_MIN_YD_PER_FRAME }
    }
  }
  return null
}


/** Shift windows computed over the remaining frames so the first phase starts at the anchor. */
export function offsetWindows<T extends { start: number; end: number }>(
  windows: Record<string, T>,
  anchor: number,
): Record<string, T> {
  const out: Record<string, T> = {}
  for (const [id, w] of Object.entries(windows)) out[id] = { ...w, start: w.start + anchor, end: w.end + anchor }
  return out
}

// ---------------------------------------------------------------------------
// Catch anchor (ball arrival)
// ---------------------------------------------------------------------------

export const CATCH_SEARCH_FRACTION = 0.4
const WRIST_L = 15
const WRIST_R = 16

export type CatchArrival =
  | { ok: true; frame: number; hand: 'left' | 'right'; hand_mean_confidence: number; search_start: number }
  | { ok: false; reason: 'catch_frames_unavailable'; left_mean_confidence: number | null; right_mean_confidence: number | null; search_start: number }

/**
 * Ball arrival = highest point (smallest y) of whichever hand has the higher
 * mean confidence in the last 40% of the clip. Unavailable when neither hand
 * meets the threshold there.
 */
export function findCatchArrival(keypoints: FrameKps[], scores: FrameScores[], threshold: number): CatchArrival {
  const n = keypoints.length
  const start = Math.max(0, Math.floor(n * (1 - CATCH_SEARCH_FRACTION)))
  const meanConf = (idx: number): number | null => {
    const vals: number[] = []
    for (let f = start; f < n; f++) {
      const v = (scores[f]?.[0])?.[idx]
      vals.push(typeof v === 'number' ? v : 0)
    }
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }
  const lc = meanConf(WRIST_L)
  const rc = meanConf(WRIST_R)
  const fail: CatchArrival = { ok: false, reason: 'catch_frames_unavailable', left_mean_confidence: lc, right_mean_confidence: rc, search_start: start }
  const best = (rc ?? -1) > (lc ?? -1) ? { hand: 'right' as const, idx: WRIST_R, conf: rc } : { hand: 'left' as const, idx: WRIST_L, conf: lc }
  if (best.conf === null || best.conf < threshold) return fail
  let bestFrame = -1
  let bestY = Infinity
  for (let f = start; f < n; f++) {
    const p = (keypoints[f]?.[0])?.[best.idx]
    const s = (scores[f]?.[0])?.[best.idx] ?? 0
    if (!p || s < threshold || (p[0] === 0 && p[1] === 0)) continue
    if (p[1] < bestY) { bestY = p[1]; bestFrame = f }
  }
  if (bestFrame < 0) return fail
  return { ok: true, frame: bestFrame, hand: best.hand, hand_mean_confidence: best.conf, search_start: start }
}

// ---------------------------------------------------------------------------
// Plant side rule
// ---------------------------------------------------------------------------

export type SideRule = 'outside_foot' | 'break_side'
export type SideRuleSource = 'mapping' | 'heuristic' | 'default'

const LEG_TRIPLETS = [[23, 25, 27], [24, 26, 28]]

/**
 * Which rule decides the side for a route-direction metric. Honors an explicit
 * keypoint_mapping.side_rule; otherwise falls back to outside_foot only for
 * hip-knee-ankle angle metrics in the Break phase.
 */
export function resolveSideRule(input: {
  sideRule?: unknown
  calculationType?: unknown
  keypointIndices?: number[] | null
  phaseName?: string | null
}): { rule: SideRule; source: SideRuleSource } {
  if (input.sideRule === 'outside_foot' || input.sideRule === 'break_side') {
    return { rule: input.sideRule, source: 'mapping' }
  }
  const idx = input.keypointIndices ?? []
  const isLegTriplet = idx.length === 3 && LEG_TRIPLETS.some((t) => t.every((v, i) => idx[i] === v))
  const isBreak = typeof input.phaseName === 'string' && /\bbreak\b/i.test(input.phaseName)
  if (input.calculationType === 'angle' && isLegTriplet && isBreak) {
    return { rule: 'outside_foot', source: 'heuristic' }
  }
  return { rule: 'break_side', source: 'default' }
}

export function sideForRoute(route: 'left' | 'right', rule: SideRule): 'left' | 'right' {
  if (rule === 'break_side') return route
  return route === 'left' ? 'right' : 'left'
}

// ---------------------------------------------------------------------------
// Detected route events (snap, break, catch) and event-anchored phase windows
// ---------------------------------------------------------------------------

export const BREAK_SPAN_FRAMES = 8
export const BREAK_MIN_TURN_DEG = 30
export const BREAK_RUN_FRAMES = 3
export const BREAK_MIN_PEAK_DEG = 60
export const BREAK_MIN_MOVE_YD = 0.75
export const BREAK_MIN_MOVE_PX = 40
export const BREAK_MIN_COVERAGE = 0.8
/** Assumed horizontal field of view for depth-from-scale (typical phone main camera, ~70 degrees). */
export const BREAK_ASSUMED_FOCAL_FRACTION = 0.714
/** Clip-relative fallback: run and peak must exceed these multiples of the clip's median turn, with absolute floors. */
export const BREAK_REL_RUN_MULTIPLE = 2
export const BREAK_REL_PEAK_MULTIPLE = 3
export const BREAK_REL_MIN_TURN_DEG = 15
export const BREAK_REL_MIN_PEAK_DEG = 30
export const BREAK_REL_CONFIDENCE_FACTOR = 0.8
/** Scale series whose max/min stays under this ratio is treated as flat (no depth signal). */
export const FLAT_SCALE_RATIO = 1.03
/** Body-size depth proxy: rolling median window and assumed shoulder-to-ankle length in yards. */
export const BODY_SCALE_WINDOW = 15
export const BODY_SHOULDER_ANKLE_YD = 1.5

function isFlatSeries(series: Array<number | null>): boolean {
  const v = series.filter((x): x is number => typeof x === 'number' && x > 0)
  if (v.length < 2) return true
  return Math.max(...v) / Math.min(...v) < FLAT_SCALE_RATIO
}

/**
 * Per-frame depth proxy (px per yd) from the athlete's own shoulder-to-ankle
 * length, rolling-median smoothed. Used only for break direction when the
 * calibration scale is flat; never for any measured distance.
 */
export function bodyScaleSeries(keypoints: FrameKps[], scores: FrameScores[], threshold = MIN_HIP_CONF): Array<number | null> {
  const ids = [11, 12, 27, 28]
  const raw = keypoints.map((frame, i) => {
    const p = frame?.[0], sc = scores[i]?.[0]
    if (!p || !sc || ids.some((id) => !p[id] || (sc[id] ?? 0) < threshold || (p[id][0] === 0 && p[id][1] === 0))) return null
    const sx = (p[11][0] + p[12][0]) / 2, sy = (p[11][1] + p[12][1]) / 2
    const ax = (p[27][0] + p[28][0]) / 2, ay = (p[27][1] + p[28][1]) / 2
    return Math.hypot(sx - ax, sy - ay) / BODY_SHOULDER_ANKLE_YD
  })
  const h = Math.floor(BODY_SCALE_WINDOW / 2)
  return raw.map((v, i) => {
    if (v === null) return null
    const w = raw.slice(Math.max(0, i - h), i + h + 1).filter((x): x is number => x !== null).sort((a, b) => a - b)
    return w.length >= 5 ? w[Math.floor(w.length / 2)] : null
  })
}
export const CATCH_RUN_FRAMES = 2
export const CATCH_MAX_HAND_GAP_SHOULDERS = 1.5
export const CATCH_LEAD_FRAMES = 10
export const CATCH_TAIL_FRAMES = 5

const SHOULDER_L = 11
const SHOULDER_R = 12

export type RouteEvent =
  | { detected: true; frame: number; start: number; end: number; confidence: number; detail: Record<string, unknown> }
  | { detected: false; reason: string; detail: Record<string, unknown> }

export type RouteEventName = 'snap' | 'break' | 'catch'

export type RouteEvents = {
  snap: RouteEvent
  break: RouteEvent | null // null = this route has no break phase
  catch: RouteEvent | null // null = clip has no catch (catch_included false)
}

/** Centered moving average over valid points only; gaps stay null. */
function smoothHips(hips: Array<Pt | null>, w = 5): Array<Pt | null> {
  const h = Math.floor(w / 2)
  return hips.map((p, i) => {
    if (!p) return null
    let sx = 0, sy = 0, n = 0
    for (let k = i - h; k <= i + h; k++) {
      const q = hips[k]
      if (q) { sx += q[0]; sy += q[1]; n++ }
    }
    return [sx / n, sy / n]
  })
}

export function snapEvent(anchor: ReleaseAnchor): RouteEvent {
  const confidence = anchor.reason === 'forward_acceleration' ? SNAP_ACCEL_CONFIDENCE
    : anchor.reason === 'in_motion_at_start' ? SNAP_IN_MOTION_CONFIDENCE : 1
  return anchor.applied
    ? { detected: true, frame: anchor.frame, start: anchor.frame, end: anchor.frame, confidence, detail: { method: anchor.reason, threshold: anchor.threshold_yd, units: anchor.units } }
    : { detected: false, reason: anchor.reason, detail: { threshold: anchor.threshold_yd, units: anchor.units } }
}

/**
 * Break = the sharpest sustained change of direction on the ground plane after
 * the snap. Ground position per frame: lateral x = (hip_x - centre) / scale and
 * depth z = focal / scale, using the per-frame height scale (px/yd), so cuts
 * toward or away from the camera count as well as lateral cuts. Turn at frame
 * i = angle between the BREAK_SPAN_FRAMES displacement before and after it,
 * counted only while the athlete moves >= BREAK_MIN_MOVE_YD each side. Runs of
 * >= BREAK_RUN_FRAMES frames at >= BREAK_MIN_TURN_DEG are candidates; the run
 * with the highest peak wins and must reach BREAK_MIN_PEAK_DEG. A straight
 * run never qualifies. Without a per-frame scale, image coordinates are used.
 */
export function detectBreak(
  hips: Array<Pt | null>,
  ppy: Array<number | null> | number | null,
  searchFrom: number,
  frame: { width: number; height: number } | null = null,
  searchTo: number | null = null,
  bodyScale: Array<number | null> | null = null,
): RouteEvent {
  const n = hips.length
  const K = BREAK_SPAN_FRAMES
  const calibrated = Array.isArray(ppy) && frame && frame.width > 0 ? ppy : null
  // A flat scale series (static fallback) carries no depth: use the athlete's own body size instead.
  const useBody = !!calibrated && isFlatSeries(calibrated) && !!bodyScale && bodyScale.some((v) => typeof v === 'number' && v > 0)
  const perFrame = useBody ? bodyScale : calibrated
  const focal = frame ? BREAK_ASSUMED_FOCAL_FRACTION * Math.max(frame.width, frame.height) : 0
  const s = smoothHips(hips)
  const g: Array<Pt | null> = s.map((p, i) => {
    if (!p) return null
    if (!perFrame) return p
    const sc = perFrame[i]
    return typeof sc === 'number' && sc > 0 ? [(p[0] - frame!.width / 2) / sc, focal / sc] : null
  })
  const minMove = perFrame ? BREAK_MIN_MOVE_YD : BREAK_MIN_MOVE_PX
  const last = Math.min(n - 1, searchTo ?? n - 1)
  const turn: Array<number | null> = g.map((p, i) => {
    if (i < searchFrom + K || i + K > last) return null
    const a = g[i - K], b = g[i + K]
    if (!p || !a || !b) return null
    if (Math.hypot(p[0] - a[0], p[1] - a[1]) < minMove || Math.hypot(b[0] - p[0], b[1] - p[1]) < minMove) return null
    const h1 = Math.atan2(p[1] - a[1], p[0] - a[0])
    const h2 = Math.atan2(b[1] - p[1], b[0] - p[0])
    let d = Math.abs(h2 - h1) * 180 / Math.PI
    if (d > 180) d = 360 - d
    return d
  })
  type Run = { start: number; end: number; peak: number }
  const findRuns = (minTurn: number): Run[] => {
    const runs: Run[] = []
    for (let i = 0; i < n; i++) {
      if ((turn[i] ?? 0) < minTurn) continue
      let end = i
      while (end + 1 < n && (turn[end + 1] ?? 0) >= minTurn) end++
      if (end - i + 1 >= BREAK_RUN_FRAMES) {
        let peak = i
        for (let f = i; f <= end; f++) if ((turn[f] ?? 0) > (turn[peak] ?? 0)) peak = f
        runs.push({ start: i, end, peak })
      }
      i = end
    }
    return runs
  }
  const pick = (runs: Run[]) => runs.reduce<Run | null>((b, r) => (!b || (turn[r.peak] ?? 0) > (turn[b.peak] ?? 0) ? r : b), null)
  const r2 = (v: number) => Math.round(v * 100) / 100
  const describe = (runs: Run[]) => runs.map((r) => ({ start: r.start, end: r.end, peak: r.peak, peak_turn_deg: r2(turn[r.peak] ?? 0) }))
  const space = useBody ? 'ground_plane_body_size' : perFrame ? 'ground_plane_yd' : 'image_px'
  const fixedRuns = findRuns(BREAK_MIN_TURN_DEG)
  const base = { search_from: searchFrom, search_to: last, space, span_frames: K, min_turn_deg: BREAK_MIN_TURN_DEG, min_peak_deg: BREAK_MIN_PEAK_DEG, candidates: describe(fixedRuns) }
  const fixedBest = pick(fixedRuns)
  let best: Run | null = fixedBest && (turn[fixedBest.peak] ?? 0) >= BREAK_MIN_PEAK_DEG ? fixedBest : null
  let method = 'ground_plane_direction_change'
  let detail: Record<string, unknown> = base
  if (!best) {
    // Clip-relative: the sharpest sustained turn must stand out from this clip's own straight-running turn noise.
    const vals = turn.filter((t): t is number => t !== null).sort((a, b) => a - b)
    const noise = vals.length ? vals[Math.floor(vals.length / 2)] : 0
    const relMinTurn = Math.max(BREAK_REL_MIN_TURN_DEG, BREAK_REL_RUN_MULTIPLE * noise)
    const relMinPeak = Math.max(BREAK_REL_MIN_PEAK_DEG, BREAK_REL_PEAK_MULTIPLE * noise)
    const relRuns = findRuns(relMinTurn)
    const relBest = pick(relRuns)
    detail = { ...base, relative: { turn_noise_deg: r2(noise), min_turn_deg: r2(relMinTurn), min_peak_deg: r2(relMinPeak), candidates: describe(relRuns) } }
    if (!relBest) return { detected: false, reason: fixedBest ? 'direction_change_below_peak' : 'no_sustained_direction_change', detail }
    if ((turn[relBest.peak] ?? 0) < relMinPeak) return { detected: false, reason: 'direction_change_below_peak', detail }
    best = relBest
    method = 'clip_relative_direction_change'
  }
  const peakDeg = turn[best.peak] ?? 0
  let have = 0
  for (let f = best.peak - K; f <= best.peak + K; f++) if (hips[f]) have++
  const coverage = have / (2 * K + 1)
  if (coverage < BREAK_MIN_COVERAGE) return { detected: false, reason: 'low_hip_coverage', detail: { ...detail, coverage } }
  const raw = Math.min(1, Math.min(1, peakDeg / 90) * 0.5 + coverage * 0.5)
  const conf = method === 'clip_relative_direction_change' ? raw * BREAK_REL_CONFIDENCE_FACTOR : raw
  return {
    detected: true, frame: best.peak, start: best.start, end: best.end, confidence: Math.round(conf * 1000) / 1000,
    detail: { ...detail, method, peak_turn_deg: r2(peakDeg), coverage: Math.round(coverage * 1000) / 1000 },
  }
}

/** Chest-height catch: hand gap and forward reach in torso lengths (mid-shoulder to mid-hip). */
export const CATCH_REACH_MAX_GAP_TORSO = 0.45
export const CATCH_REACH_MIN_FORWARD_TORSO = 0.3
export const CATCH_CONVERGE_TORSO = 0.15
export const CATCH_CONVERGE_LOOKBACK = 8
const HIP_IDS = [HIP_L, HIP_R]

/**
 * Catch = the first qualifying run of CATCH_RUN_FRAMES+ frames after
 * searchFrom of either kind:
 * - hands raised together: both wrists above the shoulder line, gap <=
 *   CATCH_MAX_HAND_GAP_SHOULDERS shoulder widths (high ball); frame = highest
 *   mean wrist point.
 * - hands converging with a forward reach, at any height above the hips: gap
 *   <= CATCH_REACH_MAX_GAP_TORSO torso lengths, both wrists on the same side
 *   of the shoulders by >= CATCH_REACH_MIN_FORWARD_TORSO, and the gap closed by
 *   >= CATCH_CONVERGE_TORSO over the CATCH_CONVERGE_LOOKBACK frames before the
 *   run; frame = tightest hand gap.
 * A running arm swing (hands moving opposite ways) qualifies as neither.
 */
export function detectCatch(keypoints: FrameKps[], scores: FrameScores[], threshold: number, searchFrom: number): RouteEvent {
  const n = keypoints.length
  const ok = (p: number[][], sc: number[], ids: number[]) =>
    ids.every((id) => p[id] && (sc[id] ?? 0) >= threshold && !(p[id][0] === 0 && p[id][1] === 0))
  const handsUp: Array<number | null> = keypoints.map((frame, f) => {
    if (f < searchFrom) return null
    const p = frame?.[0]
    const sc = scores[f]?.[0]
    if (!p || !sc || !ok(p, sc, [WRIST_L, WRIST_R, SHOULDER_L, SHOULDER_R])) return null
    const lw = p[WRIST_L], rw = p[WRIST_R], ls = p[SHOULDER_L], rs = p[SHOULDER_R]
    const shoulderW = Math.hypot(ls[0] - rs[0], ls[1] - rs[1])
    const shoulderY = Math.min(ls[1], rs[1])
    if (shoulderW <= 0) return null
    const gap = Math.hypot(lw[0] - rw[0], lw[1] - rw[1]) / shoulderW
    if (gap > CATCH_MAX_HAND_GAP_SHOULDERS || lw[1] > shoulderY || rw[1] > shoulderY) return null
    return (lw[1] + rw[1]) / 2
  })
  // Hand gap (torso lengths) every frame, plus whether the frame is a forward reach.
  const gapT: Array<number | null> = new Array(n).fill(null)
  const reach: Array<boolean> = new Array(n).fill(false)
  keypoints.forEach((frame, f) => {
    const p = frame?.[0]
    const sc = scores[f]?.[0]
    if (!p || !sc || !ok(p, sc, [WRIST_L, WRIST_R, SHOULDER_L, SHOULDER_R, ...HIP_IDS])) return
    const lw = p[WRIST_L], rw = p[WRIST_R]
    const msx = (p[SHOULDER_L][0] + p[SHOULDER_R][0]) / 2, msy = (p[SHOULDER_L][1] + p[SHOULDER_R][1]) / 2
    const mhy = (p[HIP_L][1] + p[HIP_R][1]) / 2, mhx = (p[HIP_L][0] + p[HIP_R][0]) / 2
    const torso = Math.hypot(msx - mhx, msy - mhy)
    if (torso <= 0) return
    const g = Math.hypot(lw[0] - rw[0], lw[1] - rw[1]) / torso
    gapT[f] = g
    if (f < searchFrom) return
    const dl = (lw[0] - msx) / torso, dr = (rw[0] - msx) / torso
    const forward = Math.sign(dl) === Math.sign(dr) && Math.min(Math.abs(dl), Math.abs(dr)) >= CATCH_REACH_MIN_FORWARD_TORSO
    reach[f] = g <= CATCH_REACH_MAX_GAP_TORSO && forward && lw[1] < mhy && rw[1] < mhy
  })
  const firstRun = (q: (f: number) => boolean, from: number): { start: number; end: number } | null => {
    for (let i = Math.max(0, from); i + CATCH_RUN_FRAMES - 1 < n; i++) {
      let all = true
      for (let k = 0; k < CATCH_RUN_FRAMES; k++) if (!q(i + k)) { all = false; break }
      if (!all) continue
      let end = i
      while (end + 1 < n && q(end + 1)) end++
      return { start: i, end }
    }
    return null
  }
  const raised = firstRun((f) => handsUp[f] !== null, searchFrom)
  let reachRun: { start: number; end: number; closed: number } | null = null
  for (let from = searchFrom; from < n;) {
    const r = firstRun((f) => reach[f], from)
    if (!r) break
    const before = gapT.slice(Math.max(0, r.start - CATCH_CONVERGE_LOOKBACK), r.start).filter((g): g is number => g !== null)
    const inRun = gapT.slice(r.start, r.end + 1).filter((g): g is number => g !== null)
    const closed = before.length ? Math.max(...before) - Math.min(...inRun) : 0
    if (closed >= CATCH_CONVERGE_TORSO) { reachRun = { ...r, closed }; break }
    from = r.end + 1
  }
  const runConf = (s: number, e: number) => Math.round((0.5 + 0.5 * Math.min(1, (e - s + 1) / 6)) * 1000) / 1000
  if (raised && (!reachRun || raised.start <= reachRun.start)) {
    let best = raised.start
    for (let f = raised.start; f <= raised.end; f++) if ((handsUp[f] as number) < (handsUp[best] as number)) best = f
    return { detected: true, frame: best, start: raised.start, end: raised.end, confidence: runConf(raised.start, raised.end), detail: { method: 'hands_raised_together', search_from: searchFrom, run_frames: raised.end - raised.start + 1 } }
  }
  if (reachRun) {
    let best = reachRun.start
    for (let f = reachRun.start; f <= reachRun.end; f++) if ((gapT[f] as number) < (gapT[best] as number)) best = f
    return {
      detected: true, frame: best, start: reachRun.start, end: reachRun.end, confidence: runConf(reachRun.start, reachRun.end),
      detail: { method: 'hands_converging_forward_reach', search_from: searchFrom, run_frames: reachRun.end - reachRun.start + 1, gap_closed_torso: Math.round(reachRun.closed * 1000) / 1000 },
    }
  }
  return { detected: false, reason: 'no_hands_together', detail: { search_from: searchFrom } }
}

export type PhaseRole = 'pre_break' | 'break' | 'pre_catch' | 'catch' | 'post_catch'
const BREAK_NAME = /\b(break|snap back|sink|turn|cross)\b/i
const CATCH_NAME = /\bcatch\b/i

/** Role of each phase (sorted by order) from its name relative to the break and catch phases. */
export function phaseRoles(phases: Array<{ id: string; name: string }>): { roles: PhaseRole[]; hasBreak: boolean } {
  const catchIdx = phases.findIndex((p) => CATCH_NAME.test(p.name))
  const breakIdx = phases.findIndex((p, i) => i > 0 && (catchIdx < 0 || i < catchIdx) && BREAK_NAME.test(p.name) && !CATCH_NAME.test(p.name))
  const roles = phases.map((_, i): PhaseRole => {
    if (i === catchIdx) return 'catch'
    if (catchIdx >= 0 && i > catchIdx) return 'post_catch'
    if (i === breakIdx) return 'break'
    if (breakIdx >= 0 && i < breakIdx) return 'pre_break'
    return breakIdx >= 0 ? 'pre_catch' : 'pre_break'
  })
  return { roles, hasBreak: breakIdx >= 0 }
}

export type AnchoredPhase = {
  id: string
  name: string
  role: PhaseRole
  window: { start: number; end: number } | null
  depends_on: RouteEventName[]
  missing_event: RouteEventName | null
}

type Splitter = (count: number, phases: Array<{ id: string; name: string; proportion_weight?: number; frame_buffer?: number; sequence_order?: number }>) => Record<string, { start: number; end: number }>

/**
 * Phase windows anchored to detected events. Release..stem split [snap, break
 * start); Break = the detected turning run; phases between break and catch
 * split the frames between them; Catch Window = catch-LEAD..catch+TAIL; later
 * phases run to the clip end. Phases bounded by an undetected event get no
 * window (their metrics are skipped, never scored from an assumed window).
 */
export function anchorPhaseWindows(
  totalFrames: number,
  phases: Array<{ id: string; name: string; proportion_weight?: number; frame_buffer?: number; sequence_order?: number }>,
  events: RouteEvents,
  split: Splitter,
): AnchoredPhase[] {
  const { roles } = phaseRoles(phases)
  const last = totalFrames - 1
  const ev = (e: RouteEvent | null) => (e && e.detected ? e : null)
  const snap = ev(events.snap)
  const brk = ev(events.break)
  const cat = ev(events.catch)
  const noCatch = events.catch === null
  const catchStart = cat ? Math.max(0, cat.frame - CATCH_LEAD_FRAMES) : null
  const catchEnd = cat ? Math.min(last, cat.frame + CATCH_TAIL_FRAMES) : null
  const segEnd = (role: PhaseRole): number | null => {
    if (role === 'pre_break') return events.break ? (brk ? brk.start - 1 : null) : (noCatch ? last : catchStart !== null ? catchStart - 1 : null)
    if (role === 'pre_catch') return noCatch ? last : catchStart !== null ? catchStart - 1 : null
    return null
  }
  const deps = (role: PhaseRole): RouteEventName[] => {
    const hasBreak = events.break !== null
    if (role === 'pre_break') return hasBreak ? ['snap', 'break'] : noCatch ? ['snap'] : ['snap', 'catch']
    if (role === 'break') return ['break']
    if (role === 'pre_catch') return noCatch ? (hasBreak ? ['break'] : ['snap']) : hasBreak ? ['break', 'catch'] : ['snap', 'catch']
    return noCatch ? [] : ['catch']
  }
  const detectedOf: Record<RouteEventName, boolean> = { snap: !!snap, break: !!brk, catch: !!cat }
  const out: AnchoredPhase[] = phases.map((p, i) => {
    const d = deps(roles[i])
    const missing = d.find((e) => !detectedOf[e]) ?? null
    return { id: p.id, name: p.name, role: roles[i], window: null, depends_on: d, missing_event: missing }
  })
  const fill = (role: PhaseRole, from: number, to: number) => {
    const group = phases.filter((_, i) => roles[i] === role && !out[i].missing_event)
    if (!group.length || to < from) return
    const w = split(to - from + 1, group)
    for (const o of out) if (o.role === role && w[o.id]) o.window = { start: w[o.id].start + from, end: w[o.id].end + from }
  }
  if (snap) {
    const e = segEnd('pre_break')
    if (e !== null) fill('pre_break', snap.frame, e)
  }
  if (brk) {
    phases.forEach((p, i) => {
      if (roles[i] !== 'break' || out[i].missing_event) return
      const fb = Math.max(0, Math.round(Number(p.frame_buffer) || 0))
      out[i].window = { start: Math.max(0, brk.start - fb), end: Math.min(last, brk.end + fb) }
    })
  }
  const pcStart = brk ? brk.end + 1 : snap ? snap.frame : null
  const pcEnd = segEnd('pre_catch')
  if (pcStart !== null && pcEnd !== null) fill('pre_catch', pcStart, pcEnd)
  if (!noCatch && cat && catchStart !== null && catchEnd !== null) {
    for (const o of out) if (o.role === 'catch') o.window = { start: catchStart, end: catchEnd }
    if (catchEnd < last) fill('post_catch', catchEnd + 1, last)
  }
  return out
}
