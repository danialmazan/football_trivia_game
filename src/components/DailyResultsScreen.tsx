import type { DailyCompletion, GameState, LeaderboardEntry } from '../game/types'

interface DailyResultsScreenProps {
  game: GameState
  completion: DailyCompletion
  leaderboard: LeaderboardEntry[]
  loading: boolean
  error: string | null
  onRefresh: () => void
  onExit: () => void
}

export function DailyResultsScreen({
  game,
  completion,
  leaderboard,
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

      <section className="daily-leaderboard" aria-labelledby="daily-leaderboard-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Same player · same clues</span>
            <h2 id="daily-leaderboard-title">Today’s leaderboard</h2>
          </div>
          <button className="text-button" type="button" onClick={onRefresh} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        {error && <p className="daily-service-error" role="alert">{error}</p>}
        <div className="daily-table" role="table" aria-label="Daily leaderboard">
          <div className="daily-table__row daily-table__row--head" role="row">
            <span>Rank</span><span>Player</span><span>Points</span>
          </div>
          {leaderboard.map((entry, index) => (
            <div
              className={`daily-table__row ${
                entry.nickname === completion.nickname && entry.points === completion.points
                  ? 'daily-table__row--current'
                  : ''
              }`}
              role="row"
              key={`${entry.nickname}-${entry.submittedAt}-${index}`}
            >
              <strong>#{entry.rank}</strong>
              <span>{entry.nickname}</span>
              <b>{entry.points}</b>
            </div>
          ))}
        </div>
        {!leaderboard.length && !loading && (
          <p className="daily-empty">You are the first name on today’s board.</p>
        )}
      </section>

      <div className="daily-results-actions">
        <button className="primary-button primary-button--large" type="button" onClick={onExit}>
          Back to game modes
        </button>
      </div>
    </main>
  )
}
