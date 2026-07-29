import { describe, expect, it } from 'vitest'
import { GAME_MODES, MODE_LABELS } from './config'
import { getNextUtcMidnight, getUtcDateKey, isValidNickname, rankLeaderboard } from './daily'
import { DEFAULT_SETTINGS } from './persistence'

describe('daily game rules', () => {
  it('is the first and default mode while keeping the existing mode order', () => {
    expect(GAME_MODES).toEqual(['daily', 'challenge', 'endless', 'practice'])
    expect(DEFAULT_SETTINGS).toMatchObject({ mode: 'daily', pool: 'normal' })
    expect(MODE_LABELS.practice).toBe('Practice by decade or league')
  })

  it('uses exact UTC day boundaries', () => {
    const instant = new Date('2026-07-29T23:59:59.999Z')
    expect(getUtcDateKey(instant)).toBe('2026-07-29')
    expect(getNextUtcMidnight(instant)).toBe('2026-07-30T00:00:00.000Z')
  })

  it('accepts one to 24 visible Unicode nickname characters', () => {
    expect(isValidNickname(' Leo ')).toBe(true)
    expect(isValidNickname('⚽')).toBe(true)
    expect(isValidNickname('')).toBe(false)
    expect(isValidNickname('a'.repeat(25))).toBe(false)
    expect(isValidNickname('line\nbreak')).toBe(false)
  })

  it('shares ranks for tied scores and uses submission time for stable ordering', () => {
    const ranked = rankLeaderboard([
      { nickname: 'Late', points: 100, submittedAt: '2026-07-29T12:00:00Z' },
      { nickname: 'Second', points: 80, submittedAt: '2026-07-29T09:00:00Z' },
      { nickname: 'Early', points: 100, submittedAt: '2026-07-29T08:00:00Z' },
    ])
    expect(ranked.map(({ nickname, rank }) => [nickname, rank])).toEqual([
      ['Early', 1],
      ['Late', 1],
      ['Second', 3],
    ])
  })
})
