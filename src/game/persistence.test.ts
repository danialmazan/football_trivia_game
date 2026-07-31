import { beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEY, loadSavedData } from './persistence'

const storage = new Map<string, string>()

describe('saved-data migration', () => {
  beforeEach(() => {
    storage.clear()
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
        clear: () => storage.clear(),
      },
    })
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-29T12:00:00Z'))
  })

  it('preserves v1 records and unfinished challenges while selecting daily by default', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        highScores: { normal: 730, hardcore: 410 },
        endlessStats: {
          normal: { totalScore: 100, solved: 1, rounds: 2 },
          hardcore: { totalScore: 0, solved: 0, rounds: 0 },
        },
        lastSettings: {
          mode: 'challenge',
          pool: 'hardcore',
          practiceFilter: { kind: 'decade', value: '2000s' },
        },
        unfinishedGame: {
          version: 1,
          phase: 'playing',
          settings: {
            mode: 'challenge',
            pool: 'normal',
            practiceFilter: { kind: 'decade', value: '2010s' },
          },
          round: {
            playerId: 'lionel-messi-28003',
            clueLevel: 1,
            clueSeed: 0,
            incorrectGuesses: [],
            normalizedIncorrectGuesses: [],
            statusMessage: '',
            outcome: null,
            pointsEarned: null,
          },
          results: [],
          usedPlayerIds: ['lionel-messi-28003'],
          totalScore: 0,
          poolCycle: 1,
          poolResetMessage: null,
          startedAt: '2026-07-29T10:00:00Z',
        },
      }),
    )

    const saved = loadSavedData()
    expect(saved.schemaVersion).toBe(3)
    expect(saved.highScores).toEqual({ normal: 730, hardcore: 410 })
    expect(saved.unfinishedGame?.settings.mode).toBe('challenge')
    expect(saved.lastSettings).toMatchObject({ mode: 'daily', pool: 'normal' })
    expect(saved.installationId).not.toBe('')
    expect(saved.lastNickname).toBe('')
  })

  it('drops stale daily state without touching local records', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 2,
        highScores: { normal: 500, hardcore: 0 },
        lastSettings: {
          mode: 'daily',
          pool: 'normal',
          practiceFilter: { kind: 'decade', value: '2010s' },
        },
        dailyGame: {
          settings: { mode: 'daily', pool: 'normal' },
          dailyChallenge: { date: '2026-07-28' },
        },
        dailyCompletion: {
          date: '2026-07-28',
          nickname: 'Old score',
          points: 100,
          rank: 1,
          leaderboard: [],
        },
        installationId: 'stable-browser-id',
      }),
    )

    const saved = loadSavedData()
    expect(saved.highScores.normal).toBe(500)
    expect(saved.dailyGame).toBeNull()
    expect(saved.dailyCompletion).toBeNull()
    expect(saved.installationId).toBe('stable-browser-id')
    expect(saved.lastNickname).toBe('Old score')
  })
})
