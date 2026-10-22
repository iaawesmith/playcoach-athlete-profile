// Ground-truth distance check for calibration-library runs. Pure code, unit-tested.
// Display only: it never affects scoring.

export type HipPoint = readonly [number, number] | null

export type BreakAnchor = { frame: number; reason: 'lowest_hip_in_break_window'; hip_y: number }

/** Break anchor = frame with the lowest hip (largest hip-center y) inside the Break window. */
export function findBreakAnchor(hip: HipPoint[], breakWindow: { start: number; end: number }): BreakAnchor | null {
  let best: BreakAnchor | null = null
  for (let f = breakWindow.start; f <= breakWindow.end; f++) {
    const p = hip[f]
    if (!p) continue
    if (!best || p[1] > best.hip_y) best = { frame: f, reason: 'lowest_hip_in_break_window', hip_y: p[1] }
  }
  return best
}

export const GROUND_TRUTH_TOLERANCE = 0.10

export type GroundTruthDistance = {
  release_frame: number
  break_anchor: BreakAnchor
  expected_yd: number
  measured_yd: number
  percent_off: number
  status: 'PASS' | 'WARN'
  seconds: number
  expected_yps: number
  measured_yps: number
  frames_used: number
  missing_frames: number[]
}

const r3 = (n: number) => Math.round(n * 1000) / 1000

/**
 * Measured = sum of per-frame hip displacement in yards (each frame's own
 * scale) from the release anchor to the break anchor. A missing frame is
 * bridged from the last known point using the next frame's scale and listed.
 */
export function computeGroundTruthDistance(input: {
  hip: HipPoint[]
  scale: Array<number | null>
  fps: number
  releaseFrame: number
  breakAnchor: BreakAnchor
  startYardLine: number
  breakYardLine: number
}): GroundTruthDistance | null {
  const { hip, scale, fps, releaseFrame, breakAnchor } = input
  const end = breakAnchor.frame
  if (!(fps > 0) || end <= releaseFrame) return null
  let last = hip[releaseFrame]
  if (!last) return null
  let measured = 0
  let used = 0
  const missing: number[] = []
  for (let f = releaseFrame + 1; f <= end; f++) {
    const p = hip[f]
    const s = scale[f]
    if (!p || typeof s !== 'number' || !(s > 0)) { missing.push(f); continue }
    measured += Math.hypot(p[0] - last[0], p[1] - last[1]) / s
    last = p
    used++
  }
  if (used === 0) return null
  const expected = Math.abs(input.breakYardLine - input.startYardLine)
  if (!(expected > 0)) return null
  const seconds = (end - releaseFrame) / fps
  const off = Math.abs(measured - expected) / expected
  return {
    release_frame: releaseFrame,
    break_anchor: breakAnchor,
    expected_yd: r3(expected),
    measured_yd: r3(measured),
    percent_off: Math.round(off * 1000) / 10,
    status: off <= GROUND_TRUTH_TOLERANCE ? 'PASS' : 'WARN',
    seconds: r3(seconds),
    expected_yps: r3(expected / seconds),
    measured_yps: r3(measured / seconds),
    frames_used: used,
    missing_frames: missing,
  }
}

export function groundTruthLines(g: GroundTruthDistance): [string, string] {
  return [
    `Ground truth distance: expected ${g.expected_yd.toFixed(2)} yd, measured ${g.measured_yd.toFixed(2)} yd (${g.percent_off.toFixed(1)}% off), ${g.status}`,
    `Implied speed: expected ${g.expected_yps.toFixed(2)} yd/s, measured ${g.measured_yps.toFixed(2)} yd/s (frames ${g.release_frame}–${g.break_anchor.frame}, ${g.seconds.toFixed(2)} s)`,
  ]
}

type PerFrameRow = { frame?: number; detected?: boolean; hip_center_x?: number | null; hip_center_y?: number | null; scale_ppy?: number | null }

/**
 * Runs the check from stored per-frame rows (the same hip centers and scales
 * the export carries). Returns null unless this is a library run with both
 * yard lines set, a release anchor and a Break window.
 */
export function groundTruthFromRun(input: {
  context: Record<string, unknown> | null | undefined
  perFrame: PerFrameRow[]
  phaseWindows: Array<{ phase: string; start: number; end: number }>
  releaseFrame: number | null | undefined
  fps: number
}): GroundTruthDistance | null {
  const ctx = input.context ?? {}
  if (ctx.source !== 'calibration_library') return null
  const gt = (ctx.ground_truth ?? {}) as Record<string, unknown>
  const start = typeof gt.start_yard_line === 'number' ? gt.start_yard_line : null
  const brk = typeof gt.break_yard_line === 'number' ? gt.break_yard_line : null
  if (start === null || brk === null || typeof input.releaseFrame !== 'number') return null
  const breakWindow = input.phaseWindows.find((w) => /^break$/i.test(w.phase.trim()))
  if (!breakWindow) return null
  const n = Math.max(input.perFrame.length, breakWindow.end + 1)
  const hip: HipPoint[] = Array.from({ length: n }, () => null)
  const scale: Array<number | null> = Array.from({ length: n }, () => null)
  input.perFrame.forEach((row, i) => {
    const f = typeof row.frame === 'number' ? row.frame : i
    const x = row.hip_center_x, y = row.hip_center_y
    const ok = row.detected !== false && typeof x === 'number' && typeof y === 'number' && !(x === 0 && y === 0)
    hip[f] = ok ? [x as number, y as number] : null
    scale[f] = typeof row.scale_ppy === 'number' ? row.scale_ppy : null
  })
  const anchor = findBreakAnchor(hip, breakWindow)
  if (!anchor) return null
  return computeGroundTruthDistance({ hip, scale, fps: input.fps, releaseFrame: input.releaseFrame, breakAnchor: anchor, startYardLine: start, breakYardLine: brk })
}
