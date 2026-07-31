import { GAME_CONFIG, MODE_LABELS, POOL_LABELS, PRACTICE_LEAGUES } from '../game/config'
import { isValidNickname } from '../game/daily'
import { buildChallengeShareData, getGameUrl } from '../game/sharing'
import type { GameState, LeaderboardBoards } from '../game/types'
import { LeaderboardTabs } from './LeaderboardTabs'
import { SavedResultShare } from './SavedResultShare'

interface ResultsScreenProps {
  game: GameState
  highScore: number
  onPlayAgain: () => void
  onSwitchPool: () => void
  nickname: string
  submitting: boolean
  error: string | null
  boards: LeaderboardBoards | null
  submitted: boolean
  onNicknameChange: (nickname: string) => void
  onSubmit: () => void
  onRefresh: () => void
}

export function ResultsScreen({
  game,
  highScore,
  onPlayAgain,
  onSwitchPool,
  nickname,
  submitting,
  error,
  boards,
  submitted,
  onNicknameChange,
  onSubmit,
  onRefresh,
}: ResultsScreenProps) {
  const correct = game.results.filter((result) => result.outcome === 'correct')
  const averageClues = game.results.length
    ? game.results.reduce((sum, result) => sum + result.cluesUsed, 0) / game.results.length
    : 0
  const incorrect = game.results.reduce((sum, result) => sum + result.incorrectGuesses.length, 0)
  const bestRound = Math.max(0, ...game.results.map((result) => result.points))
  const isPractice = game.settings.mode === 'practice'
  const practiceLabel = isPractice
    ? game.settings.practiceFilter.kind === 'decade'
      ? game.settings.practiceFilter.value
      : PRACTICE_LEAGUES[game.settings.practiceFilter.value]
    : null

  return (
    <main className="results-shell">
      <header className="results-hero">
        <span className="eyebrow">
          Full time · {MODE_LABELS[game.settings.mode]} · {POOL_LABELS[game.settings.pool]}
          {practiceLabel ? ` · ${practiceLabel}` : ''}
        </span>
        <h1>That’s the final whistle.</h1>
        <div className="final-score">
          <strong>{game.totalScore}</strong>
          <span>/ {GAME_CONFIG.challengeRounds * GAME_CONFIG.clueBaseScores[0]}</span>
        </div>
        <p>
          {isPractice
            ? 'Ten filtered players completed.'
            : game.totalScore >= highScore
              ? 'New personal best.'
              : `Personal best: ${highScore}`}
        </p>
      </header>

      {!isPractice && (
        <section className={`claim-place ${submitted ? 'claim-place--submitted' : ''}`}>
          <div className="claim-place__marker" aria-hidden="true">LG</div>
          <div className="claim-place__copy">
            <span className="eyebrow">{submitted ? 'Score saved.' : 'Save your game'}</span>
            <h2>{submitted ? 'Now share your result.' : 'Save it. Share it.'}</h2>
            <p>
              {submitted
                ? 'This game now counts toward your challenge history.'
                : 'Enter your nickname to save this game, build your stats history and unlock sharing.'}
            </p>
          </div>
          {!submitted ? (
            <form
              className="claim-place__form"
              onSubmit={(event) => {
                event.preventDefault()
                onSubmit()
              }}
            >
              <label htmlFor="challenge-nickname">Public nickname</label>
              <div>
                <input
                  id="challenge-nickname"
                  value={nickname}
                  onChange={(event) => onNicknameChange(event.target.value)}
                  maxLength={24}
                  placeholder="Name or nickname"
                  autoComplete="nickname"
                />
                <button
                  className="primary-button"
                  type="submit"
                  disabled={submitting || !isValidNickname(nickname)}
                >
                  {submitting ? 'Saving…' : 'Save score & view boards'}
                </button>
              </div>
              <small>Use the same nickname every time for your stats history to stay together.</small>
              {error && <p className="daily-service-error" role="alert">{error}</p>}
            </form>
          ) : (
            <div className="claim-place__saved-actions">
              <SavedResultShare
                data={buildChallengeShareData({
                  points: game.totalScore,
                  pool: game.settings.pool,
                  identified: correct.length,
                  url: getGameUrl(),
                })}
              />
              <button className="text-button" type="button" onClick={onRefresh} disabled={submitting}>
                {submitting ? 'Refreshing…' : 'Refresh leaderboards'}
              </button>
            </div>
          )}
        </section>
      )}

      {!isPractice && submitted && boards && (
        <LeaderboardTabs mode="challenge" boards={boards} currentNickname={nickname} />
      )}

      <section className="result-stats" aria-label="Game statistics">
        <div><strong>{correct.length}</strong><span>Identified</span></div>
        <div><strong>{averageClues.toFixed(1)}</strong><span>Avg clues used</span></div>
        <div><strong>{incorrect}</strong><span>Wrong guesses</span></div>
        <div><strong>{bestRound}</strong><span>Best round</span></div>
      </section>

      <section className="round-recap">
        <div className="section-heading">
          <div><span className="eyebrow">Box score</span><h2>Round by round</h2></div>
        </div>
        <div className="recap-table" role="table" aria-label="Round results">
          <div className="recap-row recap-row--head" role="row">
            <span>Rnd</span><span>Player</span><span>Clues</span><span>Misses</span><span>Pts</span>
          </div>
          {game.results.map((result, index) => (
            <div className="recap-row" role="row" key={`${result.playerId}-${index}`}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{result.playerName}</strong>
              <span>{result.cluesUsed}</span>
              <span>{result.incorrectGuesses.length}</span>
              <b>{result.points}</b>
            </div>
          ))}
        </div>
      </section>

      <div className="results-actions">
        <button className="primary-button primary-button--large" type="button" onClick={onPlayAgain}>Play again</button>
        <button className="secondary-button" type="button" onClick={onSwitchPool}>Switch player pool</button>
      </div>
    </main>
  )
}
