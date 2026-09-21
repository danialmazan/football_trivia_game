import { getUtcDateKey } from './daily'
import type { GameSettings, SavedData } from './types'

export const STORAGE_KEY = 'leo-guessi:football-trivia:v1'

export const DEFAULT_SETTINGS: GameSettings = {
  mode: 'daily',
  pool: 'normal',
  practiceFilter: { kind: 'decade', value: '2010s' },
}

export const DEFAULT_SAVED_DATA: SavedData = {
  schemaVersion: 8,
  highScores: { normal: 0, hardcore: 0 },
  endlessStats: {
    normal: { totalScore: 0, solved: 0, rounds: 0 },
    hardcore: { totalScore: 0, solved: 0, rounds: 0 },
  },
  lastSettings: DEFAULT_SETTINGS,
  unfinishedGame: null,
  dailyGame: null,
  dailyCompletion: null,
  unfinishedLineupGame: null,
  lineupDailyGame: null,
  lineupDailyCompletion: null,
  lineupBestScore: 0,
  installationId: '',
  lastNickname: '',
  pendingDailyEvents: [],
  pendingLineupDailyEvents: [],
}

function createInstallationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `browser-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function migratePlayerGame(game: SavedData['dailyGame']): SavedData['dailyGame']
function migratePlayerGame(game: SavedData['unfinishedGame']): SavedData['unfinishedGame']
function migratePlayerGame(game: SavedData['dailyGame'] | SavedData['unfinishedGame']) {
  if (!game) return null
  return {
    ...game,
    nickname: game.nickname ?? '',
    round: {
      ...game.round,
      statusMessage:
        typeof game.round.statusMessage === 'object' ? game.round.statusMessage : null,
    },
    poolResetMessage:
      typeof game.poolResetMessage === 'object' ? game.poolResetMessage : null,
  }
}

function migrateLineupGame(game: SavedData['lineupDailyGame']): SavedData['lineupDailyGame']
function migrateLineupGame(game: SavedData['unfinishedLineupGame']): SavedData['unfinishedLineupGame']
function migrateLineupGame(game: SavedData['lineupDailyGame'] | SavedData['unfinishedLineupGame']) {
  if (!game) return null
  return {
    ...game,
    nickname: game.nickname ?? '',
    version: 2 as const,
    round: {
      ...game.round,
      cluesUsed: game.round.cluesUsed ?? 0,
      clueIncorrectGuessCounts: game.round.clueIncorrectGuessCounts ?? [],
      statusMessage:
        typeof game.round.statusMessage === 'object' ? game.round.statusMessage : null,
    },
    results: game.results.map((result) => ({
      ...result,
      cluesUsed: result.cluesUsed ?? 0,
      clueIncorrectGuessCounts: result.clueIncorrectGuessCounts ?? [],
    })),
  }
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
    const migrated = !parsed.schemaVersion || parsed.schemaVersion < 2
    const parsedDailyGame = parsed.dailyGame?.settings?.mode === 'daily' && parsed.dailyGame.round && parsed.dailyGame.dailyChallenge
      ? migratePlayerGame(parsed.dailyGame)
      : null
    const parsedDailyCompletion =
      parsed.dailyCompletion?.date === getUtcDateKey() ? parsed.dailyCompletion : null
    const parsedLineupDailyGame = parsed.lineupDailyGame?.mode === 'lineup-daily' && parsed.lineupDailyGame.round && parsed.lineupDailyGame.results && parsed.lineupDailyGame.dailyChallenge
      ? migrateLineupGame(parsed.lineupDailyGame)
      : null
    const parsedLineupDailyCompletion =
      parsed.lineupDailyCompletion?.date === getUtcDateKey()
        ? parsed.lineupDailyCompletion
        : null
    return {
      ...DEFAULT_SAVED_DATA,
      ...parsed,
      schemaVersion: 8,
      highScores: { ...DEFAULT_SAVED_DATA.highScores, ...parsed.highScores },
      endlessStats: { ...DEFAULT_SAVED_DATA.endlessStats, ...parsed.endlessStats },
      lastSettings: migrated
        ? DEFAULT_SETTINGS
        : {
            ...DEFAULT_SETTINGS,
            ...parsed.lastSettings,
            pool: parsed.lastSettings?.mode === 'daily' ? 'normal' : parsed.lastSettings?.pool ?? 'normal',
          },
      unfinishedGame: migratePlayerGame(parsed.unfinishedGame ?? null),
      dailyGame: migratePlayerGame(parsedDailyGame),
      dailyCompletion: parsedDailyCompletion,
      lineupDailyGame: parsedLineupDailyGame,
      lineupDailyCompletion: parsedLineupDailyCompletion,
      unfinishedLineupGame: migrateLineupGame(parsed.unfinishedLineupGame ?? null),
      lineupBestScore: parsed.lineupBestScore ?? 0,
      installationId: parsed.installationId || createInstallationId(),
      lastNickname: parsed.lastNickname ?? parsed.dailyCompletion?.nickname ?? '',
      pendingDailyEvents: parsed.pendingDailyEvents ?? [],
      pendingLineupDailyEvents: parsed.pendingLineupDailyEvents ?? [],
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
