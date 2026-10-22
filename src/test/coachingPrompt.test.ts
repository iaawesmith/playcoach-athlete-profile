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
      '- Release Speed (Release phase): 3.76 mph, target 7 mph, off the target by 3.24 mph, score 69/100. Measures: Hip speed over the first 10 frames off the line.',
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

  it('rejects only above 160 words', () => {
    expect(checkFeedback(Array(161).fill('go').join(' '), true).passed).toBe(false)
    expect(checkFeedback(Array(160).fill('go').join(' '), true).passed).toBe(true)
    expect(checkFeedback(Array(156).fill('go').join(' '), true).passed).toBe(true)
  })

  // Rejected retry from result c6fa0895 (stored diagnostics.llm.feedback_check.retry_response).
  const c6fa0895Retry = "Release Speed came in at 3.76 mph against a 7 mph target — 3.24 mph short. It measures how fast your hips move off the line during the release, and it's the only thing holding this rep back from a perfect score.\n\nYour break mechanics are locked in: Plant Leg Extension at 139.61° hits the 140° target, and Hip Stability at 0.01 yards is well inside the 0.05-yard limit.\n\nA slow release often comes from sitting back in your stance or a false step on your first move. Check your film for both.\n\nNext rep: five 5-yard starts from your stance at full speed. Focus on exploding forward — drive the ground back hard with your first two steps. Then run the full slant route."

  it('allows "perfect" about the score (c6fa0895 retry now passes)', () => {
    expect(checkFeedback(c6fa0895Retry, true)).toMatchObject({ passed: true, violations: [] })
    expect(checkFeedback('You scored a perfect 100 on Plant Leg.', true).passed).toBe(true)
  })

  it('still flags "perfect" about the athlete or the rep', () => {
    expect(checkFeedback('That was a perfect release.', true).violations).toContain('level-of-play word "perfect"')
    expect(checkFeedback(c6fa0895Retry.replace('a perfect score', 'a perfect rep'), true).passed).toBe(false)
  })

  it('fallback addresses the athlete without using node correction text', () => {
    const text = buildFallbackFeedback(
      [{ name: 'Release Speed', status: 'scored', value: 3.76, unit: 'mph', elite_target: 7, target_direction: 'at_least' }],
      [{ name: 'Slow release off the line', correction: 'You start slowly. A slow start lets the defender stay square.', metric: 'Release Speed' }],
      true,
    )
    expect(text).toContain('Your Release Speed: 3.76 mph against a 7 mph target (short of the target by 3.24 mph).')
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

  it('describes an at_most 0.01 against 0.05 as within the limit', () => {
    expect(buildFallbackFeedback(
      [{ name: 'Hip Stability', status: 'scored', value: 0.01, unit: 'yd', elite_target: 0.05, target_direction: 'at_most' }], [], true,
    )).toContain('Your Hip Stability: 0.01 yd against a 0.05 yd limit (within the limit).')
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

describe('level-of-play bans', () => {
  it.each(['high-level', 'high level', 'top-level', 'next-level'])('always bans %s', (w) => {
    expect(checkFeedback(`That's ${w} stuff.`, false).passed).toBe(false)
  })
})

describe('praise bans', () => {
  it.each(['flawless', 'perfect', 'unstoppable', 'dominant'])('always bans %s describing the rep', (w) => {
    expect(checkFeedback(`Your break was ${w}.`, false).passed).toBe(false)
  })
  it('allows the direction wording "at or under is perfect"', () => {
    expect(checkFeedback('Hip Stability has a 0.05 yd limit; at or under is perfect.', true).passed).toBe(true)
  })
})
