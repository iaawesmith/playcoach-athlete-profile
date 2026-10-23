// Pure metric scoring and target wording. No Deno/Supabase imports so it can be
// unit-tested from src/test and reused by the frontend.

export type TargetDirection = 'target' | 'at_most' | 'at_least'

export function normalizeTargetDirection(value: unknown): TargetDirection {
  return value === 'at_most' || value === 'at_least' ? value : 'target'
}

/** Distance past the target on the bad side; 0 on the good side for one-sided targets. */
export function scoredDeviation(value: number, target: number, direction: TargetDirection): number {
  if (direction === 'at_most') return Math.max(0, value - target)
  if (direction === 'at_least') return Math.max(0, target - value)
  return Math.abs(value - target)
}

/** Missing direction = 'target' = original two-sided behaviour. */
export function scoreMetric(value: number, target: number, tolerance: number, direction: unknown = 'target'): number {
  const dir = normalizeTargetDirection(direction)
  const deviation = scoredDeviation(value, target, dir)
  if (dir !== 'target' && deviation === 0) return 100
  if (deviation <= tolerance) return 100
  return Math.max(0, 100 - ((deviation - tolerance) / tolerance) * 50)
}

function fmt(n: number): string {
  return String(Number(n.toFixed(2)))
}

export function unitSuffix(unit: string | null | undefined): string {
  if (!unit) return ''
  if (unit === 'degrees' || unit === '°') return '°'
  if (unit === 'ratio') return ''
  return ` ${unit}`
}

/** Presentation only: ratio storage and scoring remain on the original 0–1 scale. */
export function formatMetricValue(value: unknown, unit?: string | null): string {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN
  if (!Number.isFinite(numeric)) return String(value ?? '')
  return unit === 'ratio' ? `${fmt(numeric * 100)}%` : `${fmt(numeric)}${unitSuffix(unit)}`
}

export function metricValueContext(name: string, unit?: string | null): string {
  return unit === 'ratio' && name.trim().toLowerCase() === 'speed into the break' ? ' of top stem speed' : ''
}

/**
 * Describes a value against its target by direction. Never says just "below".
 * at_most good side: "within the limit"; at_least good side: "met the target";
 * target: "on target" only when the gap is at most 25% of tolerance, otherwise
 * "within range, X from target" while inside tolerance.
 */
export function describeAgainstTarget(
  value: number,
  target: number,
  tolerance: number | null | undefined,
  direction: unknown,
  unit?: string | null,
): string {
  const dir = normalizeTargetDirection(direction)
  const u = unit === 'ratio' ? ' percentage points' : unitSuffix(unit)
  const gap = Math.abs(value - target)
  const displayedGap = unit === 'ratio' ? gap * 100 : gap
  if (dir === 'at_most') return value <= target ? 'within the limit' : `over the target by ${fmt(displayedGap)}${u}`
  if (dir === 'at_least') return value >= target ? 'met the target' : `short of the target by ${fmt(displayedGap)}${u}`
  const tol = typeof tolerance === 'number' && Number.isFinite(tolerance) && tolerance > 0 ? tolerance : 0
  if (gap <= tol * 0.25 || gap === 0) return 'on target'
  if (gap <= tol) return `within range, ${fmt(displayedGap)}${u} from target`
  return `off the target by ${fmt(displayedGap)}${u}`
}
