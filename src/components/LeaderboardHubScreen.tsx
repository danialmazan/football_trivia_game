import { useState } from 'react'
import { POOL_LABELS } from '../game/config'
import { isValidNickname } from '../game/daily'
import { buildDailyShareData, buildLineupDailyShareData, getGameUrl } from '../game/sharing'
import type {
  LeaderboardHubResponse,
  LineupLeaderboardHubResponse,
  Pool,
} from '../game/types'
import { LeaderboardTabs } from './LeaderboardTabs'
import { SavedResultShare } from './SavedResultShare'

export type LeaderboardFamily = 'player' | 'lineup'

interface LeaderboardHubScreenProps {
  family: LeaderboardFamily | null
  nickname: string
  playerResponse: LeaderboardHubResponse | null
  lineupResponse: LineupLeaderboardHubResponse | null
  loading: boolean
  error: string | null
  onFamilyChange: (family: LeaderboardFamily | null) => void
  onNicknameChange: (nickname: string) => void
  onSubmit: (family: LeaderboardFamily) => void
  onRefresh: (family: LeaderboardFamily) => void
  onResetAccess: (family: LeaderboardFamily) => void
  onExit: () => void
}

export function LeaderboardHubScreen(props: LeaderboardHubScreenProps) {
  const { family, nickname, playerResponse, lineupResponse, loading, error, onFamilyChange, onNicknameChange, onSubmit, onRefresh, onResetAccess, onExit } = props
  const [page, setPage] = useState<'daily' | 'challenge'>('daily')
  const [pool, setPool] = useState<Pool>('normal')
  const response = family === 'lineup' ? lineupResponse : playerResponse
  const unlocked = response?.eligible === true
  const ownDailyResult = response?.eligible
    ? response.dailyBoards.today.find((entry) => entry.nickname === response.nickname)
    : undefined

  return (
    <main className="leaderboard-hub-shell">
      <header className="leaderboard-hub-hero">
        <button className="wordmark" type="button" onClick={onExit}>LEO <span>GUESSI</span></button>
        <span className="eyebrow">Shared records · Independent daily gates</span>
        <h1>Check the leaderboard.</h1>
        <p>Choose the game family, then use the nickname that completed its daily game.</p>
      </header>

      {!family ? (
        <section className="leaderboard-family-picker" aria-labelledby="leaderboard-family-title">
          <span className="eyebrow">Choose your board</span>
          <h2 id="leaderboard-family-title">What did you guess?</h2>
          <div>
            <button type="button" onClick={() => onFamilyChange('player')}><small>Five clues</small><strong>Guess the player</strong><span>Daily player and 10-round challenge boards →</span></button>
            <button type="button" onClick={() => onFamilyChange('lineup')}><small>One blank shirt</small><strong>Guess the lineup</strong><span>Daily lineup and 10-round lineup boards →</span></button>
          </div>
        </section>
      ) : !unlocked ? (
        <section className="leaderboard-access" aria-labelledby="leaderboard-access-title">
          <button className="leaderboard-family-back" type="button" onClick={() => onFamilyChange(null)}>← Choose another game</button>
          <div><span className="eyebrow">{family === 'player' ? 'Guess the player' : 'Guess the lineup'}</span><h2 id="leaderboard-access-title">Enter your nickname.</h2><p>Use the nickname that saved today’s {family === 'player' ? 'Player of the day' : 'Lineup of the day'}.</p></div>
          <form onSubmit={(event) => { event.preventDefault(); onSubmit(family) }}>
            <label htmlFor="leaderboard-nickname">Public nickname</label>
            <div><input id="leaderboard-nickname" value={nickname} onChange={(event) => onNicknameChange(event.target.value)} maxLength={24} placeholder="Name or nickname" autoComplete="nickname" /><button className="primary-button" type="submit" disabled={loading || !isValidNickname(nickname)}>{loading ? 'Checking…' : 'Check the leaderboard'}</button></div>
          </form>
          {response?.eligible === false && <p className="leaderboard-access__locked" role="status">Guess today’s {family === 'player' ? 'Player of the Day' : 'Lineup of the Day'} to see this leaderboard!</p>}
          {error && <p className="daily-service-error" role="alert">{error}</p>}
        </section>
      ) : (
        <section className="leaderboard-hub-content" aria-label="Unlocked leaderboards">
          <div className="leaderboard-hub-toolbar">
            <div className="leaderboard-hub-toolbar__share"><button className="leaderboard-family-back" type="button" onClick={() => onFamilyChange(null)}>← All leaderboard games</button><p>Viewing as <strong>{response.nickname}</strong></p>{ownDailyResult && <SavedResultShare data={family === 'player' ? buildDailyShareData({ points: ownDailyResult.value, rank: ownDailyResult.rank, date: response.date, url: getGameUrl() }) : buildLineupDailyShareData({ points: ownDailyResult.value, rank: ownDailyResult.rank, date: response.date, url: getGameUrl() })} />}</div>
            <div className="leaderboard-hub-toolbar__tools"><button className="text-button" type="button" onClick={() => onRefresh(family)} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh leaderboards'}</button><button className="text-button" type="button" onClick={() => onResetAccess(family)}>Change nickname</button></div>
          </div>
          <div className="leaderboard-hub-pages" role="tablist" aria-label="Leaderboard game">
            <button type="button" role="tab" aria-selected={page === 'daily'} className={page === 'daily' ? 'active' : ''} onClick={() => setPage('daily')}>{family === 'player' ? 'Player of the day' : 'Lineup of the day'}</button>
            <button type="button" role="tab" aria-selected={page === 'challenge'} className={page === 'challenge' ? 'active' : ''} onClick={() => setPage('challenge')}>{family === 'player' ? '10-round challenge' : '10-round lineup challenge'}</button>
          </div>
          {page === 'daily' ? (
            <LeaderboardTabs
              key={`${family}-daily`}
              mode={family === 'player' ? 'daily' : 'lineup-daily'}
              boards={response.dailyBoards}
              currentNickname={response.nickname}
            />
          ) : family === 'player' && playerResponse?.eligible ? (
            <>
              <div className="leaderboard-pool-toggle" aria-label="Challenge player pool">
                {(['normal', 'hardcore'] as const).map((option) => (
                  <button type="button" aria-pressed={pool === option} className={pool === option ? 'active' : ''} onClick={() => setPool(option)} key={option}>{POOL_LABELS[option]}</button>
                ))}
              </div>
              <LeaderboardTabs key={`hub-challenge-${pool}`} mode="challenge" boards={playerResponse.challengeBoards[pool]} currentNickname={response.nickname} />
            </>
          ) : family === 'lineup' && lineupResponse?.eligible ? (
            <LeaderboardTabs key="hub-lineup-challenge" mode="lineup-challenge" boards={lineupResponse.challengeBoards} currentNickname={response.nickname} />
          ) : null}
        </section>
      )}
      <div className="leaderboard-hub-home"><button className="secondary-button" type="button" onClick={onExit}>Back to home page</button></div>
    </main>
  )
}
