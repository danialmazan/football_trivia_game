import type { DailyCompletion, GameState, LeaderboardBoards } from '../game/types'
import { buildDailyShareData, getLocalizedGameUrl } from '../game/sharing'
import { LeaderboardTabs } from './LeaderboardTabs'
import { SavedResultShare } from './SavedResultShare'
import { useI18n } from '../i18n'

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
  const { locale, t, known } = useI18n()
  return (
    <main className="daily-results-shell">
      <header className="daily-results-hero">
        <button className="wordmark" type="button" onClick={onExit}>
          LEO <span>GUESSI</span>
        </button>
        <span className="eyebrow">{t('Player of the day · {date} UTC', { date: completion.date })}</span>
        <h1>{t('Score saved.')}</h1>
        <div className="daily-result-score">
          <strong>{completion.points}</strong>
          <span>{t('points · rank #{rank}', { rank: completion.rank })}</span>
        </div>
        <p>
          {t('Today’s player was {player}. {nickname}, your result is locked until a new player arrives at 00:00:00 UTC.', { player: game.results[0]?.playerName ?? '', nickname: completion.nickname })}
        </p>
        <div className="daily-saved-actions">
          <SavedResultShare
            data={buildDailyShareData({
              points: completion.points,
              rank: completion.rank,
              date: completion.date,
              url: getLocalizedGameUrl(locale),
              locale,
            })}
          />
        </div>
      </header>

      <div className="leaderboard-refresh-row">
        <button className="text-button" type="button" onClick={onRefresh} disabled={loading}>
          {loading ? t('Refreshing…') : t('Refresh leaderboards')}
        </button>
      </div>
      {error && <p className="daily-service-error" role="alert">{known(error)}</p>}
      <LeaderboardTabs mode="daily" boards={boards} currentNickname={completion.nickname} />

      <div className="daily-results-actions">
        <button className="primary-button primary-button--large" type="button" onClick={onExit}>
          {t('Back to home page')}
        </button>
      </div>
    </main>
  )
}
