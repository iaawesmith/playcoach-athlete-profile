// Pure prompt-building helpers for coaching feedback. No Deno/Supabase imports
// so they can be unit-tested from src/test.

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

type NodeMetricDef = { name?: unknown; description?: unknown }
type PhaseDef = { id?: unknown; name?: unknown }

type MetricResultLike = {
  name: string
  status?: string
  value?: unknown
  unit?: string | null
  elite_target?: unknown
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
  for (const m of nodeMetrics) {
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
      let line = `- ${head}: ${round(m.value)}${u}, target ${round(m.elite_target)}${u}, score ${score}/100.`
      const desc = descriptions.get(m.name.trim().toLowerCase())
      if (desc) line += ` Measures: ${desc}`
      return line
    })
    .join('\n')
}

const PEOPLE_TEXT: Record<PeopleScenario, string> = {
  solo: 'People in video: the athlete only (solo rep — no defender, no quarterback).',
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
    out = out.replaceAll(`{{${key}}}`, value)
  }
  return out
}
