import { useEffect, useMemo, useState } from 'react'
import { GameScreen } from './components/GameScreen'
import { GameGuide } from './components/GameGuide'
import { ResultsScreen } from './components/ResultsScreen'
import { SetupScreen } from './components/SetupScreen'
import { players } from './data/players'
import { matchAnswer, normalizeAnswer } from './game/answerMatching'
import { GAME_CONFIG } from './game/config'
import {
  DEFAULT_SAVED_DATA,
  loadSavedData,
  resetSavedData,
  saveData,
} from './game/persistence'
import { createRound, recordIncorrectGuess, revealNextClue } from './game/round'
import { calculateAvailableScore } from './game/scoring'
import { getActivePool, selectNextPlayer } from './game/selection'
import type { GameSettings, GameState, RoundOutcome, RoundResult, SavedData } from './game/types'

export function App() {
  const [savedData, setSavedData] = useState<SavedData>(() => loadSavedData())
  const [settings, setSettings] = useState<GameSettings>(() => loadSavedData().lastSettings)
  const [game, setGame] = useState<GameState | null>(null)
  const [showGuide, setShowGuide] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    saveData(savedData)
  }, [savedData])

  useEffect(() => {
    if (!game) return
    setSavedData((current) => ({
      ...current,
      unfinishedGame: game.phase === 'results' ? null : game,
    }))
  }, [game])

  const activePool = useMemo(() => {
    if (!game) return []
    return getActivePool(
      players,
      game.settings.pool,
      game.settings.mode === 'practice' ? game.settings.practiceFilter : undefined,
    )
  }, [game?.settings])

  const currentPlayer = game ? players.find((player) => player.id === game.round.playerId) : undefined

  function buildNewGame(nextSettings: GameSettings): GameState {
    const pool = getActivePool(
      players,
      nextSettings.pool,
      nextSettings.mode === 'practice' ? nextSettings.practiceFilter : undefined,
    )
    const selection = selectNextPlayer(pool, [])
    return {
      version: 1,
      phase: 'playing',
      settings: nextSettings,
      round: createRound(selection.player.id),
      results: [],
      usedPlayerIds: [selection.player.id],
      totalScore: 0,
      poolCycle: 1,
      poolResetMessage: null,
      startedAt: new Date().toISOString(),
    }
  }

  function startGame() {
    if (
      savedData.unfinishedGame?.settings.mode === 'challenge' &&
      !window.confirm('Start a new game and abandon the saved ten-round challenge?')
    ) {
      return
    }
    setShowGuide(true)
  }

  function confirmGameStart() {
    const newGame = buildNewGame(settings)
    setGame(newGame)
    setShowGuide(false)
    setSavedData((current) => ({ ...current, lastSettings: settings, unfinishedGame: newGame }))
  }

  function resumeGame() {
    if (savedData.unfinishedGame) {
      setShowGuide(false)
      setSettings(savedData.unfinishedGame.settings)
      setGame(savedData.unfinishedGame)
    }
  }

  function updateSettings(nextSettings: GameSettings) {
    setSettings(nextSettings)
    setSavedData((current) => ({ ...current, lastSettings: nextSettings }))
  }

  function finalizeRound(outcome: RoundOutcome, points: number) {
    if (!game || !currentPlayer || game.phase !== 'playing') return
    const result: RoundResult = {
      playerId: currentPlayer.id,
      playerName: currentPlayer.displayName,
      outcome,
      points,
      cluesUsed: game.round.clueLevel,
      incorrectGuesses: game.round.incorrectGuesses,
    }
    const nextGame: GameState = {
      ...game,
      phase: 'review',
      round: { ...game.round, outcome, pointsEarned: points, statusMessage: '' },
      results: [...game.results, result],
      totalScore: game.totalScore + points,
    }
    setGame(nextGame)
    if (game.settings.mode === 'endless') {
      setSavedData((current) => {
        const existing = current.endlessStats[game.settings.pool]
        return {
          ...current,
          endlessStats: {
            ...current.endlessStats,
            [game.settings.pool]: {
              totalScore: existing.totalScore + points,
              solved: existing.solved + (outcome === 'correct' ? 1 : 0),
              rounds: existing.rounds + 1,
            },
          },
        }
      })
    }
  }

  function submitGuess(guess: string) {
    if (!game || !currentPlayer || game.phase !== 'playing') return
    const result = matchAnswer(guess, currentPlayer, activePool)
    if (result.status === 'invalid') {
      setGame({ ...game, round: { ...game.round, statusMessage: result.message } })
      return
    }
    if (result.status === 'ambiguous') {
      setGame({ ...game, round: { ...game.round, statusMessage: 'Please be more specific.' } })
      return
    }
    if (result.status === 'correct') {
      finalizeRound('correct', calculateAvailableScore(game.round.clueLevel, game.round.incorrectGuesses.length))
      return
    }
    const update = recordIncorrectGuess(game.round, guess, normalizeAnswer(guess))
    setGame({ ...game, round: update.round })
  }

  function revealClue() {
    if (!game || game.phase !== 'playing') return
    setGame({ ...game, round: revealNextClue(game.round) })
  }

  function giveUp() {
    finalizeRound('gave-up', 0)
  }

  function nextPlayer() {
    if (!game || game.phase !== 'review') return
    if (game.settings.mode === 'challenge' && game.results.length >= GAME_CONFIG.challengeRounds) {
      const best = Math.max(savedData.highScores[game.settings.pool], game.totalScore)
      const finished = { ...game, phase: 'results' as const }
      setGame(finished)
      setSavedData((current) => ({
        ...current,
        highScores: { ...current.highScores, [game.settings.pool]: best },
        unfinishedGame: null,
      }))
      return
    }

    const selection = selectNextPlayer(activePool, game.usedPlayerIds)
    setGame({
      ...game,
      phase: 'playing',
      round: createRound(selection.player.id),
      usedPlayerIds: selection.exhausted
        ? [selection.player.id]
        : [...game.usedPlayerIds, selection.player.id],
      poolCycle: game.poolCycle + (selection.exhausted ? 1 : 0),
      poolResetMessage: selection.exhausted
        ? 'Every player in this pool has appeared. The rotation has reset.'
        : null,
    })
  }

  function exitGame() {
    if (
      game?.settings.mode === 'challenge' &&
      game.phase !== 'results' &&
      !window.confirm('Leave this active ten-round game? Your progress will remain saved.')
    ) {
      return
    }
    setGame(null)
    setShowGuide(false)
  }

  function playAgain() {
    setGame(buildNewGame(game?.settings ?? settings))
  }

  function switchPool() {
    if (game) setSettings({ ...game.settings, pool: game.settings.pool === 'normal' ? 'hardcore' : 'normal' })
    setGame(null)
  }

  function handleResetSavedData() {
    if (!window.confirm('Reset high scores, endless stats, preferences and the saved game?')) return
    resetSavedData()
    setSavedData(DEFAULT_SAVED_DATA)
    setSettings(DEFAULT_SAVED_DATA.lastSettings)
    setGame(null)
    setSettingsOpen(false)
  }

  return (
    <div className="app">
      {!game && !showGuide && (
        <SetupScreen
          settings={settings}
          savedData={savedData}
          players={players}
          onSettingsChange={updateSettings}
          onStart={startGame}
          onResume={resumeGame}
        />
      )}
      {!game && showGuide && (
        <GameGuide
          settings={settings}
          onBack={() => setShowGuide(false)}
          onConfirm={confirmGameStart}
        />
      )}
      {game && game.phase !== 'results' && currentPlayer && (
        <GameScreen
          game={game}
          player={currentPlayer}
          activePool={activePool}
          onSubmit={submitGuess}
          onReveal={revealClue}
          onGiveUp={giveUp}
          onNext={nextPlayer}
          onExit={exitGame}
        />
      )}
      {game?.phase === 'results' && (
        <ResultsScreen
          game={game}
          highScore={savedData.highScores[game.settings.pool]}
          onPlayAgain={playAgain}
          onSwitchPool={switchPool}
        />
      )}

      <button
        className="settings-trigger"
        type="button"
        aria-label="Open settings"
        onClick={() => setSettingsOpen(true)}
      >
        <span aria-hidden="true">⚙</span>
      </button>
      {settingsOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setSettingsOpen(false)}>
          <section
            className="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" type="button" onClick={() => setSettingsOpen(false)} aria-label="Close settings">×</button>
            <span className="eyebrow">Local preferences</span>
            <h2 id="settings-title">Settings</h2>
            <p>Scores and game progress live only in this browser.</p>
            <div className="settings-records">
              <span>Normal high score <strong>{savedData.highScores.normal}</strong></span>
              <span>Hardcore high score <strong>{savedData.highScores.hardcore}</strong></span>
            </div>
            <button className="danger-button" type="button" onClick={handleResetSavedData}>Reset saved data</button>
          </section>
        </div>
      )}
    </div>
  )
}
