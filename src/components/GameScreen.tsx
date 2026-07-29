import { useEffect, useRef, useState } from 'react'
import type { Player } from '../data/types'
import { getPlayerSuggestions } from '../game/answerMatching'
import { GAME_CONFIG, MODE_LABELS, POOL_LABELS, PRACTICE_LEAGUES } from '../game/config'
import { generateClues, getCareerSummary } from '../game/clues'
import { calculateAvailableScore } from '../game/scoring'
import type { GameState } from '../game/types'
import { ClueCard } from './ClueCard'

interface GameScreenProps {
  game: GameState
  player: Player
  activePool: Player[]
  onSubmit: (guess: string) => void
  onReveal: () => void
  onGiveUp: () => void
  onNext: () => void
  onExit: () => void
}

function shouldAutoFocusGuess(): boolean {
  return window.matchMedia('(min-width: 781px) and (pointer: fine)').matches
}

export function GameScreen({
  game,
  player,
  activePool,
  onSubmit,
  onReveal,
  onGiveUp,
  onNext,
  onExit,
}: GameScreenProps) {
  const [guess, setGuess] = useState('')
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const isReview = game.phase === 'review'
  const practiceFilter = game.settings.mode === 'practice' ? game.settings.practiceFilter : undefined
  const clues = generateClues(player, game.round.clueSeed, practiceFilter)
  const visibleClues = clues.slice(0, isReview ? GAME_CONFIG.cluesPerRound : game.round.clueLevel)
  const availableScore = calculateAvailableScore(game.round.clueLevel, game.round.incorrectGuesses.length)
  const roundNumber = game.results.length + (isReview ? 0 : 1)
  const suggestions = getPlayerSuggestions(guess, activePool)
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

  function selectSuggestion(selectedPlayer: Player) {
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

  const solved = game.results.filter((result) => result.outcome === 'correct').length
  const averageEndless = game.results.length ? Math.round(game.totalScore / game.results.length) : 0

  return (
    <main className="game-shell">
      <header className="game-header">
        <button className="wordmark" type="button" onClick={onExit} aria-label="Leave game">
          LEO <span>GUESSI</span>
        </button>
        <div className="game-header__meta">
          <span>{MODE_LABELS[game.settings.mode]}</span>
          <i aria-hidden="true" />
          <span>{POOL_LABELS[game.settings.pool]} pool</span>
          {game.settings.mode === 'practice' && (
            <span>
              · {game.settings.practiceFilter.kind === 'decade'
                ? game.settings.practiceFilter.value
                : PRACTICE_LEAGUES[game.settings.practiceFilter.value]}
            </span>
          )}
        </div>
        <button className="exit-button" type="button" onClick={onExit}>
          Exit
        </button>
      </header>

      <section className="game-scorebar" aria-label="Game status">
        <div>
          <span>{game.settings.mode === 'challenge' ? 'Progress' : game.settings.mode === 'endless' ? 'Players seen' : 'Practice rep'}</span>
          <strong>
            {game.settings.mode === 'challenge'
              ? `${Math.max(1, roundNumber)} / ${GAME_CONFIG.challengeRounds}`
              : String(Math.max(1, roundNumber)).padStart(2, '0')}
          </strong>
        </div>
        <div className="game-scorebar__available">
          <span>{isReview ? 'Round score' : 'Available now'}</span>
          <div className="scorebar-points">
            {!isReview && <em>for</em>}
            <strong data-testid="available-score">{isReview ? game.round.pointsEarned : availableScore}</strong>
            <em>PTS</em>
          </div>
        </div>
        <div>
          <span>{game.settings.mode === 'practice' ? 'Players solved' : 'Game score'}</span>
          <strong data-testid="total-score">{game.settings.mode === 'practice' ? solved : game.totalScore}</strong>
        </div>
        {game.settings.mode === 'endless' && (
          <div className="scorebar-optional">
            <span>Avg / player</span>
            <strong>{averageEndless}</strong>
          </div>
        )}
      </section>

      {game.poolResetMessage && <div className="pool-reset" role="status">{game.poolResetMessage}</div>}

      <div className={`game-layout ${isReview ? 'game-layout--review' : ''}`}>
        <section className="clue-zone" aria-labelledby="clue-heading">
          {isReview ? (
            <details className="review-clues">
              <summary id="clue-heading">
                <span>
                  <strong>Review all five clues</strong>
                  <small>Optional · answer shown above</small>
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
                <span className="eyebrow current-clues-title" id="clue-heading">Current clues</span>
                <span className="difficulty-pip">Clue {game.round.clueLevel} / 5</span>
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
              <span className="eyebrow">{game.round.outcome === 'correct' ? 'Top bins.' : 'Answer revealed'}</span>
              <h2>{player.displayName}</h2>
              <div className="earned-stamp">
                <strong>{game.round.pointsEarned}</strong>
                <span>points earned</span>
              </div>
              <p>{getCareerSummary(player)}</p>
              {game.round.incorrectGuesses.length > 0 && (
                <div className="review-guesses">
                  <span>Missed guesses</span>
                  <p>{game.round.incorrectGuesses.join(' · ')}</p>
                </div>
              )}
              <button className="primary-button primary-button--large" type="button" onClick={onNext}>
                {game.settings.mode === 'challenge' && game.results.length >= GAME_CONFIG.challengeRounds
                  ? 'See final results'
                  : 'Next player'}{' '}
                <span aria-hidden="true">→</span>
              </button>
            </div>
          ) : (
            <>
              <div className="answer-zone__header">
                <span className="eyebrow">Your call</span>
                <span>Guess · clue · give up</span>
              </div>
              <form onSubmit={handleSubmit}>
                <label htmlFor="player-guess">
                  Guess now <span>· −{GAME_CONFIG.incorrectGuessPenalty} pts per miss</span>
                </label>
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
                      placeholder="Player name"
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
                        aria-label="Player suggestions"
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
                  <button className="primary-button" type="submit">Submit</button>
                </div>
              </form>
              <p className="status-message" role="status" aria-live="polite">
                {game.round.statusMessage || 'Full names, unique surnames and common short names work.'}
              </p>
              <div className="round-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={onReveal}
                  disabled={game.round.clueLevel >= GAME_CONFIG.cluesPerRound}
                >
                  Next clue
                  <span>{game.round.clueLevel >= 5 ? 'All shown' : `${GAME_CONFIG.clueBaseScores[game.round.clueLevel]} pts base`}</span>
                </button>
                <button className="give-up-button" type="button" onClick={onGiveUp}>
                  Give up
                </button>
              </div>
              {game.round.incorrectGuesses.length > 0 && (
                <p className="previous-guesses-inline" aria-label="Incorrect guesses">
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
