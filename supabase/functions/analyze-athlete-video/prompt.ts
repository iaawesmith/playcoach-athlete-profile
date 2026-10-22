// Pure prompt-building helpers for coaching feedback. No Deno/Supabase imports
// so they can be unit-tested from src/test.

import { describeAgainstTarget, normalizeTargetDirection } from './scoring.ts'

export type PeopleScenario = 'solo' | 'with_defender' | 'multiple'

export function normalizePeopleInVideo(peopleInVideo: unknown): PeopleScenario {
  if (typeof peopleInVideo === 'string') {
    const normalized = peopleInVideo.trim().toLowerCase()
    if (normalized === 'with_defender') return 'with_defender'
    if (normalized === 'multiple') return 'multiple'
    if (normalized === 'solo' || normalized === 'unknown' || normalized.length === 0) return 'solo'
  }
  if (typeof peopleInVideo === 'number' && Number.isFinite(peopleInVideo)) {
    if (peopleInVideo <= 1) return 'solo'
    if (peopleInVideo === 2) return 'with_defender'
    if (peopleInVideo > 2) return 'multiple'
  }
  return 'solo'
}

type NodeMetricDef = { name?: unknown; description?: unknown; target_direction?: unknown }
type PhaseDef = { id?: unknown; name?: unknown }

type MetricResultLike = {
  name: string
  status?: string
  value?: unknown
  unit?: string | null
  elite_target?: unknown
  tolerance?: unknown
  target_direction?: unknown
  score?: unknown
  keypoint_mapping?: { phase_id?: string } | null
}

function round(value: unknown, digits = 2): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return String(value ?? '')
  return String(Number(value.toFixed(digits)))
}

function unitText(unit: string | null | undefined): string {
  if (!unit) return ''
  if (unit === 'degrees') return '°'
  return ` ${unit}`
}

/** One line per scored metric, with phase, target, score and what the metric measures. */
export function formatMetricResults(
  metrics: MetricResultLike[],
  nodeMetrics: NodeMetricDef[] = [],
  phases: PhaseDef[] = [],
): string {
  const descriptions = new Map<string, string>()
  const directions = new Map<string, unknown>()
  for (const m of nodeMetrics) {
    if (typeof m?.name === 'string' && m.target_direction) directions.set(m.name.trim().toLowerCase(), m.target_direction)
    if (typeof m?.name === 'string' && typeof m.description === 'string' && m.description.trim()) {
      descriptions.set(m.name.trim().toLowerCase(), m.description.trim())
    }
  }
  const phaseNames = new Map<string, string>()
  for (const p of phases) {
    if (typeof p?.id === 'string' && typeof p.name === 'string') phaseNames.set(p.id, p.name)
  }
  return metrics
    .filter((m) => m.status === 'scored')
    .map((m) => {
      const u = unitText(m.unit)
      const phase = m.keypoint_mapping?.phase_id ? phaseNames.get(m.keypoint_mapping.phase_id) : undefined
      const head = phase ? `${m.name} (${phase} phase)` : m.name
      const score = typeof m.score === 'number' ? Math.round(m.score) : m.score
      const dir = normalizeTargetDirection(m.target_direction ?? directions.get(m.name.trim().toLowerCase()))
      const rel = relation(m, dir)
      const targetText = dir === 'at_most' ? `limit ${round(m.elite_target)}${u} (at or under is perfect)`
        : dir === 'at_least' ? `target ${round(m.elite_target)}${u} (at or over is perfect)`
        : `target ${round(m.elite_target)}${u}`
      let line = `- ${head}: ${round(m.value)}${u}, ${targetText}${rel ? `, ${rel}` : ''}, score ${score}/100.`
      const desc = firstSentence(descriptions.get(m.name.trim().toLowerCase()))
      if (desc) line += ` Measures: ${desc}`
      return line
    })
    .join('\n')
}

function relation(m: MetricResultLike, dir: unknown): string {
  const v = typeof m.value === 'number' ? m.value : Number(m.value)
  const t = typeof m.elite_target === 'number' ? m.elite_target : Number(m.elite_target)
  if (!Number.isFinite(v) || !Number.isFinite(t)) return ''
  const tol = typeof m.tolerance === 'number' ? m.tolerance : null
  return describeAgainstTarget(v, t, tol, dir, m.unit)
}

/** Only the first sentence: what the metric measures. Later sentences carry
 *  benchmark language ("Elite receivers…") that invites level comparisons. */
export function firstSentence(text: string | undefined): string {
  if (!text) return ''
  const match = text.match(/^.*?[.!?](?=\s|$)/)
  return (match ? match[0] : text).trim()
}

const PEOPLE_TEXT: Record<PeopleScenario, string> = {
  solo: 'People in video: the athlete only (solo rep — no defender, DB or cornerback, no quarterback, no snap or throw).',
  with_defender: 'People in video: the athlete and one defender.',
  multiple: 'People in video: the athlete and multiple other players.',
}

const LEVEL_TEXT: Record<string, string> = {
  youth: 'Youth',
  high_school: 'High School',
  college: 'College',
  pro: 'Pro',
}

export function formatAthleteLevel(level: unknown): string {
  if (typeof level !== 'string' || !level.trim()) return 'High School'
  return LEVEL_TEXT[level.trim().toLowerCase()] ?? level
}

