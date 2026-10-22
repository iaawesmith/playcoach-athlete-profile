// Pure coaching-model helpers: provider/model validation, resolution,
// anonymization, cost math and comparison summaries. No Deno/Supabase
// imports so they are unit-tested from src/test.

export type CoachProvider = 'anthropic' | 'lovable_ai'

export type CoachModel = { provider: CoachProvider; model: string }

export type ResolvedCoachModel = CoachModel & { source: 'node' | 'default' | 'fallback' | 'replay' }

/** Used only if the settings row is unreadable; same pinned snapshot as the seeded default. */
export const FALLBACK_COACH_MODEL: CoachModel = { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' }

export function isCoachProvider(v: unknown): v is CoachProvider {
  return v === 'anthropic' || v === 'lovable_ai'
}

export type ModelValidation = { ok: boolean; pinned: boolean; reason: string | null }

/**
 * Anthropic: must be a claude-* id; pinned only when it ends in a dated
 * snapshot (-YYYYMMDD). Built-in AI: "vendor/model" ids; these are the ids
 * the built-in route offers, and the exact served model is recorded per call.
 */
export function validateCoachModel(provider: unknown, model: unknown): ModelValidation {
  if (!isCoachProvider(provider)) return { ok: false, pinned: false, reason: 'unknown provider' }
  if (typeof model !== 'string' || !model.trim()) return { ok: false, pinned: false, reason: 'model id required' }
  const m = model.trim()
  if (provider === 'anthropic') {
    if (!/^claude-[a-z0-9.-]+$/.test(m)) return { ok: false, pinned: false, reason: 'not an Anthropic model id' }
    const pinned = /-\d{8}$/.test(m)
    return { ok: true, pinned, reason: pinned ? null : 'floating alias — may change under you; pin a dated snapshot' }
  }
  if (!/^(openai|google)\/[a-z0-9.:-]+$/i.test(m)) return { ok: false, pinned: false, reason: 'built-in AI coaching supports openai/* or google/* chat models' }
  return { ok: true, pinned: false, reason: 'built-in AI id; the exact served model is recorded on every call' }
}

export function resolveCoachModel(
  node: { coaching_provider?: unknown; coaching_model?: unknown } | null | undefined,
  workspaceDefault: { provider?: unknown; model?: unknown } | null | undefined,
  replayOverride?: CoachModel | null,
): ResolvedCoachModel {
  if (replayOverride && validateCoachModel(replayOverride.provider, replayOverride.model).ok) {
    return { ...replayOverride, source: 'replay' }
  }
  if (node && validateCoachModel(node.coaching_provider, node.coaching_model).ok) {
    return { provider: node.coaching_provider as CoachProvider, model: String(node.coaching_model).trim(), source: 'node' }
  }
  if (workspaceDefault && validateCoachModel(workspaceDefault.provider, workspaceDefault.model).ok) {
    return { provider: workspaceDefault.provider as CoachProvider, model: String(workspaceDefault.model).trim(), source: 'default' }
  }
  return { ...FALLBACK_COACH_MODEL, source: 'fallback' }
}

// ---------------------------------------------------------------------------
// Names never reach a provider: prompts say "Athlete"; the real first name is
// put in after generation and after the feedback check.

export const ANON_NAME = 'Athlete'

export function personalizeFeedback(text: string, firstName: unknown): string {
  if (typeof firstName !== 'string') return text
  const name = firstName.trim().split(/\s+/)[0]
  if (!name || name === ANON_NAME || !/^[\p{L}'-]{1,40}$/u.test(name)) return text
  return text.replace(/\bAthlete\b(?!s\b)/g, name)
}

// ---------------------------------------------------------------------------
// Cost: USD per token. Anthropic direct uses its published list price; the
// built-in route uses the live per-token prices from its model catalog, passed
// in by the caller. Unknown models report cost as null rather than a guess.

export type TokenPrice = { input: number; output: number }

export const ANTHROPIC_LIST_PRICES_USD_PER_TOKEN: Record<string, TokenPrice> = {
  'claude-sonnet-4-5': { input: 3 / 1_000_000, output: 15 / 1_000_000 },
}

export function priceFor(m: CoachModel, catalog: Record<string, TokenPrice> = {}): TokenPrice | null {
  if (m.provider === 'lovable_ai') return catalog[m.model] ?? null
  return ANTHROPIC_LIST_PRICES_USD_PER_TOKEN[m.model.replace(/-\d{8}$/, '')] ?? null
}

export function costUsd(
  m: CoachModel,
  inputTokens: number | null | undefined,
  outputTokens: number | null | undefined,
  catalog: Record<string, TokenPrice> = {},
): number | null {
  const p = priceFor(m, catalog)
  if (!p || typeof inputTokens !== 'number' || typeof outputTokens !== 'number') return null
  return inputTokens * p.input + outputTokens * p.output
}

export type ComparisonEstimate = {
  model: CoachModel
  prompts: number
  expected_calls: number
  input_tokens: number
  output_tokens: number
  cost_usd: number | null
}

/** Expected calls = prompts × (1 + retry rate); retries resend the prompt plus a short note. */
export function estimateComparison(
  models: CoachModel[],
  resultCount: number,
  n: number,
  perCall: { input_tokens: number; output_tokens: number },
  retryRate: number,
  catalog: Record<string, TokenPrice> = {},
): ComparisonEstimate[] {
  const prompts = resultCount * n
  const calls = Math.ceil(prompts * (1 + Math.min(1, Math.max(0, retryRate))))
  return models.map((model) => {
    const input_tokens = calls * perCall.input_tokens
    const output_tokens = calls * perCall.output_tokens
    return { model, prompts, expected_calls: calls, input_tokens, output_tokens, cost_usd: costUsd(model, input_tokens, output_tokens, catalog) }
  })
}

// ---------------------------------------------------------------------------

export type ComparisonRun = {
  model: CoachModel
  result_id: string
  first_passed: boolean
  violations: string[]
  retried: boolean
  fallback_used: boolean
  words: number
  cost_usd: number | null
  ms: number
  response: string
  reported_model: string | null
}

export function violationType(v: string): 'level_of_play' | 'solo_rep' | 'length' | 'other' {
  if (v.startsWith('level-of-play')) return 'level_of_play'
  if (v.includes('on a solo rep')) return 'solo_rep'
  if (/words \(limit/.test(v)) return 'length'
  return 'other'
}

export function summarizeComparison(runs: ComparisonRun[]) {
  const groups = new Map<string, ComparisonRun[]>()
  for (const r of runs) {
    const k = `${r.model.provider}:${r.model.model}`
    groups.set(k, [...(groups.get(k) ?? []), r])
  }
  return [...groups.entries()].map(([key, rs]) => {
    const byType: Record<string, number> = { level_of_play: 0, solo_rep: 0, length: 0, other: 0 }
    for (const r of rs) for (const v of r.violations) byType[violationType(v)]++
    const costs = rs.map((r) => r.cost_usd)
    const ms = rs.map((r) => r.ms)
    return {
      model: key,
      reported_models: [...new Set(rs.map((r) => r.reported_model).filter(Boolean))],
      runs: rs.length,
      first_draft_pass_rate: rs.filter((r) => r.first_passed).length / rs.length,
      violations_by_type: byType,
      retries: rs.filter((r) => r.retried).length,
      fallbacks: rs.filter((r) => r.fallback_used).length,
      average_words: rs.reduce((s, r) => s + r.words, 0) / rs.length,
      cost_usd: costs.every((c) => typeof c === 'number') ? costs.reduce((s, c) => s + (c as number), 0) : null,
      average_ms: ms.reduce((s, x) => s + x, 0) / ms.length,
      slowest_ms: Math.max(...ms),
    }
  })
}
