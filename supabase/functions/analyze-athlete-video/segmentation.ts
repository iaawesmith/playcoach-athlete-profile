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

// ---------------------------------------------------------------------------
// Detected route events (snap, break, catch) and event-anchored phase windows
// ---------------------------------------------------------------------------

export const BREAK_SPAN_FRAMES = 6
export const BREAK_MIN_TURN_DEG = 30
export const BREAK_RUN_FRAMES = 3
export const BREAK_MIN_MOVE_YD = 0.25
export const BREAK_MIN_MOVE_PX = 6
export const BREAK_MIN_COVERAGE = 0.8
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
  return anchor.applied
    ? { detected: true, frame: anchor.frame, start: anchor.frame, end: anchor.frame, confidence: 1, detail: { method: 'sustained_hip_movement', threshold: anchor.threshold_yd, units: anchor.units } }
    : { detected: false, reason: anchor.reason, detail: { threshold: anchor.threshold_yd, units: anchor.units } }
}

/**
 * Break = first sustained change in hip-path heading after the snap: the angle
 * between the hip displacement over the BREAK_SPAN_FRAMES before and after a
 * frame is >= BREAK_MIN_TURN_DEG for BREAK_RUN_FRAMES in a row, while the
 * athlete is actually moving. The break frame is the sharpest turn in that run;
 * start/end bound the turning run. A straight-line run never qualifies.
 */
export function detectBreak(
  hips: Array<Pt | null>,
  ppy: Array<number | null> | number | null,
  searchFrom: number,
): RouteEvent {
  const s = smoothHips(hips)
  const K = BREAK_SPAN_FRAMES
  const n = s.length
  const scaleAt = (i: number): number | null => {
    const v = Array.isArray(ppy) ? ppy[i] : ppy
    return typeof v === 'number' && v > 0 ? v : null
  }
  const moved = (a: Pt, b: Pt, i: number): boolean => {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1])
    const sc = scaleAt(i)
    return sc ? d / sc >= BREAK_MIN_MOVE_YD : d >= BREAK_MIN_MOVE_PX
  }
  const turn: Array<number | null> = s.map((p, i) => {
    if (i < searchFrom + K || i + K >= n) return null
    const a = s[i - K], b = s[i + K]
    if (!p || !a || !b || !moved(a, p, i) || !moved(p, b, i)) return null
    const h1 = Math.atan2(p[1] - a[1], p[0] - a[0])
    const h2 = Math.atan2(b[1] - p[1], b[0] - p[0])
    let d = Math.abs(h2 - h1) * 180 / Math.PI
    if (d > 180) d = 360 - d
    return d
  })
  const maxTurn = turn.reduce<number>((m, v) => (v !== null && v > m ? v : m), 0)
  const fail = (reason: string): RouteEvent => ({ detected: false, reason, detail: { search_from: searchFrom, max_turn_deg: Math.round(maxTurn * 100) / 100, min_turn_deg: BREAK_MIN_TURN_DEG } })
  for (let i = 0; i + BREAK_RUN_FRAMES - 1 < n; i++) {
    let ok = true
    for (let k = 0; k < BREAK_RUN_FRAMES; k++) {
      const v = turn[i + k]
      if (v === null || v < BREAK_MIN_TURN_DEG) { ok = false; break }
    }
    if (!ok) continue
    let end = i
    while (end + 1 < n && (turn[end + 1] ?? 0) >= BREAK_MIN_TURN_DEG) end++
    let peak = i
    for (let f = i; f <= end; f++) if ((turn[f] ?? 0) > (turn[peak] ?? 0)) peak = f
    let have = 0
    for (let f = peak - K; f <= peak + K; f++) if (hips[f]) have++
    const coverage = have / (2 * K + 1)
    if (coverage < BREAK_MIN_COVERAGE) return fail('low_hip_coverage')
    const conf = Math.min(1, ((turn[peak] ?? 0) / 90) * 0.5 + coverage * 0.5)
    return {
      detected: true, frame: peak, start: i, end, confidence: Math.round(conf * 1000) / 1000,
      detail: { method: 'hip_heading_change', peak_turn_deg: Math.round((turn[peak] ?? 0) * 100) / 100, coverage: Math.round(coverage * 1000) / 1000, search_from: searchFrom },
    }
  }
  return fail('no_sustained_heading_change')
}

/**
 * Catch = hands raised together: both wrists confident, the gap between them
 * <= CATCH_MAX_HAND_GAP_SHOULDERS shoulder widths and both above the shoulder
 * line, for CATCH_RUN_FRAMES in a row, after searchFrom. Frame = highest mean
 * wrist point in the first such run. A mid-stride arm swing (one hand forward,
 * hands apart, below the shoulders) never qualifies.
 */
export function detectCatch(keypoints: FrameKps[], scores: FrameScores[], threshold: number, searchFrom: number): RouteEvent {
  const n = keypoints.length
  const handsUp: Array<number | null> = keypoints.map((frame, f) => {
    if (f < searchFrom) return null
    const p = frame?.[0]
    const sc = scores[f]?.[0]
    if (!p || !sc) return null
    const ids = [WRIST_L, WRIST_R, SHOULDER_L, SHOULDER_R]
    if (ids.some((id) => !p[id] || (sc[id] ?? 0) < threshold || (p[id][0] === 0 && p[id][1] === 0))) return null
    const lw = p[WRIST_L], rw = p[WRIST_R], ls = p[SHOULDER_L], rs = p[SHOULDER_R]
    const shoulderW = Math.hypot(ls[0] - rs[0], ls[1] - rs[1])
    const shoulderY = Math.min(ls[1], rs[1])
    if (shoulderW <= 0) return null
    const gap = Math.hypot(lw[0] - rw[0], lw[1] - rw[1]) / shoulderW
    if (gap > CATCH_MAX_HAND_GAP_SHOULDERS || lw[1] > shoulderY || rw[1] > shoulderY) return null
    return (lw[1] + rw[1]) / 2
  })
  for (let i = Math.max(0, searchFrom); i + CATCH_RUN_FRAMES - 1 < n; i++) {
    let ok = true
    for (let k = 0; k < CATCH_RUN_FRAMES; k++) if (handsUp[i + k] === null) { ok = false; break }
    if (!ok) continue
    let end = i
    while (end + 1 < n && handsUp[end + 1] !== null) end++
    let best = i
    for (let f = i; f <= end; f++) if ((handsUp[f] as number) < (handsUp[best] as number)) best = f
    const runConf = Math.min(1, (end - i + 1) / 6)
    return { detected: true, frame: best, start: i, end, confidence: Math.round((0.5 + 0.5 * runConf) * 1000) / 1000, detail: { method: 'hands_raised_together', search_from: searchFrom, run_frames: end - i + 1 } }
  }
  return { detected: false, reason: 'no_hands_raised_together', detail: { search_from: searchFrom } }
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
  if (brk) for (const o of out) if (o.role === 'break' && !o.missing_event) o.window = { start: brk.start, end: brk.end }
  const pcStart = brk ? brk.end + 1 : snap ? snap.frame : null
  const pcEnd = segEnd('pre_catch')
  if (pcStart !== null && pcEnd !== null) fill('pre_catch', pcStart, pcEnd)
  if (noCatch) {
    for (const o of out) if ((o.role === 'catch' || o.role === 'post_catch') && !o.missing_event) o.missing_event = null
  } else if (cat && catchStart !== null && catchEnd !== null) {
    for (const o of out) if (o.role === 'catch') o.window = { start: catchStart, end: catchEnd }
    if (catchEnd < last) fill('post_catch', catchEnd + 1, last)
  }
  return out
}
