import { useEffect, useRef, useState } from 'react'
import type { LineupMatch } from '../data/lineupTypes'
import type { SearchPlayer } from '../data/types'
import { getPlayerSuggestions } from '../game/answerMatching'
import { GAME_CONFIG, MODE_LABELS } from '../game/config'
import { isValidNickname } from '../game/daily'
import { calculateLineupScore } from '../game/lineups'
import type { LineupGameState } from '../game/types'
import { LineupPitch } from './LineupPitch'

interface LineupGameScreenProps {
  game: LineupGameState
  match: LineupMatch
  missingPlayer: SearchPlayer
  search: SearchPlayer[]
  onSubmit: (guess: string) => void
  onGiveUp: () => void
  onClue: () => void
  onNext: () => void
  onExit: () => void
  nickname: string
  submitting: boolean
  error: string | null
  onNicknameChange: (nickname: string) => void
  onDailySubmit: () => void
}

function shouldAutoFocusGuess(): boolean {
  return window.matchMedia('(min-width: 781px) and (pointer: fine)').matches
}

function timezoneLabel(date: string, timezone: string): string {
  const part = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    timeZoneName: 'short',
  }).formatToParts(new Date(`${date}T12:00:00Z`)).find((item) => item.type === 'timeZoneName')?.value
  return part ? `${part} (${timezone})` : timezone
}

