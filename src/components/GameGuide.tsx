import { GAME_CONFIG } from '../game/config'
import type { GameSettings } from '../game/types'
import { useI18n } from '../i18n'

interface GameGuideProps {
  settings: GameSettings
  loading?: boolean
  error?: string | null
  onBack: () => void
  onConfirm: () => void
}

export function GameGuide({
  settings,
  loading = false,
  error = null,
  onBack,
  onConfirm,
}: GameGuideProps) {
  const { t, modeLabel, poolLabel, known } = useI18n()
  const runLength =
    settings.mode === 'daily'
      ? t('One player')
      : settings.mode === 'challenge' || settings.mode === 'practice'
      ? t('{count} players', { count: GAME_CONFIG.challengeRounds })
      : t('Unlimited players')

  return (
    <main className="guide-shell">
      <header className="guide-header">
        <button type="button" className="wordmark" onClick={onBack}>
          LEO <span>GUESSI</span>
        </button>
        <button type="button" className="exit-button" onClick={onBack}>{t('Back')}</button>
      </header>

      <section className="guide-card" aria-labelledby="guide-title">
        <div className="guide-card__intro">
          <span className="eyebrow">{t('Quick rules · then kick-off')}</span>
          <h1 id="guide-title">
            {settings.mode === 'daily' ? t('One player. One shared fixture.') : t('Know your three moves.')}
          </h1>
          {settings.mode === 'daily' ? (
            <p>{t('{runLength}, with the same clue set for everyone worldwide. It stays live until the next player is selected at 00:00:00 UTC.', { runLength })}</p>
          ) : (
            <p>{t('{runLength}. Five progressively easier clues per player. You can make a guess, request the next clue, or give up at any time.', { runLength })}</p>
          )}
          <div className="guide-matchup">
            <span>{modeLabel(settings.mode)}</span>
            <i aria-hidden="true" />
            <span>{t('{pool} pool', { pool: poolLabel(settings.pool) })}</span>
          </div>
        </div>

        <div className="guide-card__rules-column">
          <div className="guide-rules">
            <article>
              <span className="guide-rule__number">01</span>
              <div>
                <strong>{t('Five clues, hardest first')}</strong>
                <p>{t('Each player starts on clue 1. Request the next clue whenever you need it.')}</p>
              </div>
            </article>
            <article>
              <span className="guide-rule__number">02</span>
              <div>
                <strong>{t('Points fall as help increases')}</strong>
                <p>
                  {t('Clues are worth 100, 80, 60, 40, then 20 points. Every distinct miss costs another 10.')}{' '}
                  {settings.mode === 'daily' ? t('The maximum daily score is 100.') : ''}
                </p>
              </div>
            </article>
            <article>
              <span className="guide-rule__number">03</span>
              <div>
                <strong>{t('Choose one move at any time')}</strong>
                <div className="guide-actions" aria-label={t('Available actions')}>
                  <span>{t('Guess')}</span>
                  <span>{t('Next clue')}</span>
                  <span>{t('Give up')}</span>
                </div>
              </div>
            </article>
          </div>

          {settings.mode === 'daily' && (
            <p className="guide-daily-note">
              {t('The first result submitted under a nickname locks that nickname for today’s player.')}
            </p>
          )}
          {settings.mode === 'challenge' && (
            <p className="guide-daily-note">
              {t('Submit every completed game under the same nickname to keep its challenge history together.')}
            </p>
          )}
          {error && <p className="guide-error" role="alert">{known(error)}</p>}
          <button
            className="primary-button primary-button--large guide-confirm"
            type="button"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? t('Loading today’s player…') : t("Let's go!")} <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>
    </main>
  )
}
