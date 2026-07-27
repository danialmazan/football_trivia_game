import { GAME_CONFIG, POOL_LABELS } from '../game/config'
import type { GameState } from '../game/types'

interface ResultsScreenProps {
  game: GameState
  highScore: number
  onPlayAgain: () => void
  onSwitchPool: () => void
}

export function ResultsScreen({ game, highScore, onPlayAgain, onSwitchPool }: ResultsScreenProps) {
  const correct = game.results.filter((result) => result.outcome === 'correct')
  const averageClues = game.results.length
    ? game.results.reduce((sum, result) => sum + result.cluesUsed, 0) / game.results.length
    : 0
  const incorrect = game.results.reduce((sum, result) => sum + result.incorrectGuesses.length, 0)
  const bestRound = Math.max(0, ...game.results.map((result) => result.points))

  return (
    <main className="results-shell">
      <header className="results-hero">
        <span className="eyebrow">Full time · {POOL_LABELS[game.settings.pool]} pool</span>
        <h1>That’s the final whistle.</h1>
        <div className="final-score">
          <strong>{game.totalScore}</strong>
          <span>/ {GAME_CONFIG.challengeRounds * GAME_CONFIG.clueBaseScores[0]}</span>
        </div>
        <p>{game.totalScore >= highScore ? 'New personal best.' : `Personal best: ${highScore}`}</p>
      </header>

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