/** Facts about the clip, taken from the run's stored context only. */
export function formatRunContext(context: Record<string, unknown>, upload: Record<string, unknown> = {}): string {
  const lines = [PEOPLE_TEXT[normalizePeopleInVideo(context.people_in_video)]]
  const angle = context.camera_angle ?? upload.camera_angle
  if (typeof angle === 'string' && angle.trim()) lines.push(`Camera angle: ${angle.trim()}.`)
  const catchStatus = context.catch_status
  const catchIncluded = context.catch_included
  if (catchStatus === 'partial') lines.push('Catch: partially included in the clip.')
  else if (catchStatus === 'yes' || catchIncluded === true) lines.push('Catch: included in the clip.')
  else if (catchStatus === 'no' || catchIncluded === false) lines.push('Catch: not included in the clip — do not discuss the catch.')
  lines.push(`Athlete level: ${formatAthleteLevel(context.athlete_level)}.`)
  return lines.join('\n')
}

/** Replace {{name}} placeholders. Used for both the template and the system instructions. */
export function renderTemplate(template: string, variables: Record<string, string>): string {
  let out = template
  for (const [key, value] of Object.entries(variables)) {
    out = out.split(`{{${key}}}`).join(value)
  }
  return out
}

// ---------------------------------------------------------------------------
// Post-check on the model's coaching feedback.

export const MAX_FEEDBACK_WORDS = 150

const ALWAYS_BANNED: Array<[string, RegExp]> = [
  ['elite', /\belite\b/i],
  ['NFL', /\bNFL\b/i],
  ['D1', /\bD-?1\b|\bDivision (I|1)\b/i],
  ['pro-level', /\bpro[- ]level\b/i],
  ['textbook', /\btextbook\b/i],
  ['college-level', /\bcollege[- ]level\b/i],
  ['high-level', /\bhigh[- ]level\b/i],
  ['top-level', /\btop[- ]level\b/i],
  ['next-level', /\bnext[- ]level\b/i],
]

const SOLO_BANNED: Array<[string, RegExp]> = [
  ['defender', /\bdefenders?\b/i],
  ['DB', /\bDBs?\b/],
  ['cornerback', /\bcornerbacks?\b|\bcorners?\b/i],
  ['press', /\bpress\b/i],
  ['jam', /\bjam(s|med|ming)?\b/i],
  ['separation', /\bseparation\b/i],
  ['quarterback', /\bquarterbacks?\b|\bQBs?\b/i],
  ['snap', /\bsnap(s|ped|ping)?\b/i],
  ['throw', /\bthrow(s|n|ing)?\b|\bthrew\b/i],
  ['defense', /\bdefenses?\b/i],
  ['coverage', /\bcoverage\b/i],
  ['window', /\bwindows?\b/i],
]

export type FeedbackCheck = { passed: boolean; violations: string[]; word_count: number }

export function countWords(text: string): number {
  const t = text.trim()
  return t.length === 0 ? 0 : t.split(/\s+/).length
}

export function checkFeedback(text: string, solo: boolean): FeedbackCheck {
  const violations: string[] = []
  for (const [label, re] of ALWAYS_BANNED) if (re.test(text)) violations.push(`level-of-play word "${label}"`)
  if (solo) for (const [label, re] of SOLO_BANNED) if (re.test(text)) violations.push(`"${label}" on a solo rep`)
  const word_count = countWords(text)
  if (word_count > MAX_FEEDBACK_WORDS) violations.push(`${word_count} words (limit ${MAX_FEEDBACK_WORDS})`)
  if (text.trim().length === 0) violations.push('empty response')
  return { passed: violations.length === 0, violations, word_count }
}

export function splitSentences(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) ?? []).map((s) => s.trim()).filter(Boolean)
}

type FallbackMetric = MetricResultLike
type FallbackError = { name: string; correction?: string | null; metric?: string | null }

/**
 * Built from the data only: each scored metric against its target, the
 * triggered error without node correction text, and one drill for it. Whole
 * sentences only; stays under the word limit by dropping trailing sentences.
 */
export function buildFallbackFeedback(
  metrics: FallbackMetric[],
  errors: FallbackError[],
  solo: boolean,
): string {
  const lines: string[] = []
  for (const m of metrics.filter((x) => x.status === 'scored')) {
    const u = unitText(m.unit)
    const dir = normalizeTargetDirection(m.target_direction)
    const rel = relation(m, dir) || 'not compared'
    lines.push(dir === 'at_most'
      ? `Your ${m.name}: ${round(m.value)}${u} against a ${round(m.elite_target)}${u} limit (${rel}).`
      : `Your ${m.name}: ${round(m.value)}${u} against a ${round(m.elite_target)}${u} target (${rel}).`)
  }
  const err = errors[0]
  if (err) {
    lines.push(`Your flagged issue: ${err.name}.`)
    const metric = err.metric ? metrics.find((m) => m.name === err.metric) : undefined
    const focus = metric ? `${metric.name.toLowerCase()} toward ${round(metric.elite_target)}${unitText(metric.unit)}` : 'this area'
    const releaseFocused = metric?.name.trim().toLowerCase() === 'release speed' || /slow release/i.test(err.name)
    lines.push(releaseFocused
      ? 'For your next rep: five 5-yard starts from your stance at full effort, pushing the ground back hard on the first two steps.'
      : `For your next rep: five reps focused only on this, working to bring ${focus}, then film one and compare.`)
  }
  const out: string[] = []
  for (const line of lines) {
    if (!checkFeedback(line, solo).passed) continue
    if (countWords([...out, line].join(' ')) > MAX_FEEDBACK_WORDS) break
    out.push(line)
  }
  return out.join('\n') || 'Your measurements need review before coaching feedback is available. Film another rep and compare your measured results with their targets.'
}
