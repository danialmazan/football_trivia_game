import { useMemo, useState } from 'react'
import type { LeaderboardBoards, LeaderboardMetricEntry } from '../game/types'

type BoardKey = 'today' | 'cumulative' | 'gamesPlayed' | 'average' | 'best'

interface LeaderboardTabsProps {
  mode: 'daily' | 'challenge'
  boards: LeaderboardBoards
  currentNickname: string
}

const DAILY_LABELS: Record<BoardKey, string> = {
  today: 'Today',
  cumulative: 'Cumulative points',
  gamesPlayed: 'Games played',
  average: 'Average points/game',
  best: 'Best day',
}

const CHALLENGE_LABELS: Record<BoardKey, string> = {
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
  const tabs: BoardKey[] =
    mode === 'daily'
      ? ['today', 'cumulative', 'average', 'best']
      : ['today', 'gamesPlayed', 'average', 'best']
  const labels = mode === 'daily' ? DAILY_LABELS : CHALLENGE_LABELS
  const [active, setActive] = useState<BoardKey>('today')
  const entries = useMemo(
    () => ((boards[active] ?? []) as LeaderboardMetricEntry[]),
    [active, boards],
  )
  const unit = active === 'gamesPlayed' ? 'games' : 'pts'

  return (
    <section className="leaderboard-tabs" aria-labelledby="leaderboard-tabs-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Nickname history</span>
          <h2 id="leaderboard-tabs-title">
            {mode === 'daily' ? 'Player of the day' : '10-round challenge'} leaderboard
          </h2>
        </div>
      </div>
      <div className="leaderboard-tablist" role="tablist" aria-label="Leaderboard view">
        {tabs.map((tab) => (
          <button
            type="button"
            role="tab"
            aria-selected={active === tab}
            className={active === tab ? 'active' : ''}
            onClick={() => setActive(tab)}
            key={tab}
          >
            {labels[tab]}
          </button>
        ))}
      </div>
      {active === 'average' && (
        <p className="leaderboard-note">Ranked after at least three completed games.</p>
      )}
      <div className="leaderboard-metric-table" role="table" aria-label={`${labels[active]} leaderboard`}>
        <div className="leaderboard-metric-row leaderboard-metric-row--head" role="row">
          <span>Rank</span><span>Nickname</span><span>{active === 'gamesPlayed' ? 'Games' : 'Points'}</span><span>Played</span>
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
            <b>{entry.value.toLocaleString('en-US', { maximumFractionDigits: 1 })} {unit}</b>
            <small>{entry.gamesPlayed}</small>
          </div>
        ))}
      </div>
      {!entries.length && (
        <p className="daily-empty">
          {active === 'average' ? 'No nickname has reached three games yet.' : 'No scores yet.'}
        </p>
      )}
      <p className="nickname-history-disclaimer">
        Use the same nickname every time for your stats history to stay together.
      </p>
    </section>
  )
}
