import type { Player } from '../data/types'
import {
  DECADES,
  GAME_MODES,
  MODE_LABELS,
  POOL_LABELS,
  POOL_RULES,
  PRACTICE_LEAGUES,
} from '../game/config'
import { getActivePool } from '../game/selection'
import type { GameSettings, PracticeLeague, SavedData } from '../game/types'
import { GoatCrest } from './GoatCrest'

interface SetupScreenProps {
  settings: GameSettings
  savedData: SavedData
  players: Player[]
  onSettingsChange: (settings: GameSettings) => void
  onStart: () => void
  onResume: () => void
}

export function SetupScreen({
  settings,
  savedData,
  players,
  onSettingsChange,
  onStart,
  onResume,
}: SetupScreenProps) {
  const filter = settings.mode === 'practice' ? settings.practiceFilter : undefined
  const effectivePool = settings.mode === 'daily' ? 'normal' : settings.pool
  const poolCount = getActivePool(players, effectivePool, filter).length

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
          <span>European football knowledge test</span>
          <span className="hero__kicker-line" />
          <span>Big Five · Since 1995</span>
        </div>
        <div className="hero__crest">
          <GoatCrest />
        </div>
        <h1 id="game-title">
          Leo
          <span>Guessi.</span>
        </h1>
        <p className="hero__lead">Can you become the G.O.A.T. of player guessing?</p>
        <p className="hero__note">
          Five clues, hardest first. Clubs, countries and careers—no transfer gossip, no luck.
        </p>
        <div className="hero__scope">
          <strong>What does “Big Five” mean?</strong>
          <p>
            England, Spain, Italy, Germany and France. The player pool only includes
            footballers who appeared in at least one of those countries’ top leagues from
            1995 onwards.
          </p>
        </div>
        <div className="hero__scoreboard" aria-label="Saved high scores">
          <div>
            <span>Normal best</span>
            <strong>{savedData.highScores.normal.toString().padStart(4, '0')}</strong>
          </div>
          <div>
            <span>Hardcore best</span>
            <strong>{savedData.highScores.hardcore.toString().padStart(4, '0')}</strong>
          </div>
        </div>
      </section>

      <section className="setup-panel" aria-label="Game setup">
        <div className="setup-panel__header">
          <span className="step-marker">01</span>
          <div>
            <span className="eyebrow">Choose the fixture</span>
            <h2>Game format</h2>
          </div>
        </div>
        <div className="choice-grid choice-grid--modes">
          {GAME_MODES.map((mode) => (
            <button
              type="button"
              className={`choice-card ${settings.mode === mode ? 'choice-card--active' : ''}`}
              aria-pressed={settings.mode === mode}
              key={mode}
              onClick={() => selectMode(mode)}
            >
              <span>{MODE_LABELS[mode]}</span>
              <small>
                {mode === 'daily'
                  ? 'A player each day. Same for everyone.'
                  : mode === 'challenge'
                  ? '10 players · 1,000 max'
                  : mode === 'endless'
                    ? 'Play through the pool'
                    : 'Train by decade or league'}
              </small>
            </button>
          ))}
        </div>

        {settings.mode === 'practice' && (
          <div className="practice-builder">
            <div className="practice-kind" aria-label="Practice filter type">
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
                By decade
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
                By league
              </button>
            </div>
            <div className="decade-row" aria-label="Practice selection">
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
                : (Object.entries(PRACTICE_LEAGUES) as [PracticeLeague, string][]).map(
                    ([league, label]) => (
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
                        {label}
                      </button>
                    ),
                  )}
            </div>
          </div>
        )}

        <div className="setup-panel__header setup-panel__header--pool">
          <span className="step-marker">02</span>
          <div>
            <span className="eyebrow">Set the squad depth</span>
            <h2>Player pool</h2>
          </div>
        </div>
        <div className="pool-toggle">
          {(['normal', 'hardcore'] as const).map((pool) => (
            <button
              type="button"
              key={pool}
              className={settings.pool === pool ? 'active' : ''}
              aria-pressed={settings.pool === pool}
              disabled={settings.mode === 'daily' && pool === 'hardcore'}
              onClick={() => onSettingsChange({ ...settings, pool })}
            >
              <span>{POOL_LABELS[pool]}</span>
              <small>
                {settings.mode === 'daily' && pool === 'hardcore'
                  ? 'Player of the day uses the Normal pool.'
                  : POOL_RULES[pool]}
              </small>
            </button>
          ))}
        </div>

        <div className="setup-actions">
          <div className="roster-count">
            <strong>{poolCount}</strong>
            <span>players available</span>
          </div>
          <button className="primary-button primary-button--large" type="button" onClick={onStart}>
            Kick off <span aria-hidden="true">↗</span>
          </button>
        </div>
        {savedData.unfinishedGame && (
          <button className="resume-button" type="button" onClick={onResume}>
            Continue unfinished {MODE_LABELS[savedData.unfinishedGame.settings.mode].toLowerCase()}
          </button>
        )}
      </section>
    </main>
  )
}
