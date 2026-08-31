import type { Player } from '../data/types'
import {
  DECADES,
  GAME_CONFIG,
  GAME_MODES,
} from '../game/config'
import { getActivePool } from '../game/selection'
import type { GameSettings, PracticeLeague, SavedData } from '../game/types'
import { GoatCrest } from './GoatCrest'
import { useState } from 'react'
import { useI18n } from '../i18n'

interface SetupScreenProps {
  settings: GameSettings
  savedData: SavedData
  players: Player[]
  onSettingsChange: (settings: GameSettings) => void
  onStart: () => void
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
  const [moreFormatsOpen, setMoreFormatsOpen] = useState(false)
  const isLineupMode = settings.mode === 'lineup-daily' || settings.mode === 'lineup-challenge'
  const filter = settings.mode === 'practice' ? settings.practiceFilter : undefined
  const effectivePool = settings.mode === 'daily' ? 'normal' : settings.pool
  const poolCount = isLineupMode ? GAME_CONFIG.lineupActiveMatchCount : getActivePool(players, effectivePool, filter).length

  function selectMode(mode: GameSettings['mode']) {
    onSettingsChange({
      ...settings,
      mode,
      pool: mode === 'daily' ? 'normal' : settings.pool,
    })
  }

  return (
    <main className="setup-shell">
      <section className="hero" aria-labelledby="game-title">
        <div className="hero__kicker">
          <span>{t('European football knowledge test')}</span>
          <span className="hero__kicker-line" />
          <span>{t('Big Five · Since 1995')}</span>
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
        <div className="hero__scope">
          <strong>{t('What does “Big Five” mean?')}</strong>
          <p>{t('England, Spain, Italy, Germany and France. The player pool only includes footballers who appeared in at least one of those countries’ top leagues from 1995 onwards.')}</p>
        </div>
        <div className="hero__records">
          <button className="hero__leaderboard-button" type="button" onClick={onOpenLeaderboard}>
            {t('Check the leaderboard')} <span aria-hidden="true">↗</span>
          </button>
        </div>
      </section>

      <section className="setup-panel" aria-label={t('Game setup')}>
        <div className="setup-panel__header">
          <span className="step-marker">01</span>
          <div>
            <span className="eyebrow">{t('Choose the fixture')}</span>
            <h2>{t('Game format')}</h2>
          </div>
        </div>
        <div className="choice-grid choice-grid--modes">
          {GAME_MODES.filter((mode) => !['endless', 'practice'].includes(mode)).map((mode) => (
            <button
              type="button"
              className={`choice-card ${settings.mode === mode ? 'choice-card--active' : ''}`}
              aria-pressed={settings.mode === mode}
              key={mode}
              onClick={() => selectMode(mode)}
            >
              <span>{modeLabel(mode)}</span>
              <small>
                {mode === 'daily'
                  ? t('A player each day. Same for everyone.')
                  : mode === 'challenge'
                  ? t('10 players · 1,000 max')
                  : mode === 'lineup-daily'
                    ? t('One missing starter. Same for everyone.')
                    : mode === 'lineup-challenge'
                      ? t('10 historic lineups · 1,000 max')
                  : mode === 'endless'
                    ? t('Play through the pool')
                    : t('10 players from your chosen filter')}
              </small>
            </button>
          ))}
        </div>
        <button
          className="more-formats-toggle"
          type="button"
          aria-expanded={moreFormatsOpen}
          aria-controls="more-game-formats"
          onClick={() => setMoreFormatsOpen((open) => !open)}
        >
          {t('More game formats')} <span aria-hidden="true">{moreFormatsOpen ? '−' : '+'}</span>
        </button>
        {moreFormatsOpen && (
          <div className="choice-grid choice-grid--more" id="more-game-formats">
            {(['endless', 'practice'] as const).map((mode) => (
              <button
                type="button"
                className={`choice-card ${settings.mode === mode ? 'choice-card--active' : ''}`}
                aria-pressed={settings.mode === mode}
                key={mode}
                onClick={() => selectMode(mode)}
              >
                <span>{modeLabel(mode)}</span>
                <small>{mode === 'endless' ? t('Play through the pool') : t('10 players from your chosen filter')}</small>
              </button>
            ))}
          </div>
        )}

        {settings.mode === 'practice' && (
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

        {!isLineupMode && <div className="setup-panel__header setup-panel__header--pool">
          <span className="step-marker">02</span>
          <div>
            <span className="eyebrow">{t('Set the squad depth')}</span>
            <h2>{t('Player pool')}</h2>
          </div>
        </div>}
        {!isLineupMode && <div className="pool-toggle">
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
                {settings.mode === 'daily' && pool === 'hardcore'
                  ? t('Player of the day uses the Normal pool.')
                  : t(pool === 'normal' ? '250 recognised players with 50+ Big-Five appearances since 1995.' : '800 ranked players with 150+ career Big-Five appearances.')}
              </small>
            </button>
          ))}
        </div>}

        <div className="setup-actions">
          <div className="roster-count">
            <strong>{poolCount}</strong>
            <span>{isLineupMode ? t('historic matches available') : t('players available')}</span>
          </div>
          <button className="primary-button primary-button--large" type="button" onClick={onStart}>
            {t('Kick off')} <span aria-hidden="true">↗</span>
          </button>
        </div>
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
