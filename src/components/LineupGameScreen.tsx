import { useEffect, useRef, useState } from 'react'
import type { LineupMatch } from '../data/lineupTypes'
import type { SearchPlayer } from '../data/types'
import { getPlayerSuggestions } from '../game/answerMatching'
import { GAME_CONFIG } from '../game/config'
import { calculateLineupScore } from '../game/lineups'
import type { LineupGameState } from '../game/types'
import { LineupPitch } from './LineupPitch'
import { useI18n } from '../i18n'

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
  submitting: boolean
  error: string | null
  onDailyRetry: () => void
}

function shouldAutoFocusGuess(): boolean {
  return window.matchMedia('(min-width: 781px) and (pointer: fine)').matches
}

function timezoneLabel(date: string, timezone: string, locale: string): string {
  const part = new Intl.DateTimeFormat(locale, {
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
  submitting,
  error,
  onDailyRetry,
}: LineupGameScreenProps) {
  const { locale, t, modeLabel, term, country, feedback, known } = useI18n()
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
  const primaryClueLabel = match.competition === 'ucl' ? t('Nationality') : t('Most-played club that season')
  const primaryClue = match.competition === 'ucl' && missingStarter?.nationality
    ? country(missingStarter.nationality)
    : missingStarter?.seasonClub
  const initials = missingPlayer.displayName
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toLocaleUpperCase()}.`)
    .join('')
  const stageLabel = term(match.stage)
    .replace(locale === 'en' ? 'Semi-final' : 'Semifinal', locale === 'en' ? 'Semi-Final' : 'Semifinal')
    .replace(' · ', ' - ')
  const tournamentLabel = match.competition === 'ucl'
    ? 'UCL'
    : match.competition === 'euro' ? 'UEFA EURO' : term('FIFA World Cup')
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
        <div className="game-header__meta"><span>{modeLabel(game.mode)}</span><i aria-hidden="true" /><span>{term(match.competitionLabel)}</span></div>
        <button className="exit-button" type="button" onClick={onExit}>{t('Exit')}</button>
      </header>

      <section className="game-scorebar lineup-scorebar" aria-label={t('Lineup game status')}>
        <div><span>{daily ? t('Today’s lineup') : t('Progress')}</span><strong>{daily ? '1 / 1' : `${Math.max(1, roundNumber)} / ${GAME_CONFIG.challengeRounds}`}</strong></div>
        <div className="game-scorebar__available"><span>{review ? t('Round score') : t('Available now')}</span><div className="scorebar-points"><strong data-testid="lineup-available-score">{review ? game.round.pointsEarned : available}</strong><em>PTS</em></div></div>
        <div><span>{t('Game score')}</span><strong data-testid="lineup-total-score">{game.totalScore}</strong></div>
      </section>

      <section className="lineup-match-card">
        <div className="lineup-match-card__competition" data-testid="lineup-competition-label">
          {editionLabel} - {tournamentLabel} {stageLabel}
        </div>
        <h1>{match.homeTeam.name} <span>vs</span> {match.awayTeam.name}</h1>
        <p><time dateTime={match.date}>{new Date(`${match.date}T12:00:00Z`).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</time><i />{match.kickoffLocal} {timezoneLabel(match.date, match.timezone, locale === 'es' ? 'es-ES' : 'en-GB')}<i />{match.venue}</p>
      </section>

      <div className={`lineup-game-layout ${review ? 'lineup-game-layout--review' : ''}`}>
        <LineupPitch match={match} missingPlayerId={game.round.missingPlayerId} revealed={review} />
        <aside className="lineup-answer-zone">
          {review ? (
            <div className="answer-reveal lineup-answer-reveal" data-testid="lineup-answer-reveal">
              <span className="eyebrow">{game.round.outcome === 'correct' ? t('Starter identified.') : t('Missing player revealed')}</span>
              <h2>{missingPlayer.displayName}</h2>
              <p>{match.homeTeam.name} vs {match.awayTeam.name} · {match.edition}</p>
              <div className="earned-stamp"><strong>{game.round.pointsEarned}</strong><span>{t('points earned')}</span></div>
              {game.round.incorrectGuesses.length > 0 && <div className="review-guesses"><span>{t('Missed guesses')}</span><p>{game.round.incorrectGuesses.join(' · ')}</p></div>}
              {daily ? (
                <div className="daily-submit" role="status"><strong>{submitting ? t('Saving…') : t('Waiting to sync')}</strong><span>{t('Your score is saved automatically when this round ends.')}</span>{error && <p className="daily-service-error">{known(error)}</p>}{error && <button className="primary-button" type="button" onClick={onDailyRetry}>{t('Retry')}</button>}</div>
              ) : (
                <button className="primary-button primary-button--large" type="button" onClick={onNext}>{game.results.length >= GAME_CONFIG.challengeRounds ? t('See final results') : t('Next lineup')} <span aria-hidden="true">→</span></button>
              )}
            </div>
          ) : (
            <>
              <div className="answer-zone__header"><span className="eyebrow">{t('Guess now, next clue or give up')}</span></div>
              <form onSubmit={submit}>
                <label htmlFor="lineup-player-guess">{t('Player name')}</label>
                <div className="guess-row">
                  <div className="player-autocomplete">
                    <input id="lineup-player-guess" ref={inputRef} value={guess} onChange={(event) => { setGuess(event.target.value); setSuggestionsOpen(true); setActiveSuggestion(-1) }} onFocus={() => setSuggestionsOpen(true)} onBlur={() => setSuggestionsOpen(false)} onKeyDown={onKeyDown} placeholder={t('Player name')} autoComplete="off" spellCheck="false" role="combobox" aria-autocomplete="list" aria-expanded={showSuggestions} aria-controls="lineup-player-suggestions" aria-activedescendant={showSuggestions && activeSuggestion >= 0 ? `lineup-player-suggestion-${suggestions[activeSuggestion].id}` : undefined} />
                    {showSuggestions && <ul className="player-suggestions" id="lineup-player-suggestions" role="listbox" aria-label={t('Lineup player suggestions')}>{suggestions.map((player, index) => <li className={index === activeSuggestion ? 'player-suggestion is-active' : 'player-suggestion'} id={`lineup-player-suggestion-${player.id}`} key={player.id} role="option" aria-selected={index === activeSuggestion} onMouseDown={(event) => event.preventDefault()} onClick={() => selectSuggestion(player)}><small aria-hidden="true">{String(index + 1).padStart(2, '0')}</small><span>{player.displayName}</span></li>)}</ul>}
                  </div>
                  <button className="primary-button" type="submit">{t('Submit')}</button>
                </div>
              </form>
              {game.round.statusMessage && <p className="guess-feedback" role="status">{feedback(game.round.statusMessage)}</p>}
              {game.round.incorrectGuesses.length > 0 && <div className="previous-guesses-inline"><span>{t('Previous guesses')}</span><p>{game.round.incorrectGuesses.join(' · ')}.</p></div>}
              <div className="lineup-clues" aria-label={t('Lineup clues')}>
                {game.round.cluesUsed >= 1 && (
                  <div className="lineup-clue" data-testid="lineup-primary-clue"><span>{primaryClueLabel}</span><strong>{primaryClue}</strong></div>
                )}
                {game.round.cluesUsed >= 2 && (
                  <div className="lineup-clue" data-testid="lineup-initials-clue"><span>{t('Player initials')}</span><strong>{initials}</strong></div>
                )}
                {game.round.cluesUsed < 2 && (
                  <button className="lineup-clue-button" type="button" onClick={onClue}>
                    {game.round.cluesUsed === 0
                      ? t(match.competition === 'ucl' ? 'Next clue — and play for 40 pts' : 'Next clue — and play for 40 pts')
                      : t('Next clue — and play for 20 pts')}
                  </button>
                )}
              </div>
              <button className="give-up-button" type="button" onClick={onGiveUp}>{t('Give up')}</button>
            </>
          )}
        </aside>
      </div>
    </main>
  )
}
