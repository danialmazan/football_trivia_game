import type { Player } from '../data/types'
import {
  DECADES,
  GAME_CONFIG,
} from '../game/config'
import { getActivePool } from '../game/selection'
import type { GameSettings, PracticeLeague, SavedData } from '../game/types'
import { GoatCrest } from './GoatCrest'
import { useI18n } from '../i18n'

interface SetupScreenProps {
  settings: GameSettings
  savedData: SavedData
  players: Player[]
  onSettingsChange: (settings: GameSettings) => void
  onStart: (settings?: GameSettings) => void
  onResume: () => void
  onResumeLineup: () => void
  onOpenLeaderboard: () => void
}

export function SetupScreen({
  settings,
  savedData,
  players,
  onSettingsChange,
  onStart,
  onResume,
  onResumeLineup,
  onOpenLeaderboard,
}: SetupScreenProps) {
  const { t, modeLabel, poolLabel, leagueLabel } = useI18n()
  const isLineupMode = settings.mode === 'lineup-daily' || settings.mode === 'lineup-challenge'
  const isDailyMode = settings.mode === 'daily' || settings.mode === 'lineup-daily'
  const filter = settings.mode === 'practice' ? settings.practiceFilter : undefined
  const effectivePool = settings.mode === 'daily' ? 'normal' : settings.pool
  const poolCount = isLineupMode ? GAME_CONFIG.lineupActiveMatchCount : getActivePool(players, effectivePool, filter).length

  function selectMode(mode: GameSettings['mode']) {
    const nextSettings: GameSettings = {
      ...settings,
      mode,
      pool: mode === 'daily' ? 'normal' : settings.pool,
    }
    onSettingsChange(nextSettings)
    if (mode === 'daily' || mode === 'lineup-daily') onStart(nextSettings)
  }

  return (
    <main className="setup-shell">
      <section className="hero" aria-labelledby="game-title">
        <div className="hero__kicker">
          <span>{t('European football knowledge test')}</span>
        </div>
        <div className="hero__brand">
          <h1 id="game-title">
            Leo
            <span>Guessi.</span>
          </h1>
          <div className="hero__crest">
            <GoatCrest />
          </div>
        </div>
        <p className="hero__lead">{t('Can you become the G.O.A.T. of player guessing?')}</p>
      </section>

      <section className="setup-panel" aria-label={t('Game setup')}>
        <div className="game-section-heading">
          <span className="eyebrow">{t('Play today')}</span>
          <h2>{t('Daily games')}</h2>
        </div>
        <div className="choice-grid choice-grid--daily">
          {(['daily', 'lineup-daily'] as const).map((mode) => (
            <button
              type="button"
              className="choice-card choice-card--daily"
              key={mode}
              onClick={() => selectMode(mode)}
            >
              <span>{modeLabel(mode)}</span>
              <small>
                {mode === 'daily'
                  ? t('A player each day. Same for everyone.')
                  : t('One missing starter. Same for everyone.')}
              </small>
              <b aria-hidden="true">↗</b>
            </button>
          ))}
        </div>

        <div className="game-section-heading game-section-heading--more">
          <span className="eyebrow">{t('Want more more guessing?')}</span>
          <h2>{t('More games')}</h2>
        </div>
        <div className="choice-grid choice-grid--more" id="more-game-formats">
          {(['challenge', 'lineup-challenge', 'endless', 'practice'] as const).map((mode) => (
            <button
              type="button"
              className={`choice-card ${settings.mode === mode ? 'choice-card--active' : ''}`}
              aria-pressed={settings.mode === mode}
              key={mode}
              onClick={() => selectMode(mode)}
            >
              <span>{t(
                mode === 'challenge' ? 'Guess the player — 10-round challenge'
                  : mode === 'lineup-challenge' ? 'Guess the lineup — 10-round challenge'
                    : mode === 'endless' ? 'Guess the player — endless mode'
                      : 'Guess the player — by decade/league',
              )}</span>
            </button>
          ))}
        </div>

        <button className="setup-leaderboard-button" type="button" onClick={onOpenLeaderboard}>
          {t('Check the leaderboard')} <span aria-hidden="true">↗</span>
        </button>

        {!isDailyMode && settings.mode === 'practice' && (
          <div className="practice-builder">
            <div className="practice-kind" aria-label={t('Practice filter type')}>
              <button
                type="button"
                className={settings.practiceFilter.kind === 'decade' ? 'active' : ''}
                onClick={() =>
                  onSettingsChange({
                    ...settings,
                    practiceFilter: { kind: 'decade', value: '2010s' },
                  })
                }
              >
                {t('By decade')}
              </button>
              <button
                type="button"
                className={settings.practiceFilter.kind === 'league' ? 'active' : ''}
                onClick={() =>
                  onSettingsChange({
                    ...settings,
                    practiceFilter: { kind: 'league', value: 'GB1' },
                  })
                }
              >
                {t('By league')}
              </button>
            </div>
            <div className="decade-row" aria-label={t('Practice selection')}>
              {settings.practiceFilter.kind === 'decade'
                ? DECADES.map((decade) => (
                    <button
                      type="button"
                      key={decade}
                      aria-pressed={settings.practiceFilter.value === decade}
                      className={settings.practiceFilter.value === decade ? 'active' : ''}
                      onClick={() =>
                        onSettingsChange({
                          ...settings,
                          practiceFilter: { kind: 'decade', value: decade },
                        })
                      }
                    >
                      {decade}
                    </button>
                  ))
                : (['GB1', 'ES1', 'IT1', 'L1', 'FR1'] as PracticeLeague[]).map(
                    (league) => (
                      <button
                        type="button"
                        key={league}
                        aria-pressed={settings.practiceFilter.value === league}
                        className={settings.practiceFilter.value === league ? 'active' : ''}
                        onClick={() =>
                          onSettingsChange({
                            ...settings,
                            practiceFilter: { kind: 'league', value: league },
                          })
                        }
                      >
                        {leagueLabel(league)}
                      </button>
                    ),
                  )}
            </div>
          </div>
        )}

        {!isDailyMode && !isLineupMode && <div className="setup-panel__header setup-panel__header--pool">
          <div>
            <span className="eyebrow">{t('Choose your player pool')}</span>
            <h2>{t('Player pool')}</h2>
          </div>
        </div>}
        {!isDailyMode && !isLineupMode && <div className="pool-toggle">
          {(['normal', 'hardcore'] as const).map((pool) => (
            <button
              type="button"
              key={pool}
              className={settings.pool === pool ? 'active' : ''}
              aria-pressed={settings.pool === pool}
              disabled={settings.mode === 'daily' && pool === 'hardcore'}
              onClick={() => onSettingsChange({ ...settings, pool })}
            >
              <span>{poolLabel(pool)}</span>
              <small>
                {t(pool === 'normal' ? '250 recognised players with 50+ Big-Five appearances since 1995.' : '800 ranked players with 150+ career Big-Five appearances.')}
              </small>
            </button>
          ))}
        </div>}

        {!isDailyMode && <div className="setup-actions">
          <div className="roster-count">
            <strong>{poolCount}</strong>
            <span>{isLineupMode ? t('historic matches available') : t('players available')}</span>
          </div>
          <button className="primary-button primary-button--large" type="button" onClick={() => onStart()}>
            {t('Kick off')} <span aria-hidden="true">↗</span>
          </button>
        </div>}
        {savedData.unfinishedGame && (
          <button className="resume-button" type="button" onClick={onResume}>
            {t('Continue unfinished {mode}', { mode: modeLabel(savedData.unfinishedGame.settings.mode).toLowerCase() })}
          </button>
        )}
        {savedData.unfinishedLineupGame && (
          <button className="resume-button" type="button" onClick={onResumeLineup}>
            {t('Continue unfinished lineup challenge')}
          </button>
        )}
      </section>
    </main>
  )
}
