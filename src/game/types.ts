export type GameMode =
  | 'daily'
  | 'challenge'
  | 'lineup-daily'
  | 'lineup-challenge'
  | 'endless'
  | 'practice'
export type Pool = 'normal' | 'hardcore'
export type Decade = '1990s' | '2000s' | '2010s' | '2020s'
export type PracticeLeague = 'GB1' | 'ES1' | 'IT1' | 'L1' | 'FR1'
export type PracticeFilter =
  | { kind: 'decade'; value: Decade }
  | { kind: 'league'; value: PracticeLeague }
export type RoundOutcome = 'correct' | 'gave-up'
export type FeedbackMessageKey =
  | 'already-guessed'
  | 'incorrect-player'
  | 'incorrect-lineup-player'
  | 'clue-revealed'
  | 'pool-reset'
  | 'enter-player-name'
  | 'one-player-per-guess'
  | 'be-specific'

export interface FeedbackMessage {
  key: FeedbackMessageKey
  number?: number
}

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
  statusMessage: FeedbackMessage | null
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
  poolResetMessage: FeedbackMessage | null
  startedAt: string
  nickname?: string
  dailyChallenge?: DailyChallenge
}

export interface EndlessStats {
  totalScore: number
  solved: number
  rounds: number
}

export interface SavedData {
  schemaVersion: 7
  highScores: Record<Pool, number>
  endlessStats: Record<Pool, EndlessStats>
  lastSettings: GameSettings
  unfinishedGame: GameState | null
  dailyGame: GameState | null
  dailyCompletion: DailyCompletion | null
  unfinishedLineupGame: LineupGameState | null
  lineupDailyGame: LineupGameState | null
  lineupDailyCompletion: DailyCompletion | null
  lineupBestScore: number
  installationId: string
  lastNickname: string
}

export interface LineupRoundState {
  matchId: string
  missingPlayerId: string
  cluesUsed: number
  clueIncorrectGuessCounts: number[]
  incorrectGuesses: string[]
  normalizedIncorrectGuesses: string[]
  statusMessage: FeedbackMessage | null
  outcome: RoundOutcome | null
  pointsEarned: number | null
}

export interface LineupRoundResult {
  matchId: string
  matchLabel: string
  playerId: string
  playerName: string
  outcome: RoundOutcome
  points: number
  cluesUsed: number
  clueIncorrectGuessCounts: number[]
  incorrectGuesses: string[]
}

export interface LineupGameState {
  version: 1 | 2
  mode: 'lineup-daily' | 'lineup-challenge'
  phase: 'playing' | 'review' | 'results'
  round: LineupRoundState
  results: LineupRoundResult[]
  usedMatchIds: string[]
  totalScore: number
  startedAt: string
  nickname?: string
  dailyChallenge?: LineupDailyChallenge
}

export interface LineupDailyChallenge {
  date: string
  expiresAt: string
  matchId: string
  missingPlayerId: string
  rosterVersion: string
  attemptToken: string
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

export interface LeaderboardMetricEntry {
  rank: number
  nickname: string
  value: number
  gamesPlayed: number
}

export interface LeaderboardBoards {
  today: LeaderboardMetricEntry[]
  cumulative?: LeaderboardMetricEntry[]
  gamesPlayed?: LeaderboardMetricEntry[]
  average: LeaderboardMetricEntry[]
  best: LeaderboardMetricEntry[]
}

export type LeaderboardHubResponse =
  | {
      eligible: false
      date: string
    }
  | {
      eligible: true
      date: string
      nickname: string
      dailyBoards: LeaderboardBoards
      challengeBoards: Record<Pool, LeaderboardBoards>
    }

export type LineupLeaderboardHubResponse =
  | { eligible: false; date: string }
  | {
      eligible: true
      date: string
      nickname: string
      dailyBoards: LeaderboardBoards
      challengeBoards: LeaderboardBoards
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
  boards: LeaderboardBoards
}

export interface DailyCompletion {
  date: string
  nickname: string
  points: number
  rank: number
  leaderboard: LeaderboardEntry[]
  boards?: LeaderboardBoards
}

export interface ChallengeResultSubmission {
  nickname: string
  pool: Pool
  rounds: Array<{
    outcome: RoundOutcome
    cluesUsed: number
    incorrectGuesses: number
  }>
}

export interface ChallengeResultResponse {
  date: string
  pool: Pool
  points: number
  boards: LeaderboardBoards
}

export interface LineupDailyResultSubmission {
  challengeDate: string
  attemptToken: string
  nickname: string
  outcome: RoundOutcome
  cluesUsed: number
  clueIncorrectGuessCounts: number[]
  incorrectGuesses: number
}

export interface LineupChallengeResultSubmission {
  nickname: string
  rounds: Array<{
    outcome: RoundOutcome
    cluesUsed: number
    clueIncorrectGuessCounts: number[]
    incorrectGuesses: number
  }>
}

export interface LineupChallengeResultResponse {
  date: string
  points: number
  boards: LeaderboardBoards
}
