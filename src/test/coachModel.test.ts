import { describe, expect, it } from 'vitest'
import {
  estimateComparison, personalizeFeedback, resolveCoachModel, summarizeComparison, validateCoachModel,
} from '../../supabase/functions/_shared/coachModel'

describe('coaching model setting', () => {
  it('pins Anthropic only with a dated snapshot', () => {
    expect(validateCoachModel('anthropic', 'claude-sonnet-4-5-20250929').pinned).toBe(true)
    expect(validateCoachModel('anthropic', 'claude-sonnet-4-5').pinned).toBe(false)
  })
  it('node override wins over the workspace default', () => {
    expect(resolveCoachModel({ coaching_provider: 'lovable_ai', coaching_model: 'openai/gpt-5.4' }, { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' }).source).toBe('node')
  })
  it('empty node override uses the workspace default', () => {
    expect(resolveCoachModel({ coaching_provider: null, coaching_model: null }, { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' }))
      .toEqual({ provider: 'anthropic', model: 'claude-sonnet-4-5-20250929', source: 'default' })
  })
  it('replay override never needs a saved setting', () => {
    expect(resolveCoachModel(null, null, { provider: 'lovable_ai', model: 'google/gemini-3.1-pro-preview' }).source).toBe('replay')
  })
})

describe('athlete names', () => {
  it('inserts the first name after generation', () => {
    expect(personalizeFeedback('Hey Athlete, nice break.', 'Marcus')).toBe('Hey Marcus, nice break.')
  })
  it('leaves Athlete when no name is known', () => {
    expect(personalizeFeedback('Hey Athlete.', undefined)).toBe('Hey Athlete.')
  })
})

describe('comparison math', () => {
  it('estimates calls with every draft retried once', () => {
    const [e] = estimateComparison([{ provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' }], 2, 3, { input_tokens: 1000, output_tokens: 200 }, 1)
    expect(e.expected_calls).toBe(12)
    expect(e.cost_usd).toBeCloseTo(12 * (1000 * 3 + 200 * 15) / 1e6, 6)
  })
  it('reports first-draft pass rate per model', () => {
    const m = { provider: 'anthropic' as const, model: 'claude-sonnet-4-5-20250929' }
    const base = { model: m, result_id: 'r', retried: false, fallback_used: false, words: 100, cost_usd: 0.01, ms: 1000, response: '', reported_model: null }
    const [s] = summarizeComparison([
      { ...base, first_passed: true, violations: [] },
      { ...base, first_passed: false, retried: true, violations: ['level-of-play word "elite"'] },
    ])
    expect(s.first_draft_pass_rate).toBe(0.5)
    expect(s.violations_by_type.level_of_play).toBe(1)
  })
})
