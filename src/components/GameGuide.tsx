import { GAME_CONFIG, MODE_LABELS, POOL_LABELS, PRACTICE_LEAGUES } from '../game/config'
import type { GameSettings } from '../game/types'

interface GameGuideProps {
  settings: GameSettings
  onBack: () => void
  onConfirm: () => void
}

export function GameGuide({ settings, onBack, onConfirm }: GameGuideProps) {
  const runLength =
    settings.mode === 'challenge'
      ? `${GAME_CONFIG.challengeRounds} players`
      : settings.mode === 'practice'
        ? `Unlimited ${
            settings.practiceFilter.kind === 'decade'
              ? settings.practiceFilter.value
              : PRACTICE_LEAGUES[settings.practiceFilter.value]
          } players`
        : 'Unlimited players'

  return (
    <main className="guide-shell">
      <header className="guide-header">
        <button type="button" className="wordmark" onClick={onBack}>
          LEO <span>GUESSI</span>
        </button>
        <button type="button" className="exit-button" onClick={onBack}>Back</button>
      </header>

      <section className="guide-card" aria-labelledby="guide-title">
        <div className="guide-card__intro">
          <span className="eyebrow">Quick rules · then kick-off</span>
          <h1 id="guide-title">Know your three moves.</h1>
          <p>
            {runLength}. Five progressively easier clues per player. You can make a guess,
            request the next clue, or give up at any time.
          </p>
          <div className="guide-matchup">
            <span>{MODE_LABELS[settings.mode]}</span>
            <i aria-hidden="true" />
            <span>{POOL_LABELS[settings.pool]} pool</span>
          </div>
        </div>

        <div className="guide-rules">
          <article>
            <span className="guide-rule__number">01</span>
            <div>
              <strong>Five clues, hardest first</strong>
              <p>Each player starts on clue 1. Request the next clue whenever you need it.</p>
            </div>
          </article>
          <article>
            <span className="guide-rule__number">02</span>
            <div>
              <strong>Points fall as help increases</strong>
              <p>Clues are worth 100, 80, 60, 40, then 20 points. Every distinct miss costs another 10.</p>
            </div>
          </article>
          <article>
            <span className="guide-rule__number">03</span>
            <div>
              <strong>Choose one move at any time</strong>
              <div className="guide-actions" aria-label="Available actions">
                <span>Guess</span>
                <span>Next clue</span>
                <span>Give up</span>
              </div>
            </div>
          </article>
        </div>

        <button className="primary-button primary-button--large guide-confirm" type="button" onClick={onConfirm}>
          Let&apos;s go! <span aria-hidden="true">→</span>
        </button>
      </section>
    </main>
  )
}
