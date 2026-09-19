import type { GameSettings } from '../game/types'
import { useI18n } from '../i18n'

interface GameGuideProps {
  settings: GameSettings
  loading?: boolean
  error?: string | null
  onBack: () => void
  onConfirm: () => void
  nickname: string
  onNicknameChange: (nickname: string) => void
}

export function GameGuide({ settings, loading = false, error = null, onBack, onConfirm, nickname, onNicknameChange }: GameGuideProps) {
  const { t, modeLabel, poolLabel, known } = useI18n()
  const daily = settings.mode === 'daily'

  return (
    <main className="guide-shell">
      <header className="guide-header">
        <button type="button" className="wordmark" onClick={onBack}>LEO <span>GUESSI</span></button>
        <button type="button" className="exit-button" onClick={onBack}>{t('Back')}</button>
      </header>
      <section className="guide-card guide-card--quick" aria-labelledby="guide-title">
        <div className="guide-card__intro">
          <span className="eyebrow">{modeLabel(settings.mode)}</span>
          <h1 id="guide-title">{t('Quick rules')}</h1>
          <div className="guide-matchup"><span>{modeLabel(settings.mode)}</span><i aria-hidden="true" /><span>{t('{pool} pool', { pool: poolLabel(settings.pool) })}</span></div>
        </div>
        <div className="guide-card__rules-column">
          <div className="guide-rules">
            <article><span className="guide-rule__number">01</span><p>{t("You'll get the first clue. You can choose to guess for 100 points, get the next clue or give up.")}</p></article>
            <article><span className="guide-rule__number">02</span><p>{t('Every missed guess reduces the prize by 10 points.')}</p></article>
            <article><span className="guide-rule__number">03</span><p>{t('Every clue requested reduces the prize by 20 points.')}</p></article>
          </div>
          {daily && <div className="guide-daily-note guide-daily-note--stacked"><strong>{t('Same Player of the Day and clue set for everyone playing today.')}</strong><span>{t('A new player is generated every day at midnight UTC.')}</span></div>}
          <div className="guide-name-field">
            <label htmlFor="game-nickname">{t('Your name or nickname')}</label>
            <input id="game-nickname" value={nickname} onChange={(event) => onNicknameChange(event.target.value)} maxLength={24} placeholder={t('Name or nickname')} autoComplete="nickname" />
            <small>{t('Required before the game starts.')}</small>
          </div>
          {error && <p className="guide-error" role="alert">{known(error)}</p>}
          <button className="primary-button primary-button--large guide-confirm" type="button" onClick={onConfirm} disabled={loading}>
            {loading ? t('Loading today’s player…') : t("Understood, let's play!")} <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>
    </main>
  )
}
