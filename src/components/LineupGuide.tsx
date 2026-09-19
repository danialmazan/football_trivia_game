import type { GameSettings } from '../game/types'
import { useI18n } from '../i18n'

interface LineupGuideProps {
  settings: GameSettings
  loading: boolean
  error: string | null
  onBack: () => void
  onConfirm: () => void
  nickname: string
  onNicknameChange: (nickname: string) => void
}

export function LineupGuide({ settings, loading, error, onBack, onConfirm, nickname, onNicknameChange }: LineupGuideProps) {
  const { t, modeLabel, known } = useI18n()
  const daily = settings.mode === 'lineup-daily'
  return (
    <main className="guide-shell lineup-guide-shell">
      <header className="guide-header">
        <button type="button" className="wordmark" onClick={onBack}>LEO <span>GUESSI</span></button>
        <button type="button" className="exit-button" onClick={onBack}>{t('Back')}</button>
      </header>
      <section className="guide-card guide-card--quick lineup-guide-card" aria-labelledby="lineup-guide-title">
        <div className="guide-card__intro">
          <span className="eyebrow">{modeLabel(settings.mode)}</span>
          <h1 id="lineup-guide-title">{t('Quick rules')}</h1>
          <div className="guide-matchup"><span>{modeLabel(settings.mode)}</span></div>
        </div>
        <div className="guide-card__rules-column">
          <div className="guide-rules">
            <article><span className="guide-rule__number">01</span><p>{t("You'll see two starting lineups with one player missing. Guess for 100 points, get the next clue or give up.")}</p></article>
            <article><span className="guide-rule__number">02</span><p>{t('Every missed guess reduces the prize by 20 points.')}</p></article>
            <article><span className="guide-rule__number">03</span><p>{t('The first clue lets you play for 40 points. The initials clue lets you play for 20 points.')}</p></article>
          </div>
          {daily && <div className="guide-daily-note guide-daily-note--stacked"><strong>{t('Same Lineup of the Day and missing player for everyone playing today.')}</strong><span>{t('A new lineup is generated every day at midnight UTC.')}</span></div>}
          <div className="guide-name-field">
            <label htmlFor="lineup-game-nickname">{t('Your name or nickname')}</label>
            <input id="lineup-game-nickname" value={nickname} onChange={(event) => onNicknameChange(event.target.value)} maxLength={24} placeholder={t('Name or nickname')} autoComplete="nickname" />
            <small>{t('Required before the game starts.')}</small>
          </div>
          {error && <p className="guide-error" role="alert">{known(error)}</p>}
          <button className="primary-button primary-button--large guide-confirm" type="button" onClick={onConfirm} disabled={loading}>
            {loading ? t('Loading the teamsheet…') : t("Understood, let's play!")} <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>
    </main>
  )
}
