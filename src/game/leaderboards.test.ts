import { describe, expect, it } from 'vitest'
import {
  buildChallengeLeaderboardBoards,
  buildDailyLeaderboardBoards,
  findTodayNicknameResult,
  normalizeLeaderboardNickname,
} from '../../supabase/functions/_shared/rules'

describe('nickname leaderboards', () => {
  it('merges normalized daily history and keeps one best result per day', () => {
    const boards = buildDailyLeaderboardBoards([
      { challenge_date: '2026-07-30', nickname: 'Dani', normalized_nickname: 'dani', points: 80, submitted_at: '2026-07-30T09:00:00Z' },
      { challenge_date: '2026-07-30', nickname: 'dani', normalized_nickname: 'dani', points: 100, submitted_at: '2026-07-30T10:00:00Z' },
      { challenge_date: '2026-07-31', nickname: 'Dani', normalized_nickname: 'dani', points: 60, submitted_at: '2026-07-31T09:00:00Z' },
    ], '2026-07-31')

    expect(normalizeLeaderboardNickname('  DANI   ')).toBe('dani')
    expect(boards.today[0].value).toBe(60)
    expect(boards.cumulative?.[0]).toMatchObject({ value: 160, gamesPlayed: 2 })
    expect(boards.average).toHaveLength(0)
    expect(boards.best[0].value).toBe(100)
  })

  it('counts every challenge attempt but uses the daily best for Today', () => {
    const boards = buildChallengeLeaderboardBoards([
      { challenge_date: '2026-07-31', nickname: 'Dani', normalized_nickname: 'dani', points: 600, submitted_at: '2026-07-31T09:00:00Z' },
      { challenge_date: '2026-07-31', nickname: 'Dani', normalized_nickname: 'dani', points: 750, submitted_at: '2026-07-31T10:00:00Z' },
      { challenge_date: '2026-07-30', nickname: 'Dani', normalized_nickname: 'dani', points: 450, submitted_at: '2026-07-30T10:00:00Z' },
    ], '2026-07-31')

    expect(boards.today[0]).toMatchObject({ value: 750, gamesPlayed: 3 })
    expect(boards.gamesPlayed?.[0]).toMatchObject({ value: 3, gamesPlayed: 3 })
    expect(boards.average[0].value).toBe(600)
    expect(boards.best[0].value).toBe(750)
  })

  it('unlocks homepage boards only for a normalized nickname that played today', () => {
    const rows = [
      { challenge_date: '2026-07-30', nickname: 'Yesterday', points: 80, submitted_at: '2026-07-30T09:00:00Z' },
      { challenge_date: '2026-07-31', nickname: 'Dani FC', points: 100, submitted_at: '2026-07-31T09:00:00Z' },
    ]

    expect(findTodayNicknameResult(rows, '2026-07-31', '  DANI   FC ')).toMatchObject({
      nickname: 'Dani FC',
    })
    expect(findTodayNicknameResult(rows, '2026-07-31', 'Yesterday')).toBeNull()
    expect(findTodayNicknameResult(rows, '2026-07-31', 'Unknown')).toBeNull()
  })
})
