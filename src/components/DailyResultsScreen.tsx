import type { DailyCompletion, GameState, LeaderboardBoards } from '../game/types'
import { LeaderboardTabs } from './LeaderboardTabs'

interface DailyResultsScreenProps {
  game: GameState
  completion: DailyCompletion
  boards: LeaderboardBoards
  loading: boolean
  error: string | null
  onRefresh: () => void
  onExit: () => void
}

export function DailyResultsScreen({
  game,
  completion,
  boards,
  loading,
  error,
  onRefresh,
  onExit,
}: DailyResultsScreenProps) {
  return (
    <main className="daily-results-shell">
      <header className="daily-results-hero">
        <button className="wordmark" type="button" onClick={onExit}>
          LEO <span>GUESSI</span>
        </button>
        <span className="eyebrow">Player of the day · {completion.date} UTC</span>
        <h1>Score submitted.</h1>
        <div className="daily-result-score">
          <strong>{completion.points}</strong>
          <span>points · rank #{completion.rank}</span>
        </div>
        <p>
          Today’s player was {game.results[0]?.playerName}. {completion.nickname}, your result
          is locked until a new player arrives at 00:00:00 UTC.
        </p>
      </header>

      <div className="leaderboard-refresh-row">
        <button className="text-button" type="button" onClick={onRefresh} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh leaderboards'}
        </button>
      </div>
      {error && <p className="daily-service-error" role="alert">{error}</p>}
      <LeaderboardTabs mode="daily" boards={boards} currentNickname={completion.nickname} />

      <div className="daily-results-actions">
        <button className="primary-button primary-button--large" type="button" onClick={onExit}>
          Back to game modes
        </button>
      </div>
    </main>
  )
}