export function LineupGameScreen({
  game,
  match,
  missingPlayer,
  search,
  onSubmit,
  onGiveUp,
  onClue,
  onNext,
  onExit,
  nickname,
  submitting,
  error,
  onNicknameChange,
  onDailySubmit,
}: LineupGameScreenProps) {
  const [guess, setGuess] = useState('')
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const review = game.phase === 'review'
  const daily = game.mode === 'lineup-daily'
  const suggestions = getPlayerSuggestions(guess, search)
  const showSuggestions = suggestionsOpen && suggestions.length > 0
  const roundNumber = game.results.length + (review ? 0 : 1)
  const available = calculateLineupScore(
    game.round.incorrectGuesses.length,
    game.round.cluesUsed,
    game.round.clueIncorrectGuessCounts,
  )
  const missingStarter = match.teams
    .flatMap((team) => team.starters)
    .find((player) => player.id === game.round.missingPlayerId)
  const primaryClueLabel = match.competition === 'ucl' ? 'Nationality' : 'Most-played club that season'
  const primaryClue = match.competition === 'ucl' ? missingStarter?.nationality : missingStarter?.seasonClub
  const initials = missingPlayer.displayName
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toLocaleUpperCase()}.`)
    .join('')
  const stageLabel = match.stage.replace('Semi-final', 'Semi-Final').replace(' · ', ' - ')
  const tournamentLabel = match.competition === 'ucl'
    ? 'UCL'
    : match.competition === 'euro' ? 'UEFA EURO' : 'FIFA World Cup'
  const editionLabel = match.competition === 'ucl'
    ? match.edition
    : match.edition.replace(/^EURO\s+/, '').replace(/^World Cup\s+/, '')

  useEffect(() => {
    setGuess('')
    setSuggestionsOpen(false)
    setActiveSuggestion(-1)
    if (!review && shouldAutoFocusGuess()) inputRef.current?.focus()
  }, [game.round.matchId, review])

  function selectSuggestion(player: SearchPlayer) {
    setGuess(player.displayName)
    setSuggestionsOpen(false)
    setActiveSuggestion(-1)
    inputRef.current?.focus()
  }

  function submit(event: React.FormEvent) {
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

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setSuggestionsOpen(false)
      setActiveSuggestion(-1)
    } else if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && suggestions.length) {
      event.preventDefault()
      setSuggestionsOpen(true)
      setActiveSuggestion((current) =>
        event.key === 'ArrowDown'
          ? current >= suggestions.length - 1 ? 0 : current + 1
          : current <= 0 ? suggestions.length - 1 : current - 1,
      )
    } else if (event.key === 'Enter' && showSuggestions && activeSuggestion >= 0) {
      event.preventDefault()
      selectSuggestion(suggestions[activeSuggestion])
    }
  }

  return (
    <main className="lineup-game-shell">
      <header className="game-header">
        <button className="wordmark" type="button" onClick={onExit}>LEO <span>GUESSI</span></button>
        <div className="game-header__meta"><span>{MODE_LABELS[game.mode]}</span><i aria-hidden="true" /><span>{match.competitionLabel}</span></div>
        <button className="exit-button" type="button" onClick={onExit}>Exit</button>
      </header>

      <section className="game-scorebar lineup-scorebar" aria-label="Lineup game status">
        <div><span>{daily ? 'Today’s lineup' : 'Progress'}</span><strong>{daily ? '1 / 1' : `${Math.max(1, roundNumber)} / ${GAME_CONFIG.challengeRounds}`}</strong></div>
        <div className="game-scorebar__available"><span>{review ? 'Round score' : 'Available now'}</span><div className="scorebar-points"><strong data-testid="lineup-available-score">{review ? game.round.pointsEarned : available}</strong><em>PTS</em></div></div>
        <div><span>Game score</span><strong data-testid="lineup-total-score">{game.totalScore}</strong></div>
      </section>

      <section className="lineup-match-card">
        <div className="lineup-match-card__competition" data-testid="lineup-competition-label">
          {editionLabel} - {tournamentLabel} {stageLabel}
        </div>
        <h1>{match.homeTeam.name} <span>vs</span> {match.awayTeam.name}</h1>
        <p><time dateTime={match.date}>{new Date(`${match.date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</time><i />{match.kickoffLocal} {timezoneLabel(match.date, match.timezone)}<i />{match.venue}</p>
      </section>

      <div className={`lineup-game-layout ${review ? 'lineup-game-layout--review' : ''}`}>
        <LineupPitch match={match} missingPlayerId={game.round.missingPlayerId} revealed={review} />
        <aside className="lineup-answer-zone">
          {review ? (
            <div className="answer-reveal lineup-answer-reveal" data-testid="lineup-answer-reveal">
              <span className="eyebrow">{game.round.outcome === 'correct' ? 'Starter identified.' : 'Missing player revealed'}</span>
              <h2>{missingPlayer.displayName}</h2>
              <p>{match.homeTeam.name} vs {match.awayTeam.name} · {match.edition}</p>
              <div className="earned-stamp"><strong>{game.round.pointsEarned}</strong><span>points earned</span></div>
              {game.round.incorrectGuesses.length > 0 && <div className="review-guesses"><span>Missed guesses</span><p>{game.round.incorrectGuesses.join(' · ')}</p></div>}
              {daily ? (
                <form className="daily-submit" onSubmit={(event) => { event.preventDefault(); onDailySubmit() }}>
                  <label htmlFor="lineup-daily-nickname">Enter your nickname to save this result and unlock Guess the lineup leaderboards.<span>Your nickname is public and can submit once today.</span></label>
                  <div className="daily-submit__row">
                    <input id="lineup-daily-nickname" value={nickname} onChange={(event) => onNicknameChange(event.target.value)} maxLength={24} placeholder="Name or nickname" autoComplete="nickname" />
                    <button className="primary-button" type="submit" disabled={submitting || !isValidNickname(nickname)}>{submitting ? 'Saving…' : 'Save score'}</button>
                  </div>
                  <small>Use the same nickname every time for your stats history to stay together.</small>
                  {error && <p className="daily-service-error" role="alert">{error}</p>}
                </form>
              ) : (
                <button className="primary-button primary-button--large" type="button" onClick={onNext}>{game.results.length >= GAME_CONFIG.challengeRounds ? 'See final results' : 'Next lineup'} <span aria-hidden="true">→</span></button>
              )}
            </div>
          ) : (
            <>
              <div className="answer-zone__header"><span className="eyebrow">The blank shirt</span><span>Guess · give up</span></div>
              <form onSubmit={submit}>
                <label htmlFor="lineup-player-guess">Who is missing? <span>· −{GAME_CONFIG.lineupWrongGuessPenalty} pts per miss</span></label>
                <div className="guess-row">
                  <div className="player-autocomplete">
                    <input id="lineup-player-guess" ref={inputRef} value={guess} onChange={(event) => { setGuess(event.target.value); setSuggestionsOpen(true); setActiveSuggestion(-1) }} onFocus={() => setSuggestionsOpen(true)} onBlur={() => setSuggestionsOpen(false)} onKeyDown={onKeyDown} placeholder="Player name" autoComplete="off" spellCheck="false" role="combobox" aria-autocomplete="list" aria-expanded={showSuggestions} aria-controls="lineup-player-suggestions" aria-activedescendant={showSuggestions && activeSuggestion >= 0 ? `lineup-player-suggestion-${suggestions[activeSuggestion].id}` : undefined} />
                    {showSuggestions && <ul className="player-suggestions" id="lineup-player-suggestions" role="listbox" aria-label="Lineup player suggestions">{suggestions.map((player, index) => <li className={index === activeSuggestion ? 'player-suggestion is-active' : 'player-suggestion'} id={`lineup-player-suggestion-${player.id}`} key={player.id} role="option" aria-selected={index === activeSuggestion} onMouseDown={(event) => event.preventDefault()} onClick={() => selectSuggestion(player)}><small aria-hidden="true">{String(index + 1).padStart(2, '0')}</small><span>{player.displayName}</span></li>)}</ul>}
                  </div>
                  <button className="primary-button" type="submit">Submit</button>
                </div>
              </form>
              {game.round.statusMessage && <p className="guess-feedback" role="status">{game.round.statusMessage}</p>}
              {game.round.incorrectGuesses.length > 0 && <div className="previous-guesses-inline"><span>Previous guesses</span><p>{game.round.incorrectGuesses.join(' · ')}.</p></div>}
              <div className="lineup-clues" aria-label="Lineup clues">
                {game.round.cluesUsed >= 1 && (
                  <div className="lineup-clue" data-testid="lineup-primary-clue"><span>{primaryClueLabel}</span><strong>{primaryClue}</strong></div>
                )}
                {game.round.cluesUsed >= 2 && (
                  <div className="lineup-clue" data-testid="lineup-initials-clue"><span>Player initials</span><strong>{initials}</strong></div>
                )}
                {game.round.cluesUsed < 2 && (
                  <button className="lineup-clue-button" type="button" onClick={onClue}>
                    {game.round.cluesUsed === 0
                      ? `Get ${match.competition === 'ucl' ? 'nationality' : 'club'} clue — max 40 pts`
                      : 'Get initials clue — max 20 pts'}
                  </button>
                )}
              </div>
              <button className="give-up-button" type="button" onClick={onGiveUp}>Give up and reveal</button>
            </>
          )}
        </aside>
      </div>
    </main>
  )
}
