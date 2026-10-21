import { describe, expect, it } from 'vitest'
import {
  formatMetricResults,
  formatRunContext,
  renderTemplate,
} from '../../supabase/functions/analyze-athlete-video/prompt'

const nodeMetrics = [{ name: 'Release Speed', description: 'Hip speed over the first 10 frames off the line. Elite receivers hit 7 mph.' }]
const phases = [{ id: 'p1', name: 'Release' }]

describe('coaching prompt grounding', () => {
  it('includes the metric description with each scored value', () => {
    const text = formatMetricResults(
      [{ name: 'Release Speed', status: 'scored', value: 3.76, unit: 'mph', elite_target: 7, score: 68.97, keypoint_mapping: { phase_id: 'p1' } }],
      nodeMetrics,
      phases,
    )
    expect(text).toBe(
      '- Release Speed (Release phase): 3.76 mph, target 7 mph, score 69/100. Measures: Hip speed over the first 10 frames off the line.',
    )
  })

  it('never gives a number for a metric that was not scored', () => {
    const text = formatMetricResults([{ name: 'Release Speed', status: 'skipped', value: 436.58, unit: 'mph' }], nodeMetrics, phases)
    expect(text).toBe('')
  })

  it('tells the model a solo rep had no defender or quarterback', () => {
    expect(formatRunContext({ people_in_video: 'solo' })).toContain('no defender, DB or cornerback, no quarterback')
  })

  it('lists a defender only when one was present', () => {
    expect(formatRunContext({ people_in_video: 'with_defender' })).toContain('one defender')
  })

  it('fills placeholders so none reach the model literally', () => {
    expect(renderTemplate('Adjust for {{athlete_level}}', { athlete_level: 'High School' })).toBe('Adjust for High School')
  })
})

import { buildFallbackFeedback, checkFeedback } from '../../supabase/functions/analyze-athlete-video/prompt'

describe('coaching feedback post-check', () => {
  it('always bans level-of-play words', () => {
    expect(checkFeedback('Your break was elite.', false).violations).toEqual(['level-of-play word "elite"'])
  })

  it('bans other players only on solo reps', () => {
    expect(checkFeedback('Beat press off the line.', true).passed).toBe(false)
    expect(checkFeedback('Beat press off the line.', false).passed).toBe(true)
  })

  it('allows movement words framed as checks', () => {
    expect(checkFeedback('Check your film for stuttering.', true).passed).toBe(true)
  })

  it('fails over 150 words', () => {
    expect(checkFeedback(Array(151).fill('go').join(' '), true).passed).toBe(false)
    expect(checkFeedback(Array(150).fill('go').join(' '), true).passed).toBe(true)
  })

  it('fallback addresses the athlete without using node correction text', () => {
    const text = buildFallbackFeedback(
      [{ name: 'Release Speed', status: 'scored', value: 3.76, unit: 'mph', elite_target: 7 }],
      [{ name: 'Slow release off the line', correction: 'You start slowly. A slow start lets the defender stay square.', metric: 'Release Speed' }],
      true,
    )
    expect(text).toContain('Your Release Speed: 3.76 mph against a 7 mph target (3.24 mph below target).')
    expect(text).not.toContain('You start slowly.')
    expect(text).not.toContain('defender')
    expect(checkFeedback(text, true).passed).toBe(true)
  })

  it.each(['defense', 'coverage', 'window'])('bans %s only on solo reps', (word) => {
    expect(checkFeedback(`Improve your ${word}.`, true).passed).toBe(false)
    expect(checkFeedback(`Improve your ${word}.`, false).passed).toBe(true)
  })

  it('uses the specified Release Speed drill', () => {
    const text = buildFallbackFeedback(
      [{ name: 'Release Speed', status: 'scored', value: 3.76, unit: 'mph', elite_target: 7 }],
      [{ name: 'Slow release off the line', metric: 'Release Speed' }], true,
    )
    expect(text).toContain('five 5-yard starts from your stance at full effort, pushing the ground back hard on the first two steps.')
  })

  it('describes Hip Stability 0.01 against 0.05 as inside the target', () => {
    expect(buildFallbackFeedback(
      [{ name: 'Hip Stability', status: 'scored', value: 0.01, unit: 'yd', elite_target: 0.05 }], [], true,
    )).toContain('Your Hip Stability: 0.01 yd against a 0.05 yd target (inside the target).')
  })

  it('retains the generic drill for other errors', () => {
    expect(buildFallbackFeedback([], [{ name: 'Rounding the break' }], true))
      .toContain('five reps focused only on this, working to bring this area, then film one and compare.')
  })

  it('never returns a failing fallback even with prohibited metric and error names', () => {
    expect(checkFeedback(buildFallbackFeedback(
      [{ name: 'Coverage window', status: 'scored', value: 1, elite_target: 2 }],
      [{ name: 'Elite defense', correction: 'The athlete was elite.' }], true,
    ), true).passed).toBe(true)
  })
})
