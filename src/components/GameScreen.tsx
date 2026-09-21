import { useEffect, useRef, useState } from 'react'
import type { Player, SearchPlayer } from '../data/types'
import { getPlayerSuggestions } from '../game/answerMatching'
import { GAME_CONFIG } from '../game/config'
import { generateClues, getCareerSummary } from '../game/clues'
import { calculateAvailableScore } from '../game/scoring'
import type { GameState } from '../game/types'
import { ClueCard } from './ClueCard'
import { useI18n } from '../i18n'

interface GameScreenProps {
  game: GameState
  player: Player
  suggestionCatalog: SearchPlayer[]
  onSubmit: (guess: string) => void
  onReveal: () => void
  onGiveUp: () => void
  onNext: () => void
  onExit: () => void
  dailySubmitting?: boolean
  dailyError?: string | null
  onDailyRetry?: () => void
}

function shouldAutoFocusGuess(): boolean {
  return window.matchMedia('(min-width: 781px) and (pointer: fine)').matches
}

export function GameScreen({
  game,
  player,
  suggestionCatalog,
  onSubmit,
  onReveal,
  onGiveUp,
  onNext,
  onExit,
  dailySubmitting = false,
  dailyError = null,
  onDailyRetry,
}: GameScreenProps) {
  const { locale, t, modeLabel, poolLabel, leagueLabel, feedback, known } = useI18n()
  const [guess, setGuess] = useState('')
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const isReview = game.phase === 'review'
  const practiceFilter = game.settings.mode === 'practice' ? game.settings.practiceFilter : undefined
  const clues = generateClues(player, game.round.clueSeed, practiceFilter, locale)
  const visibleClues = clues.slice(0, isReview ? GAME_CONFIG.cluesPerRound : game.round.clueLevel)
  const availableScore = calculateAvailableScore(game.round.clueLevel, game.round.incorrectGuesses.length)
  const roundNumber = game.results.length + (isReview ? 0 : 1)
  const suggestions = getPlayerSuggestions(guess, suggestionCatalog)
  const showSuggestions = suggestionsOpen && suggestions.length > 0
  const suggestionListId = 'player-suggestions'

  useEffect(() => {
    if (!isReview && shouldAutoFocusGuess()) inputRef.current?.focus()
  }, [game.round.clueLevel, game.round.incorrectGuesses.length, game.round.playerId, isReview])

  useEffect(() => {
    setGuess('')
    setSuggestionsOpen(false)
    setActiveSuggestion(-1)
  }, [game.round.playerId])

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSuggestionsOpen(false)
    setActiveSuggestion(-1)
    onSubmit(guess)
    setGuess('')
    requestAnimationFrame(() => {
      if (shouldAutoFocusGuess()) inputRef.current?.focus()
      else inputRef.current?.blur()
    })
  }

  function selectSuggestion(selectedPlayer: SearchPlayer) {
    setGuess(selectedPlayer.displayName)
    setSuggestionsOpen(false)
    setActiveSuggestion(-1)
    inputRef.current?.focus()
  }

  function handleGuessKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setSuggestionsOpen(false)
      setActiveSuggestion(-1)
      return
    }

    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && suggestions.length > 0) {
      event.preventDefault()
      setSuggestionsOpen(true)
      setActiveSuggestion((current) => {
        if (event.key === 'ArrowDown') return current >= suggestions.length - 1 ? 0 : current + 1
        return current <= 0 ? suggestions.length - 1 : current - 1
      })
      return
    }

    if (event.key === 'Enter' && showSuggestions && activeSuggestion >= 0) {
      event.preventDefault()
      selectSuggestion(suggestions[activeSuggestion])
    }
  }

  const averageEndless = game.results.length ? Math.round(game.totalScore / game.results.length) : 0
  const isDaily = game.settings.mode === 'daily'

  return (
    <main className="game-shell">
      <header className="game-header">
        <button className="wordmark" type="button" onClick={onExit} aria-label={t('Leave game')}>
          LEO <span>GUESSI</span>
        </button>
        <div className="game-header__meta">
          <span>{modeLabel(game.settings.mode)}</span>
          <i aria-hidden="true" />
          <span>{t('{pool} pool', { pool: poolLabel(game.settings.pool) })}</span>
          {game.settings.mode === 'practice' && (
            <span>
              · {game.settings.practiceFilter.kind === 'decade'
                ? game.settings.practiceFilter.value
                : leagueLabel(game.settings.practiceFilter.value)}
            </span>
          )}
        </div>
        <button className="exit-button" type="button" onClick={onExit}>
          {t('Exit')}
        </button>
      </header>

      <section className="game-scorebar" aria-label={t('Game status')}>
        <div>
          <span>
            {isDaily
              ? t('Today’s player')
              : game.settings.mode === 'challenge' || game.settings.mode === 'practice'
                ? t('Progress')
                : game.settings.mode === 'endless'
                  ? t('Players seen')
                  : t('Progress')}
          </span>
          <strong>
            {isDaily
              ? '1 / 1'
              : game.settings.mode === 'challenge' || game.settings.mode === 'practice'
              ? `${Math.max(1, roundNumber)} / ${GAME_CONFIG.challengeRounds}`
              : String(Math.max(1, roundNumber)).padStart(2, '0')}
          </strong>
        </div>
        <div className="game-scorebar__available">
          <span>{isReview ? t('Round score') : t('Available now')}</span>
          <div className="scorebar-points">
            {!isReview && <em>{t('for')}</em>}
            <strong data-testid="available-score">{isReview ? game.round.pointsEarned : availableScore}</strong>
            <em>PTS</em>
          </div>
        </div>
        <div>
          <span>
            {isDaily ? t('Daily score') : t('Game score')}
          </span>
          <strong data-testid="total-score">{game.totalScore}</strong>
        </div>
        {game.settings.mode === 'endless' && (
          <div className="scorebar-optional">
            <span>{t('Avg / player')}</span>
            <strong>{averageEndless}</strong>
          </div>
        )}
      </section>

      {game.poolResetMessage && <div className="pool-reset" role="status">{feedback(game.poolResetMessage)}</div>}

      <div className={`game-layout ${isReview ? 'game-layout--review' : ''}`}>
        <section className="clue-zone" aria-labelledby="clue-heading">
          {isReview ? (
            <details className="review-clues">
              <summary id="clue-heading">
                <span>
                  <strong>{t('Review all five clues')}</strong>
                  <small>{t('Optional · answer shown above')}</small>
                </span>
                <b aria-hidden="true">＋</b>
              </summary>
              <div className="clue-stack">
                {visibleClues.map((clue, index) => (
                  <ClueCard clue={clue} index={index + 1} key={`${game.round.playerId}-${index}`} />
                ))}
              </div>
            </details>
          ) : (
            <>
              <div className="section-heading">
                <span className="eyebrow current-clues-title" id="clue-heading">{t('Current clues')}</span>
                <span className="difficulty-pip">{t('Clue {current} / 5', { current: game.round.clueLevel })}</span>
              </div>

              <div className="clue-stack">
                {visibleClues.map((clue, index) => (
                  <ClueCard
                    clue={clue}
                    index={index + 1}
                    key={`${game.round.playerId}-${index}`}
                    newlyRevealed={index + 1 === game.round.clueLevel}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        <aside className={`answer-zone ${isReview ? 'answer-zone--review' : ''}`}>
          {isReview ? (
            <div className="answer-reveal" data-testid="answer-reveal">
              <span className="eyebrow">{game.round.outcome === 'correct' ? t('Top bins.') : t('Answer revealed')}</span>
              <h2>{player.displayName}</h2>
              <div className="earned-stamp">
                <strong>{game.round.pointsEarned}</strong>
                <span>{t('points earned')}</span>
              </div>
              <p>{getCareerSummary(player, locale)}</p>
              {game.round.incorrectGuesses.length > 0 && (
                <div className="review-guesses">
                  <span>{t('Missed guesses')}</span>
                  <p>{game.round.incorrectGuesses.join(' · ')}</p>
                </div>
              )}
              {isDaily ? (
                <div className="daily-submit" role="status">
                  <strong>{dailySubmitting ? t('Saving…') : t('Waiting to sync')}</strong>
                  <span>{t('Your score is saved automatically when this round ends.')}</span>
                  {dailyError && <p className="daily-service-error">{known(dailyError)}</p>}
                  {dailyError && <button className="primary-button" type="button" onClick={onDailyRetry}>{t('Retry')}</button>}
                </div>
              ) : (
                <button className="primary-button primary-button--large" type="button" onClick={onNext}>
                  {(game.settings.mode === 'challenge' || game.settings.mode === 'practice') &&
                  game.results.length >= GAME_CONFIG.challengeRounds
                    ? t('See final results')
                    : t('Next player')}{' '}
                  <span aria-hidden="true">→</span>
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="answer-zone__header">
                <span className="eyebrow">{t('Guess now, next clue or give up')}</span>
              </div>
              <form onSubmit={handleSubmit}>
                <label htmlFor="player-guess">{t('Player name')}</label>
                <div className="guess-row">
                  <div className="player-autocomplete">
                    <input
                      id="player-guess"
                      ref={inputRef}
                      value={guess}
                      onChange={(event) => {
                        setGuess(event.target.value)
                        setSuggestionsOpen(true)
                        setActiveSuggestion(-1)
                      }}
                      onFocus={() => setSuggestionsOpen(true)}
                      onBlur={() => setSuggestionsOpen(false)}
                      onKeyDown={handleGuessKeyDown}
                      placeholder={t('Player name')}
                      autoComplete="off"
                      spellCheck="false"
                      role="combobox"
                      aria-autocomplete="list"
                      aria-expanded={showSuggestions}
                      aria-controls={suggestionListId}
                      aria-activedescendant={
                        showSuggestions && activeSuggestion >= 0
                          ? `player-suggestion-${suggestions[activeSuggestion].id}`
                          : undefined
                      }
                    />
                    {showSuggestions && (
                      <ul
                        className="player-suggestions"
                        id={suggestionListId}
                        role="listbox"
                        aria-label={t('Player suggestions')}
                      >
                        {suggestions.map((suggestion, index) => (
                          <li
                            className={index === activeSuggestion ? 'player-suggestion is-active' : 'player-suggestion'}
                            id={`player-suggestion-${suggestion.id}`}
                            key={suggestion.id}
                            role="option"
                            aria-selected={index === activeSuggestion}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => selectSuggestion(suggestion)}
                          >
                            <small aria-hidden="true">{String(index + 1).padStart(2, '0')}</small>
                            <span>{suggestion.displayName}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <button className="primary-button" type="submit">{t('Submit')}</button>
                </div>
              </form>
              {game.round.statusMessage && <p className="status-message" role="status" aria-live="polite">{feedback(game.round.statusMessage)}</p>}
              <div className="round-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={onReveal}
                  disabled={game.round.clueLevel >= GAME_CONFIG.cluesPerRound}
                >
                  {t('Next clue')}
                  <span>{game.round.clueLevel >= 5 ? t('All shown') : t('and play for {points} pts', { points: GAME_CONFIG.clueBaseScores[game.round.clueLevel] })}</span>
                </button>
                <button className="give-up-button" type="button" onClick={onGiveUp}>
                  {t('Give up')}
                </button>
              </div>
              {game.round.incorrectGuesses.length > 0 && (
                <p className="previous-guesses-inline" aria-label={t('Incorrect guesses')}>
                  {game.round.incorrectGuesses.map((previousGuess, index) => (
                    <span key={previousGuess}>
                      <s>{previousGuess}</s>{index < game.round.incorrectGuesses.length - 1 ? ', ' : '.'}
                    </span>
                  ))}
                </p>
              )}
            </>
          )}
        </aside>
      </div>
    </main>
  )
}
