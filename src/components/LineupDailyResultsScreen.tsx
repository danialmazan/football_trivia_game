import type { DailyCompletion, LeaderboardBoards, LineupGameState } from '../game/types'
import { LeaderboardTabs } from './LeaderboardTabs'
import { SavedResultShare } from './SavedResultShare'
import { buildLineupDailyShareData, getLocalizedGameUrl } from '../game/sharing'
import { useI18n } from '../i18n'

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
  const { locale, t, known } = useI18n()
  return <main className="daily-results-shell lineup-daily-results-shell"><header className="daily-results-hero"><button className="wordmark" type="button" onClick={onExit}>LEO <span>GUESSI</span></button><span className="eyebrow">{t('Lineup of the day · {date} UTC', { date: completion.date })}</span><h1>{t('Lineup score saved.')}</h1><div className="daily-result-score"><strong>{completion.points}</strong><span>{t('points · rank #{rank}', { rank: completion.rank })}</span></div><p>{t('{nickname}, you identified {player}. Your result is locked until 00:00:00 UTC.', { nickname: completion.nickname, player: game.results[0]?.playerName ?? t('the missing starter') })}</p></header><div className="leaderboard-refresh-row"><button className="text-button" type="button" onClick={onRefresh} disabled={loading}>{loading ? t('Refreshing…') : t('Refresh leaderboards')}</button></div><SavedResultShare data={buildLineupDailyShareData({ points: completion.points, rank: completion.rank, date: completion.date, url: getLocalizedGameUrl(locale), locale })} />{error && <p className="daily-service-error" role="alert">{known(error)}</p>}<LeaderboardTabs mode="lineup-daily" boards={boards} currentNickname={completion.nickname} /><div className="daily-results-actions"><button className="primary-button primary-button--large" type="button" onClick={onExit}>{t('Back to home page')}</button></div></main>
}
