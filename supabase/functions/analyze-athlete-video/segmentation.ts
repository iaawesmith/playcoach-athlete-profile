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
  if (stance.length < 3) return none('insufficient_stance_frames')
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
  return none('no_sustained_movement', jitter, threshold)
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
