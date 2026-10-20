// Pure, dependency-free helpers for metric plausibility, error-rule evaluation,
// confidence gating, and low-quality feedback. Imported by the analyzer and
// unit-tested from src/test (no Deno APIs allowed here).

export const DEFAULT_MIN_PASS_RATIO = 0.8

export type PlausibleRange = { min: number; max: number }

// Physical plausibility limits. Name matches win over unit matches.
const NAME_RANGES: Array<{ match: RegExp; range: PlausibleRange }> = [
  { match: /speed/i, range: { min: 0, max: 25 } },
  { match: /hands extension/i, range: { min: 0, max: 1.2 } },
  { match: /hip stability/i, range: { min: 0, max: 0.5 } },
  { match: /sink depth/i, range: { min: 0, max: 3 } },
  { match: /head turn timing/i, range: { min: 0, max: 3 } },
  { match: /stride consistency/i, range: { min: 0, max: 1 } },
]

const UNIT_RANGES: Record<string, PlausibleRange> = {
  mph: { min: 0, max: 25 },
  degrees: { min: 0, max: 180 },
  deg: { min: 0, max: 180 },
  '°': { min: 0, max: 180 },
}

export function getPlausibleRange(name: string, unit: string): PlausibleRange | null {
  for (const entry of NAME_RANGES) {
    if (entry.match.test(name)) return entry.range
  }
  return UNIT_RANGES[(unit || '').trim().toLowerCase()] ?? null
}

export function checkPlausibility(name: string, unit: string, value: number): { ok: boolean; range: PlausibleRange | null } {
  const range = getPlausibleRange(name, unit)
  if (!Number.isFinite(value)) return { ok: false, range }
  if (!range) return { ok: true, range: null }
  return { ok: value >= range.min && value <= range.max, range }
}

export function passesWindowGate(passRatio: number, minPassRatio: number = DEFAULT_MIN_PASS_RATIO): boolean {
  return passRatio >= minPassRatio
}

export function resolveErrorName(error: unknown): string {
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    if (typeof record.error === 'string' && record.error.trim()) return record.error
    if (typeof record.name === 'string' && record.name.trim()) return record.name
  }
  return 'Unnamed error'
}

export type MetricLike = { name?: unknown; status?: unknown; value?: unknown; unit?: unknown }

export type ErrorRuleEvaluation = {
  name: string
  severity: string | null
  condition: string
  auto_detectable: boolean
  metric_name: string | null
  metric_value: number | null
  triggered: boolean
  reason: 'triggered' | 'condition_false' | 'not_auto_detectable' | 'unparseable_condition' | 'metric_unavailable'
}

const CONDITION_RE = /^(.+?)\s*(>=|<=|!=|>|<|=)\s*(-?[\d.]+)$/

export function evaluateErrorRules(errors: unknown, metrics: MetricLike[]): ErrorRuleEvaluation[] {
  if (!Array.isArray(errors)) return []
  const valid = new Map<string, number>()
  for (const m of metrics) {
    if (m?.status !== 'scored' || typeof m.name !== 'string') continue
    if (typeof m.value !== 'number' || !Number.isFinite(m.value)) continue
    if (!checkPlausibility(m.name, typeof m.unit === 'string' ? m.unit : '', m.value).ok) continue
    valid.set(m.name.trim(), m.value)
  }

  return errors.map((error) => {
    const record = (error && typeof error === 'object' ? error : {}) as Record<string, unknown>
    const name = resolveErrorName(error)
    const severity = typeof record.severity === 'string' ? record.severity : null
    const condition = typeof record.auto_detection_condition === 'string' ? record.auto_detection_condition.trim() : ''
    const base = { name, severity, condition, auto_detectable: Boolean(record.auto_detectable && condition) }
    if (!base.auto_detectable) {
      return { ...base, metric_name: null, metric_value: null, triggered: false, reason: 'not_auto_detectable' as const }
    }
    const parts = condition.match(CONDITION_RE)
    if (!parts) {
      return { ...base, metric_name: null, metric_value: null, triggered: false, reason: 'unparseable_condition' as const }
    }
    const metricName = parts[1].trim()
    const operator = parts[2]
    const threshold = parseFloat(parts[3])
    const value = valid.get(metricName)
    if (value === undefined || !Number.isFinite(threshold)) {
      return { ...base, metric_name: metricName, metric_value: null, triggered: false, reason: 'metric_unavailable' as const }
    }
    let triggered = false
    switch (operator) {
      case '>': triggered = value > threshold; break
      case '<': triggered = value < threshold; break
      case '>=': triggered = value >= threshold; break
      case '<=': triggered = value <= threshold; break
      case '=': triggered = value === threshold; break
      case '!=': triggered = value !== threshold; break
    }
    return {
      ...base,
      metric_name: metricName,
      metric_value: value,
      triggered,
      reason: triggered ? 'triggered' as const : 'condition_false' as const,
    }
  })
}

export const LOW_QUALITY_FEEDBACK =
  "We couldn't track your movement clearly enough to score this rep. For the next clip: film from the sideline 10–15 yards away, keep your whole body in frame from snap to catch, use even lighting, and hold the camera still."

export function buildLowQualityFeedback(affectedPhases: string[]): string {
  const phases = Array.from(new Set(affectedPhases.filter((p) => p && p.trim())))
  if (phases.length === 0) return LOW_QUALITY_FEEDBACK
  const list = phases.length === 1 ? phases[0] : `${phases.slice(0, -1).join(', ')} and ${phases[phases.length - 1]}`
  return `${LOW_QUALITY_FEEDBACK} The ${list} ${phases.length === 1 ? 'phase was' : 'phases were'} hardest to see.`
}

export function median(values: number[]): number | null {
  const finite = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (finite.length === 0) return null
  const mid = Math.floor(finite.length / 2)
  return finite.length % 2 ? finite[mid] : (finite[mid - 1] + finite[mid]) / 2
}
