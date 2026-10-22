// Speed retention ("Speed into the break"): calibrated hip-center speed in
// the frames just before the next phase starts, divided by the peak
// N-frame speed inside the metric's own phase. Pure code, unit-tested.

export type HipPoint = readonly [number, number] | null

export type SpeedRetentionInput = {
  /** Hip-center position per clip frame (null = missing/low confidence). */
  hip: HipPoint[]
  /** Pixels per yard per clip frame (null = no scale for that frame). */
  scale: Array<number | null>
  fps: number
  /** Metric phase window (inclusive clip frames). */
  phase: { start: number; end: number }
  /** First frame of the following phase; the end window stops before it. */
  nextPhaseStart: number
  windowFrames?: number
  /** Last frame the peak search may use (inclusive). The analyzer passes the
   *  frame before the metric's end_before_phase_id starts (Break), so the peak
   *  comes only from Stem frames that precede Break. Defaults to phase.end. */
  peakEnd?: number
}

export type SpeedRetentionResult =
  | { value: number; detail: SpeedRetentionDetail }
  | { value: null; status: 'skipped'; reason: string; detail: Record<string, unknown> }

export type SpeedRetentionDetail = {
  method: 'speed_retention'
  window_frames: number
  end_window: { start: number; end: number }
  peak_window: { start: number; end: number }
  peak_search: { start: number; end: number }
  end_speed_yps: number
  peak_speed_yps: number
  per_frame_speed_yps: Record<number, number | null>
}

const round3 = (n: number) => Math.round(n * 1000) / 1000

/** Speed at frame f in yd/s, using frame f's own scale. Needs f and f-1. */
export function frameSpeedYps(hip: HipPoint[], scale: Array<number | null>, fps: number, f: number): number | null {
  const a = hip[f - 1]
  const b = hip[f]
  const s = scale[f]
  if (!a || !b || typeof s !== 'number' || !(s > 0) || !(fps > 0)) return null
  return (Math.hypot(b[0] - a[0], b[1] - a[1]) / s) * fps
}

function windowMean(speeds: Map<number, number | null>, start: number, n: number): number | null {
  let sum = 0
  for (let f = start; f < start + n; f++) {
    const v = speeds.get(f)
    if (typeof v !== 'number') return null
    sum += v
  }
  return sum / n
}

export function computeSpeedRetention(input: SpeedRetentionInput): SpeedRetentionResult {
  const n = input.windowFrames ?? 5
  const { start, end } = input.phase
  // Speeds need the previous frame inside the phase too.
  const firstSpeedFrame = start + 1
  const speeds = new Map<number, number | null>()
  for (let f = firstSpeedFrame; f <= end; f++) speeds.set(f, frameSpeedYps(input.hip, input.scale, input.fps, f))
  const perFrame = Object.fromEntries([...speeds].map(([f, v]) => [f, v === null ? null : round3(v)]))

  const endStart = input.nextPhaseStart - n
  const endWindow = { start: endStart, end: input.nextPhaseStart - 1 }
  const endSpeed = endStart >= firstSpeedFrame && endWindow.end <= end ? windowMean(speeds, endStart, n) : null
  if (endSpeed === null) {
    return { value: null, status: 'skipped', reason: 'stem_end_overlaps_break', detail: { method: 'speed_retention', end_window: endWindow, phase: input.phase, per_frame_speed_yps: perFrame } }
  }

  const peakEnd = Math.min(end, input.peakEnd ?? end)
  let peak: { start: number; speed: number } | null = null
  for (let s = firstSpeedFrame; s + n - 1 <= peakEnd; s++) {
    const m = windowMean(speeds, s, n)
    if (m !== null && (peak === null || m > peak.speed)) peak = { start: s, speed: m }
  }
  if (!peak || !(peak.speed > 0)) {
    return { value: null, status: 'skipped', reason: 'no_peak_phase_speed', detail: { method: 'speed_retention', end_window: endWindow, phase: input.phase, per_frame_speed_yps: perFrame } }
  }

  return {
    value: round3(endSpeed / peak.speed),
    detail: {
      method: 'speed_retention',
      window_frames: n,
      end_window: endWindow,
      peak_window: { start: peak.start, end: peak.start + n - 1 },
      peak_search: { start: firstSpeedFrame, end: peakEnd },
      end_speed_yps: round3(endSpeed),
      peak_speed_yps: round3(peak.speed),
      per_frame_speed_yps: perFrame,
    },
  }
}
