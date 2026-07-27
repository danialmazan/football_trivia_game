import type { GameSettings, SavedData } from './types'

export const STORAGE_KEY = 'leo-guessi:football-trivia:v1'

export const DEFAULT_SETTINGS: GameSettings = {
  mode: 'challenge',
  pool: 'normal',
  practiceFilter: { kind: 'decade', value: '2010s' },
}

export const DEFAULT_SAVED_DATA: SavedData = {
  highScores: { normal: 0, hardcore: 0 },
  endlessStats: {
    normal: { totalScore: 0, solved: 0, rounds: 0 },
    hardcore: { totalScore: 0, solved: 0, rounds: 0 },
  },
  lastSettings: DEFAULT_SETTINGS,
  unfinishedGame: null,
}

export function loadSavedData(): SavedData {
  if (typeof window === 'undefined') return DEFAULT_SAVED_DATA
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return DEFAULT_SAVED_DATA
    const parsed = JSON.parse(stored) as Partial<SavedData>
    return {
      ...DEFAULT_SAVED_DATA,
      ...parsed,
      highScores: { ...DEFAULT_SAVED_DATA.highScores, ...parsed.highScores },
      endlessStats: { ...DEFAULT_SAVED_DATA.endlessStats, ...parsed.endlessStats },
      lastSettings: { ...DEFAULT_SETTINGS, ...parsed.lastSettings },
    }
  } catch {
    return DEFAULT_SAVED_DATA
  }
}

export function saveData(data: SavedData): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function resetSavedData(): void {
  window.localStorage.removeItem(STORAGE_KEY)
}
