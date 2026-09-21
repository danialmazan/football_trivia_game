import { useMemo, useState } from 'react'
import type { LeaderboardBoards, LeaderboardMetricEntry } from '../game/types'
import { useI18n, type MessageKey } from '../i18n'

type BoardKey = 'today' | 'cumulative' | 'gamesPlayed' | 'average' | 'best'

interface LeaderboardTabsProps {
  mode: 'daily' | 'challenge' | 'lineup-daily' | 'lineup-challenge'
  boards: LeaderboardBoards
  currentNickname: string
}

const DAILY_LABELS: Record<BoardKey, MessageKey> = {
  today: 'Today',
  cumulative: 'Cumulative points',
  gamesPlayed: 'Games played',
  average: 'Average points/game',
  best: 'Best day',
}

const CHALLENGE_LABELS: Record<BoardKey, MessageKey> = {
  today: 'Today',
  cumulative: 'Cumulative points',
  gamesPlayed: 'Games played',
  average: 'Average score/game',
  best: 'Best 10-round',
}

function normalized(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en')
}

export function LeaderboardTabs({ mode, boards, currentNickname }: LeaderboardTabsProps) {
  const { t, modeLabel, formatNumber } = useI18n()
  const tabs: BoardKey[] =
    mode === 'daily' || mode === 'lineup-daily'
      ? ['today', 'cumulative', 'average', 'best']
      : ['today', 'gamesPlayed', 'average', 'best']
  const labels = mode === 'daily' || mode === 'lineup-daily' ? DAILY_LABELS : CHALLENGE_LABELS
  const [active, setActive] = useState<BoardKey>('today')
  const entries = useMemo(
    () => ((boards?.[active] ?? []) as LeaderboardMetricEntry[]),
    [active, boards],
  )
  const unit = active === 'gamesPlayed' ? t('games') : 'pts'

  return (
    <section className="leaderboard-tabs" aria-labelledby="leaderboard-tabs-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">{t('Nickname history')}</span>
          <h2 id="leaderboard-tabs-title">
            {t('{mode} leaderboard', { mode: modeLabel(mode) })}
          </h2>
        </div>
      </div>
      <div className="leaderboard-tablist" role="tablist" aria-label={t('Leaderboard view')}>
        {tabs.map((tab) => (
          <button
            type="button"
            role="tab"
            aria-selected={active === tab}
            className={active === tab ? 'active' : ''}
            onClick={() => setActive(tab)}
            key={tab}
          >
            {t(labels[tab])}
          </button>
        ))}
      </div>
      {(mode === 'challenge' || mode === 'lineup-challenge') && (
        <p className="leaderboard-era-note">
          {t('Shared 10-round records began on 31 July 2026. Earlier games stayed only in each browser.')}
        </p>
      )}
      {active === 'average' && (
        <p className="leaderboard-note">{t('Ranked after at least three completed games.')}</p>
      )}
      <div className="leaderboard-metric-table" role="table" aria-label={t('{label} leaderboard', { label: t(labels[active]) })}>
        <div className="leaderboard-metric-row leaderboard-metric-row--head" role="row">
          <span>{t('Rank')}</span><span>{t('Nickname')}</span><span>{active === 'gamesPlayed' ? t('Games') : t('Points')}</span><span>{t('Played')}</span>
        </div>
        {entries.map((entry) => (
          <div
            className={`leaderboard-metric-row ${
              normalized(entry.nickname) === normalized(currentNickname)
                ? 'leaderboard-metric-row--current'
                : ''
            }`}
            role="row"
            key={`${active}-${entry.rank}-${entry.nickname}`}
          >
            <strong>#{entry.rank}</strong>
            <span>{entry.nickname}</span>
            <b>{formatNumber(entry.value, { maximumFractionDigits: 1 })} {unit}</b>
            <small>{entry.gamesPlayed}</small>
          </div>
        ))}
      </div>
      {!entries.length && (
        <p className="daily-empty">
          {active === 'average' ? t('No nickname has reached three games yet.') : t('No scores yet.')}
        </p>
      )}
      <p className="nickname-history-disclaimer">
        {t('Use the same nickname every time for your stats history to stay together.')}
      </p>
    </section>
  )
}
