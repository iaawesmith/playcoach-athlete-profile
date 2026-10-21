// Pure temporal-smoothing helpers. No I/O so they can be unit-tested from src/test.
// Rules: missed/rejected frames are not positions; smoothing never fabricates a
// point — it only updates frames that had a valid input point or were filled by
// the gap interpolation (<= maxGap frames, reliable on both sides).

export type SPoint = [number, number]
export type SKeypoints = SPoint[][][] // frames → persons → keypoints
export type SScores = number[][][]

export interface KeypointSmoothingSetting {
  windowSize: number
  confidenceThreshold: number
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** A point is missing when absent, non-finite, (0, 0), score 0, or its frame is excluded. */
export function isMissingPoint(
  point: SPoint | undefined,
  score: number | undefined,
  frameIndex: number,
  excludedFrames: Set<number>,
): boolean {
  if (excludedFrames.has(frameIndex)) return true
  if (!Array.isArray(point) || point.length !== 2 || !finite(point[0]) || !finite(point[1])) return true
  if (point[0] === 0 && point[1] === 0) return true
  if (finite(score) && score === 0) return true
  return false
}

export function interpolateGap(series: Array<number | null>, reliable: boolean[], maxGap = 5): Array<number | null> {
  const out = [...series]
  let i = 0
  while (i < out.length) {
    if (reliable[i]) { i += 1; continue }
    const start = i
    while (i < out.length && !reliable[i]) i += 1
    const left = start - 1
    const right = i
    if (i - start > maxGap || left < 0 || right >= out.length || out[left] === null || out[right] === null) continue
    const lv = out[left] as number
    const rv = out[right] as number
    const span = right - left
    for (let k = 1; k < span; k += 1) out[left + k] = lv + (rv - lv) * (k / span)
  }
  return out
}

/** Centered moving average over present values; a missing frame stays missing. */
export function centeredAverage(series: Array<number | null>, windowSize: number): Array<number | null> {
  const half = Math.floor(windowSize / 2)
  return series.map((value, index) => {
    if (value === null) return null
    const vals: number[] = []
    for (let j = Math.max(0, index - half); j <= Math.min(series.length - 1, index + half); j += 1) {
      const v = series[j]
      if (v !== null) vals.push(v)
    }
    if (vals.length < 2) return value
    return vals.reduce((a, b) => a + b, 0) / vals.length
  })
}

export function smoothKeypoints(
  keypoints: SKeypoints,
  scores: SScores,
  settings: Map<number, KeypointSmoothingSetting>,
  excludedFrames: Set<number> = new Set(),
): SKeypoints {
  const out = keypoints.map((f) => f.map((p) => p.map((pt) => [pt[0], pt[1]] as SPoint)))
  const n = keypoints.length
  const persons = keypoints.reduce((m, f) => Math.max(m, f.length), 0)
  for (let p = 0; p < persons; p += 1) {
    for (const [kp, s] of settings) {
      const xs: Array<number | null> = new Array(n).fill(null)
      const ys: Array<number | null> = new Array(n).fill(null)
      const reliable: boolean[] = new Array(n).fill(false)
      for (let i = 0; i < n; i += 1) {
        const pt = keypoints[i]?.[p]?.[kp]
        const sc = scores[i]?.[p]?.[kp]
        if (isMissingPoint(pt, sc, i, excludedFrames)) continue
        xs[i] = (pt as SPoint)[0]
        ys[i] = (pt as SPoint)[1]
        reliable[i] = finite(sc) && sc >= s.confidenceThreshold
      }
      const sx = centeredAverage(interpolateGap(xs, reliable), s.windowSize)
      const sy = centeredAverage(interpolateGap(ys, reliable), s.windowSize)
      for (let i = 0; i < n; i += 1) {
        const x = sx[i]
        const y = sy[i]
        if (x === null || y === null || !out[i]?.[p]?.[kp]) continue
        out[i][p][kp] = [x, y]
      }
    }
  }
  return out
}
