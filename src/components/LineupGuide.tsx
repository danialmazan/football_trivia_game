import { GAME_CONFIG } from '../game/config'
import type { GameSettings } from '../game/types'
import { useI18n } from '../i18n'

interface LineupGuideProps {
  settings: GameSettings
  loading: boolean
  error: string | null
  onBack: () => void
  onConfirm: () => void
}

export function LineupGuide({ settings, loading, error, onBack, onConfirm }: LineupGuideProps) {
  const { t, modeLabel, known } = useI18n()
  const daily = settings.mode === 'lineup-daily'
  return (
    <main className="guide-shell lineup-guide-shell">
      <header className="guide-header">
        <button type="button" className="wordmark" onClick={onBack}>LEO <span>GUESSI</span></button>
        <button type="button" className="exit-button" onClick={onBack}>{t('Back')}</button>
      </header>
      <section className="guide-card lineup-guide-card" aria-labelledby="lineup-guide-title">
        <div className="guide-card__intro">
          <span className="eyebrow">{t('Historic teamsheet · one blank shirt')}</span>
          <h1 id="lineup-guide-title">{t('Read the shape. Find the missing starter.')}</h1>
          <p>
            {daily
              ? t('One match and one missing player shared worldwide until 00:00:00 UTC.')
              : t('{count} different semifinal or final lineups from the Champions League, EURO or World Cup.', { count: GAME_CONFIG.challengeRounds })}
          </p>
          <div className="guide-matchup"><span>{modeLabel(settings.mode)}</span><i aria-hidden="true" /><span>{t('{count} matches', { count: GAME_CONFIG.lineupActiveMatchCount })}</span></div>
        </div>
        <div className="guide-card__rules-column">
          <div className="guide-rules">
            <article><span className="guide-rule__number">01</span><div><strong>{t('Both XIs, one shared pitch')}</strong><p>{t('The actual starting formations face each other. The highlighted question mark is the only missing player.')}</p></div></article>
            <article><span className="guide-rule__number">02</span><div><strong>{t('100 points on the board')}</strong><p>{t('Each distinct wrong guess costs {points} points. At zero you can still identify the player.', { points: GAME_CONFIG.lineupWrongGuessPenalty })}</p></div></article>
            <article><span className="guide-rule__number">03</span><div><strong>{t('Two optional clues')}</strong><p>{t('Reveal the player’s nationality in UCL games, or their most-played club that season in EURO and World Cup games, for a maximum of 40 points. Initials cap the round at 20.')}</p><div className="guide-actions"><span>{t('Guess')}</span><span>{t('2 clues')}</span><span>{t('Give up')}</span></div></div></article>
          </div>
          {daily && <p className="guide-daily-note">{t('Complete the lineup and save a public nickname to unlock the Guess the lineup leaderboards.')}</p>}
          {error && <p className="guide-error" role="alert">{known(error)}</p>}
          <button className="primary-button primary-button--large guide-confirm" type="button" onClick={onConfirm} disabled={loading}>
            {loading ? t('Loading the teamsheet…') : t("Let's go!")} <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>
    </main>
  )
}
