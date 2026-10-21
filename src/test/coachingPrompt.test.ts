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
