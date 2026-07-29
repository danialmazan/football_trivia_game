export type GameMode = 'daily' | 'challenge' | 'endless' | 'practice'
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
  version: 1 | 2
  phase: 'playing' | 'review' | 'results'
  settings: GameSettings
  round: RoundState
  results: RoundResult[]
  usedPlayerIds: string[]
  totalScore: number
  poolCycle: number
  poolResetMessage: string | null
  startedAt: string
  dailyChallenge?: DailyChallenge
}

export interface EndlessStats {
  totalScore: number
  solved: number
  rounds: number
}

export interface SavedData {
  schemaVersion: 2
  highScores: Record<Pool, number>
  endlessStats: Record<Pool, EndlessStats>
  lastSettings: GameSettings
  unfinishedGame: GameState | null
  dailyGame: GameState | null
  dailyCompletion: DailyCompletion | null
  installationId: string
}

export interface DailyChallenge {
  date: string
  expiresAt: string
  playerId: string
  clueSeed: number
  rosterVersion: string
  attemptToken: string
}

export interface LeaderboardEntry {
  rank: number
  nickname: string
  points: number
  submittedAt: string
}

export interface DailyResultSubmission {
  challengeDate: string
  attemptToken: string
  nickname: string
  outcome: RoundOutcome
  cluesUsed: number
  incorrectGuesses: number
}

export interface DailyResultResponse {
  date: string
  points: number
  rank: number
  leaderboard: LeaderboardEntry[]
}

export interface DailyCompletion {
  date: string
  nickname: string
  points: number
  rank: number
  leaderboard: LeaderboardEntry[]
}
