import type { DailyCompletion, LeaderboardBoards, LineupGameState } from '../game/types'
import { LeaderboardTabs } from './LeaderboardTabs'
import { SavedResultShare } from './SavedResultShare'
import { buildLineupDailyShareData, getGameUrl } from '../game/sharing'

interface Props {
  game: LineupGameState
  completion: DailyCompletion
  boards: LeaderboardBoards
  loading: boolean
  error: string | null
  onRefresh: () => void
  onExit: () => void
}

export function LineupDailyResultsScreen({ game, completion, boards, loading, error, onRefresh, onExit }: Props) {
  return <main className="daily-results-shell lineup-daily-results-shell"><header className="daily-results-hero"><button className="wordmark" type="button" onClick={onExit}>LEO <span>GUESSI</span></button><span className="eyebrow">Lineup of the day · {completion.date} UTC</span><h1>Lineup score saved.</h1><div className="daily-result-score"><strong>{completion.points}</strong><span>points · rank #{completion.rank}</span></div><p>{completion.nickname}, you identified {game.results[0]?.playerName ?? 'the missing starter'}. Your result is locked until 00:00:00 UTC.</p></header><div className="leaderboard-refresh-row"><button className="text-button" type="button" onClick={onRefresh} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh leaderboards'}</button></div><SavedResultShare data={buildLineupDailyShareData({ points: completion.points, rank: completion.rank, date: completion.date, url: getGameUrl() })} />{error && <p className="daily-service-error" role="alert">{error}</p>}<LeaderboardTabs mode="lineup-daily" boards={boards} currentNickname={completion.nickname} /><div className="daily-results-actions"><button className="primary-button primary-button--large" type="button" onClick={onExit}>Back to home page</button></div></main>
}
