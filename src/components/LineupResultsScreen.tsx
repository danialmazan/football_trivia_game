import { GAME_CONFIG } from '../game/config'
import { isValidNickname } from '../game/daily'
import type { LeaderboardBoards, LineupGameState } from '../game/types'
import { LeaderboardTabs } from './LeaderboardTabs'
import { SavedResultShare } from './SavedResultShare'
import { buildLineupChallengeShareData, getGameUrl } from '../game/sharing'

interface LineupResultsScreenProps {
  game: LineupGameState
  highScore: number
  nickname: string
  submitting: boolean
  submitted: boolean
  error: string | null
  boards: LeaderboardBoards | null
  onNicknameChange: (nickname: string) => void
  onSubmit: () => void
  onRefresh: () => void
  onPlayAgain: () => void
  onHome: () => void
}

export function LineupResultsScreen(props: LineupResultsScreenProps) {
  const { game, highScore, nickname, submitting, submitted, error, boards, onNicknameChange, onSubmit, onRefresh, onPlayAgain, onHome } = props
  const correct = game.results.filter((result) => result.outcome === 'correct').length
  const misses = game.results.reduce((sum, result) => sum + result.incorrectGuesses.length, 0)
  const firstTry = game.results.filter((result) => result.outcome === 'correct' && result.incorrectGuesses.length === 0).length
  return (
    <main className="results-shell lineup-results-shell">
      <header className="results-hero"><button className="wordmark results-wordmark" type="button" onClick={onHome}>LEO <span>GUESSI</span></button><span className="eyebrow">Full time · 10-round lineup challenge</span><h1>Ten teamsheets completed.</h1><div className="final-score"><strong>{game.totalScore}</strong><span>/ {GAME_CONFIG.challengeRounds * 100}</span></div><p>{game.totalScore >= highScore ? 'New personal lineup best.' : `Personal lineup best: ${highScore}`}</p></header>
      <section className={`claim-place ${submitted ? 'claim-place--submitted' : ''}`}><div className="claim-place__marker" aria-hidden="true">XI</div><div className="claim-place__copy"><span className="eyebrow">{submitted ? 'Score saved.' : 'Save your game'}</span><h2>{submitted ? 'Lineup history updated.' : 'Put it on the board.'}</h2><p>{submitted ? 'This game now counts toward your lineup challenge history.' : 'Enter your nickname to save this game and view the lineup leaderboards.'}</p></div>{!submitted ? <form className="claim-place__form" onSubmit={(event) => { event.preventDefault(); onSubmit() }}><label htmlFor="lineup-challenge-nickname">Public nickname</label><div><input id="lineup-challenge-nickname" value={nickname} onChange={(event) => onNicknameChange(event.target.value)} maxLength={24} placeholder="Name or nickname" autoComplete="nickname" /><button className="primary-button" type="submit" disabled={submitting || !isValidNickname(nickname)}>{submitting ? 'Saving…' : 'Save score & view boards'}</button></div>{error && <p className="daily-service-error" role="alert">{error}</p>}</form> : <button className="text-button" type="button" onClick={onRefresh} disabled={submitting}>{submitting ? 'Refreshing…' : 'Refresh leaderboards'}</button>}</section>
      {submitted && boards && <><div className="claim-place__saved-actions"><SavedResultShare data={buildLineupChallengeShareData({ points: game.totalScore, identified: correct, url: getGameUrl() })} /><button className="text-button" type="button" onClick={onRefresh} disabled={submitting}>{submitting ? 'Refreshing…' : 'Refresh leaderboards'}</button></div><LeaderboardTabs mode="lineup-challenge" boards={boards} currentNickname={nickname} /></>}
      <section className="result-stats" aria-label="Lineup game statistics"><div><strong>{correct}</strong><span>Identified</span></div><div><strong>{firstTry}</strong><span>First try</span></div><div><strong>{misses}</strong><span>Wrong guesses</span></div><div><strong>{Math.max(0, ...game.results.map((result) => result.points))}</strong><span>Best round</span></div></section>
      <section className="round-recap"><div className="section-heading"><div><span className="eyebrow">Teamsheet log</span><h2>Round by round</h2></div></div><div className="recap-table" role="table" aria-label="Lineup round results"><div className="recap-row recap-row--head" role="row"><span>Rnd</span><span>Match</span><span>Player</span><span>Misses · clues</span><span>Pts</span></div>{game.results.map((result, index) => <div className="recap-row" role="row" key={`${result.matchId}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><strong>{result.matchLabel}</strong><span>{result.playerName}</span><span>{result.incorrectGuesses.length} · {result.cluesUsed}</span><b>{result.points}</b></div>)}</div></section>
      <div className="results-actions"><button className="primary-button primary-button--large" type="button" onClick={onPlayAgain}>Play again</button><button className="secondary-button" type="button" onClick={onHome}>Back to home page</button></div>
    </main>
  )
}
