import { getUtcDateKey } from './daily'
import type { GameSettings, SavedData } from './types'

export const STORAGE_KEY = 'leo-guessi:football-trivia:v1'

export const DEFAULT_SETTINGS: GameSettings = {
  mode: 'daily',
  pool: 'normal',
  practiceFilter: { kind: 'decade', value: '2010s' },
}

export const DEFAULT_SAVED_DATA: SavedData = {
  schemaVersion: 2,
  highScores: { normal: 0, hardcore: 0 },
  endlessStats: {
    normal: { totalScore: 0, solved: 0, rounds: 0 },
    hardcore: { totalScore: 0, solved: 0, rounds: 0 },
  },
  lastSettings: DEFAULT_SETTINGS,
  unfinishedGame: null,
  dailyGame: null,
  dailyCompletion: null,
  installationId: '',
}

function createInstallationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `browser-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function isCurrentDailyGame(game: SavedData['dailyGame']): boolean {
  return Boolean(
    game?.settings.mode === 'daily' &&
      game.dailyChallenge?.date === getUtcDateKey(),
  )
}

export function loadSavedData(): SavedData {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_SAVED_DATA, installationId: createInstallationId() }
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return { ...DEFAULT_SAVED_DATA, installationId: createInstallationId() }
    }
    const parsed = JSON.parse(stored) as Partial<SavedData>
    const migrated = parsed.schemaVersion !== 2
    const parsedDailyGame = isCurrentDailyGame(parsed.dailyGame ?? null)
      ? parsed.dailyGame ?? null
      : null
    const parsedDailyCompletion =
      parsed.dailyCompletion?.date === getUtcDateKey() ? parsed.dailyCompletion : null
    return {
      ...DEFAULT_SAVED_DATA,
      ...parsed,
      schemaVersion: 2,
      highScores: { ...DEFAULT_SAVED_DATA.highScores, ...parsed.highScores },
      endlessStats: { ...DEFAULT_SAVED_DATA.endlessStats, ...parsed.endlessStats },
      lastSettings: migrated
        ? DEFAULT_SETTINGS
        : {
            ...DEFAULT_SETTINGS,
            ...parsed.lastSettings,
            pool: parsed.lastSettings?.mode === 'daily' ? 'normal' : parsed.lastSettings?.pool ?? 'normal',
          },
      dailyGame: parsedDailyGame,
      dailyCompletion: parsedDailyCompletion,
      installationId: parsed.installationId || createInstallationId(),
    }
  } catch {
    return { ...DEFAULT_SAVED_DATA, installationId: createInstallationId() }
  }
}

export function saveData(data: SavedData): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function resetSavedData(): void {
  window.localStorage.removeItem(STORAGE_KEY)
}
