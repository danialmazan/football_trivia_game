import { useState } from 'react'
import { POOL_LABELS } from '../game/config'
import { isValidNickname } from '../game/daily'
import type { LeaderboardHubResponse, Pool } from '../game/types'
import { LeaderboardTabs } from './LeaderboardTabs'

interface LeaderboardHubScreenProps {
  nickname: string
  response: LeaderboardHubResponse | null
  loading: boolean
  error: string | null
  onNicknameChange: (nickname: string) => void
  onSubmit: () => void
  onRefresh: () => void
  onResetAccess: () => void
  onExit: () => void
}

export function LeaderboardHubScreen({
  nickname,
  response,
  loading,
  error,
  onNicknameChange,
  onSubmit,
  onRefresh,
  onResetAccess,
  onExit,
}: LeaderboardHubScreenProps) {
  const [page, setPage] = useState<'daily' | 'challenge'>('daily')
  const [pool, setPool] = useState<Pool>('normal')
  const unlocked = response?.eligible === true

  return (
    <main className="leaderboard-hub-shell">
      <header className="leaderboard-hub-hero">
        <button className="wordmark" type="button" onClick={onExit}>
          LEO <span>GUESSI</span>
        </button>
        <span className="eyebrow">Shared records · Nickname history</span>
        <h1>Check the leaderboard.</h1>
        <p>
          Complete today’s Player of the Day, then enter the same nickname to unlock every
          leaderboard view.
        </p>
      </header>

      {!unlocked ? (
        <section className="leaderboard-access" aria-labelledby="leaderboard-access-title">
          <div>
            <span className="eyebrow">One name. One history.</span>
            <h2 id="leaderboard-access-title">Enter your nickname.</h2>
            <p>Use the same nickname every time for your stats history to stay together.</p>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              onSubmit()
            }}
          >
            <label htmlFor="leaderboard-nickname">Public nickname</label>
            <div>
              <input
                id="leaderboard-nickname"
                value={nickname}
                onChange={(event) => onNicknameChange(event.target.value)}
                maxLength={24}
                placeholder="Name or nickname"
                autoComplete="nickname"
              />
              <button
                className="primary-button"
                type="submit"
                disabled={loading || !isValidNickname(nickname)}
              >
                {loading ? 'Checking…' : 'Check the leaderboard'}
              </button>
            </div>
          </form>
          {response?.eligible === false && (
            <p className="leaderboard-access__locked" role="status">
              Guess today’s Player of the Day to see the leaderboard!
            </p>
          )}
          {error && <p className="daily-service-error" role="alert">{error}</p>}
        </section>
      ) : (
        <section className="leaderboard-hub-content" aria-label="Unlocked leaderboards">
          <div className="leaderboard-hub-toolbar">
            <p>Viewing as <strong>{response.nickname}</strong></p>
            <div>
              <button className="text-button" type="button" onClick={onRefresh} disabled={loading}>
                {loading ? 'Refreshing…' : 'Refresh leaderboards'}
              </button>
              <button
                className="text-button"
                type="button"
                onClick={onResetAccess}
              >
                Change nickname
              </button>
            </div>
          </div>

          <div className="leaderboard-hub-pages" role="tablist" aria-label="Leaderboard game">
            <button
              type="button"
              role="tab"
              aria-selected={page === 'daily'}
              className={page === 'daily' ? 'active' : ''}
              onClick={() => setPage('daily')}
            >
              Player of the day
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={page === 'challenge'}
              className={page === 'challenge' ? 'active' : ''}
              onClick={() => setPage('challenge')}
            >
              10-round challenge
            </button>
          </div>

          {page === 'daily' ? (
            <LeaderboardTabs
              key="hub-daily"
              mode="daily"
              boards={response.dailyBoards}
              currentNickname={response.nickname}
            />
          ) : (
            <>
              <div className="leaderboard-pool-toggle" aria-label="Challenge player pool">
                {(['normal', 'hardcore'] as const).map((option) => (
                  <button
                    type="button"
                    aria-pressed={pool === option}
                    className={pool === option ? 'active' : ''}
                    onClick={() => setPool(option)}
                    key={option}
                  >
                    {POOL_LABELS[option]}
                  </button>
                ))}
              </div>
              <LeaderboardTabs
                key={`hub-challenge-${pool}`}
                mode="challenge"
                boards={response.challengeBoards[pool]}
                currentNickname={response.nickname}
              />
            </>
          )}
        </section>
      )}

      <div className="leaderboard-hub-home">
        <button className="secondary-button" type="button" onClick={onExit}>
          Back to home page
        </button>
      </div>
    </main>
  )
}
