import { GAME_CONFIG } from '../game/config'
import { isValidNickname } from '../game/daily'
import { buildLineupChallengeShareData, getLocalizedGameUrl } from '../game/sharing'
import type { LeaderboardBoards, LineupGameState } from '../game/types'
import { useI18n } from '../i18n'
import { LeaderboardTabs } from './LeaderboardTabs'
import { SavedResultShare } from './SavedResultShare'

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
  const { locale, t, modeLabel, known } = useI18n()
  const correct = game.results.filter((result) => result.outcome === 'correct').length
  const misses = game.results.reduce((sum, result) => sum + result.incorrectGuesses.length, 0)
  const firstTry = game.results.filter((result) => result.outcome === 'correct' && result.incorrectGuesses.length === 0).length
  return (
    <main className="results-shell lineup-results-shell">
      <header className="results-hero">
        <button className="wordmark results-wordmark" type="button" onClick={onHome}>LEO <span>GUESSI</span></button>
        <span className="eyebrow">{t('Full time')} · {modeLabel('lineup-challenge')}</span>
        <h1>{t('Ten teamsheets completed.')}</h1>
        <div className="final-score"><strong>{game.totalScore}</strong><span>/ {GAME_CONFIG.challengeRounds * 100}</span></div>
        <p>{game.totalScore >= highScore ? t('New personal lineup best.') : t('Personal lineup best: {score}', { score: highScore })}</p>
      </header>
      <section className={`claim-place ${submitted ? 'claim-place--submitted' : ''}`}>
        <div className="claim-place__marker" aria-hidden="true">XI</div>
        <div className="claim-place__copy"><span className="eyebrow">{submitted ? t('Score saved.') : t('Save your game')}</span><h2>{submitted ? t('Lineup history updated.') : t('Put it on the board.')}</h2><p>{submitted ? t('This game now counts toward your lineup challenge history.') : t('Enter your nickname to save this game and view the lineup leaderboards.')}</p></div>
        {!submitted && <form className="claim-place__form" onSubmit={(event) => { event.preventDefault(); onSubmit() }}><label htmlFor="lineup-challenge-nickname">{t('Public nickname')}</label><div><input id="lineup-challenge-nickname" value={nickname} onChange={(event) => onNicknameChange(event.target.value)} maxLength={24} placeholder={t('Name or nickname')} autoComplete="nickname" /><button className="primary-button" type="submit" disabled={submitting || !isValidNickname(nickname)}>{submitting ? t('Saving…') : t('Save score & view boards')}</button></div>{error && <p className="daily-service-error" role="alert">{known(error)}</p>}</form>}
      </section>
      {submitted && boards && <><div className="claim-place__saved-actions"><SavedResultShare data={buildLineupChallengeShareData({ points: game.totalScore, identified: correct, url: getLocalizedGameUrl(locale), locale })} /><button className="text-button" type="button" onClick={onRefresh} disabled={submitting}>{submitting ? t('Refreshing…') : t('Refresh leaderboards')}</button></div><LeaderboardTabs mode="lineup-challenge" boards={boards} currentNickname={nickname} /></>}
      <section className="result-stats" aria-label={t('Lineup game statistics')}><div><strong>{correct}</strong><span>{t('Identified')}</span></div><div><strong>{firstTry}</strong><span>{t('First try')}</span></div><div><strong>{misses}</strong><span>{t('Wrong guesses')}</span></div><div><strong>{Math.max(0, ...game.results.map((result) => result.points))}</strong><span>{t('Best round')}</span></div></section>
      <section className="round-recap"><div className="section-heading"><div><span className="eyebrow">{t('Teamsheet log')}</span><h2>{t('Round by round')}</h2></div></div><div className="recap-table" role="table" aria-label={t('Lineup round results')}><div className="recap-row recap-row--head" role="row"><span>{t('Rnd')}</span><span>{t('Match')}</span><span>{t('Player')}</span><span>{t('Misses · clues')}</span><span>Pts</span></div>{game.results.map((result, index) => <div className="recap-row" role="row" key={`${result.matchId}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><strong>{result.matchLabel}</strong><span>{result.playerName}</span><span>{result.incorrectGuesses.length} · {result.cluesUsed}</span><b>{result.points}</b></div>)}</div></section>
      <div className="results-actions"><button className="primary-button primary-button--large" type="button" onClick={onPlayAgain}>{t('Play again')}</button><button className="secondary-button" type="button" onClick={onHome}>{t('Back to home page')}</button></div>
    </main>
  )
}
