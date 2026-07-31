import type { Decade, GameMode, Pool, PracticeLeague } from './types'

export const GAME_CONFIG = {
  cluesPerRound: 5,
  challengeRounds: 10,
  clueBaseScores: [100, 80, 60, 40, 20] as const,
  incorrectGuessPenalty: 10,
  eraCutoffStartYear: 1995,
  minimumNormalPostCutoffAppearances: 50,
  minimumBigFiveAppearances: 150,
  minimumClueClubAppearances: 50,
  normalPoolSize: 250,
  hardcorePoolSize: 800,
  practiceNormalPoolSize: 100,
  practiceHardcorePoolSize: 300,
} as const

export const POOL_RULES: Record<Pool, string> = {
  normal: '250 recognised players with 50+ Big-Five appearances since 1995.',
  hardcore:
    '800 ranked players with 150+ career Big-Five appearances.',
}

export const MODE_LABELS: Record<GameMode, string> = {
  daily: 'Player of the day',
  challenge: '10-round challenge',
  endless: 'Endless mode',
  practice: 'By decade or league',
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
