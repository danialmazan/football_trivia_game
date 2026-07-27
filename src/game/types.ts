export type GameMode = 'challenge' | 'endless' | 'practice'
export type Pool = 'normal' | 'hardcore'
export type Decade = '1990s' | '2000s' | '2010s' | '2020s'
export type PracticeLeague = 'GB1' | 'ES1' | 'IT1' | 'L1' | 'FR1'
export type PracticeFilter =
  | { kind: 'decade'; value: Decade }
  | { kind: 'league'; value: PracticeLeague }
export type RoundOutcome = 'correct' | 'gave-up'

export interface GameSettings {
  mode: GameMode
  pool: Pool
  practiceFilter: PracticeFilter
}

export interface RoundResult {
  playerId: string
  playerName: string
  outcome: RoundOutcome
  points: number
  cluesUsed: number
  incorrectGuesses: string[]
}

export interface RoundState {
  playerId: string
  clueLevel: number
  clueSeed: number
  incorrectGuesses: string[]
  normalizedIncorrectGuesses: string[]
  statusMessage: string
  outcome: RoundOutcome | null
  pointsEarned: number | null
}

export interface GameState {
  version: 1
  phase: 'playing' | 'review' | 'results'
  settings: GameSettings
  round: RoundState
  results: RoundResult[]
  usedPlayerIds: string[]
  totalScore: number
  poolCycle: number
  poolResetMessage: string | null
  startedAt: string
}

export interface EndlessStats {
  totalScore: number
  solved: number
  rounds: number
}

export interface SavedData {
  highScores: Record<Pool, number>
  endlessStats: Record<Pool, EndlessStats>
  lastSettings: GameSettings
  unfinishedGame: GameState | null
}
