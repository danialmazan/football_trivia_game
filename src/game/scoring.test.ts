import { describe, expect, it } from 'vitest'
import { calculateAvailableScore, getClueBaseScore } from './scoring'

describe('scoring', () => {
  it('uses the configured base score for each clue level', () => {
    expect([1, 2, 3, 4, 5].map(getClueBaseScore)).toEqual([100, 80, 60, 40, 20])
  })

  it('keeps incorrect deductions cumulative across clue reveals', () => {
    expect(calculateAvailableScore(1, 2)).toBe(80)
    expect(calculateAvailableScore(2, 1)).toBe(70)
    expect(calculateAvailableScore(4, 5)).toBe(0)
  })

  it('never produces a negative score', () => {
    expect(calculateAvailableScore(5, 20)).toBe(0)
  })
})
