import type { Decade, GameMode, Pool, PracticeLeague } from './types'

export const GAME_CONFIG = {
  cluesPerRound: 5,
  challengeRounds: 10,
  clueBaseScores: [100, 80, 60, 40, 20] as const,
  incorrectGuessPenalty: 10,
  eraCutoffStartYear: 1995,
  minimumBigFiveAppearances: 150,
  minimumClueClubAppearances: 50,
  normalPoolSize: 250,
  hardcorePoolSize: 800,
} as const

export const POOL_RULES: Record<Pool, string> = {
  normal: 'The 250 highest-ranked Big-Five careers.',
  hardcore:
    'The 800 highest-ranked players with 150+ Big-Five appearances.',
}

export const MODE_LABELS: Record<GameMode, string> = {
  daily: 'Player of the day',
  challenge: 'Ten-round challenge',
  endless: 'Endless mode',
  practice: 'Practice by decade or league',
}

export const GAME_MODES: GameMode[] = ['daily', 'challenge', 'endless', 'practice']

export const POOL_LABELS: Record<Pool, string> = {
  normal: 'Normal',
  hardcore: 'Hardcore',
}

export const DECADES: Decade[] = ['1990s', '2000s', '2010s', '2020s']

export const PRACTICE_LEAGUES: Record<PracticeLeague, string> = {
  GB1: 'England',
  ES1: 'Spain',
  IT1: 'Italy',
  L1: 'Germany',
  FR1: 'France',
}
