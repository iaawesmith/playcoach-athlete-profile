import { describe, expect, it } from 'vitest'
import { describeAgainstTarget, scoreMetric } from '../../supabase/functions/analyze-athlete-video/scoring'

describe('target direction scoring', () => {
  it('missing direction keeps the original two-sided score', () => {
    expect(scoreMetric(0.01, 0.05, 0.0323)).toBeCloseTo(88, 0)
  })
  it('at_most scores 100 at or under the target', () => {
    expect(scoreMetric(0.01, 0.05, 0.0323, 'at_most')).toBe(100)
  })
  it('at_most scores only the amount over', () => {
    expect(scoreMetric(0.09, 0.05, 0.02, 'at_most')).toBeCloseTo(50, 6)
  })
  it('at_least scores 100 at or over the target', () => {
    expect(scoreMetric(8, 7, 1, 'at_least')).toBe(100)
  })
  it('at_least scores only the amount under', () => {
    expect(scoreMetric(5, 7, 1, 'at_least')).toBe(50)
  })
})

describe('target direction wording', () => {
  it('ratio gaps use percentage points without changing scoring', () => {
    expect(describeAgainstTarget(0.8, 0.9, 0.05, 'at_least', 'ratio')).toBe('short of the target by 10 percentage points')
    expect(scoreMetric(0.8, 0.9, 0.05, 'at_least')).toBeCloseTo(50, 6)
  })
  it('at_most good side is within the limit', () => {
    expect(describeAgainstTarget(0.01, 0.05, 0.02, 'at_most', 'yd')).toBe('within the limit')
  })
  it('at_least bad side is short of the target', () => {
    expect(describeAgainstTarget(3.76, 7, 1, 'at_least', 'mph')).toBe('short of the target by 3.24 mph')
  })
  it('at_least good side met the target', () => {
    expect(describeAgainstTarget(7.2, 7, 1, 'at_least', 'mph')).toBe('met the target')
  })
  it('target is on target only within 25% of tolerance', () => {
    expect(describeAgainstTarget(139.61, 140, 5, 'target', 'degrees')).toBe('on target')
    expect(describeAgainstTarget(154.2, 140, 15, 'target', 'degrees')).toBe('within range, 14.2° from target')
  })
})
