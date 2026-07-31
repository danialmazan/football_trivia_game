import { useEffect, useMemo, useState } from 'react'
import { DailyResultsScreen } from './components/DailyResultsScreen'
import { GameGuide } from './components/GameGuide'
import { GameScreen } from './components/GameScreen'
import { LeaderboardHubScreen } from './components/LeaderboardHubScreen'
import { ResultsScreen } from './components/ResultsScreen'
import { SetupScreen } from './components/SetupScreen'
import { playerSearch, players } from './data/players'
import { matchAnswer, normalizeAnswer } from './game/answerMatching'
import { GAME_CONFIG } from './game/config'
import { getUtcDateKey, isValidNickname } from './game/daily'
import {
  getDailyChallenge,
  getDailyLeaderboard,
  getChallengeLeaderboard,
  getLeaderboardHub,
  submitChallengeResult,
  submitDailyResult,
} from './game/dailyApi'
import {
  loadSavedData,
  resetSavedData,
  saveData,
} from './game/persistence'
import { createRound, recordIncorrectGuess, revealNextClue } from './game/round'
import { calculateAvailableScore } from './game/scoring'
import { getActivePool, selectNextPlayer } from './game/selection'
import type {
  DailyChallenge,
  DailyCompletion,
  GameSettings,
  GameState,
  LeaderboardBoards,
  LeaderboardHubResponse,
  RoundOutcome,
  RoundResult,
  SavedData,
} from './game/types'

const EMPTY_LEADERBOARD_BOARDS: LeaderboardBoards = {
  today: [],
  cumulative: [],
  average: [],
  best: [],
}

export function App() {
  const [savedData, setSavedData] = useState<SavedData>(() => loadSavedData())
  const [settings, setSettings] = useState<GameSettings>(savedData.lastSettings)
  const [game, setGame] = useState<GameState | null>(null)
  const [showGuide, setShowGuide] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dailyLoading, setDailyLoading] = useState(false)
  const [dailyError, setDailyError] = useState<string | null>(null)
  const [dailyNickname, setDailyNickname] = useState(savedData.lastNickname)
  const [dailyBoards, setDailyBoards] = useState<LeaderboardBoards>(
    savedData.dailyCompletion?.boards ?? EMPTY_LEADERBOARD_BOARDS,
  )
  const [challengeBoards, setChallengeBoards] = useState<LeaderboardBoards | null>(null)
  const [challengeSubmitted, setChallengeSubmitted] = useState(false)
  const [leaderboardHubOpen, setLeaderboardHubOpen] = useState(false)
  const [leaderboardHubNickname, setLeaderboardHubNickname] = useState('')
  const [leaderboardHubResponse, setLeaderboardHubResponse] =
    useState<LeaderboardHubResponse | null>(null)

  useEffect(() => {
    saveData(savedData)
  }, [savedData])

  useEffect(() => {
    if (!game) return
    setSavedData((current) =>
      game.settings.mode === 'daily'
        ? { ...current, dailyGame: game }
        : {
            ...current,
            unfinishedGame:
              game.phase !== 'results' ||
              (game.settings.mode === 'challenge' && !challengeSubmitted)
                ? game
                : null,
          },
    )
  }, [game, challengeSubmitted])

  useEffect(() => {
    if (game?.settings.mode !== 'daily' || !game.dailyChallenge) return
    const delay = new Date(game.dailyChallenge.expiresAt).getTime() - Date.now()
    if (delay <= 0) {
      expireDailyGame()
      return
    }
    const timer = window.setTimeout(expireDailyGame, Math.min(delay, 2_147_000_000))
    return () => window.clearTimeout(timer)
  }, [game?.dailyChallenge?.expiresAt])

  useEffect(() => {
    if (game?.settings.mode === 'daily' && game.phase === 'results') {
      void refreshDailyLeaderboard()
    }
  }, [game?.phase, game?.settings.mode])

  const activePool = useMemo(() => {
    if (!game) return []
    return getActivePool(
      players,
      game.settings.mode === 'daily' ? 'normal' : game.settings.pool,
      game.settings.mode === 'practice' ? game.settings.practiceFilter : undefined,
    )
  }, [game?.settings])

  const currentPlayer = game
    ? players.find((player) => player.id === game.round.playerId)
    : undefined

  function buildNewGame(nextSettings: GameSettings): GameState {
    const pool = getActivePool(
      players,
      nextSettings.pool,
      nextSettings.mode === 'practice' ? nextSettings.practiceFilter : undefined,
    )
    const selection = selectNextPlayer(pool, [])
    return {
      version: 2,
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

  function buildDailyGame(challenge: DailyChallenge): GameState {
    const player = players.find((candidate) => candidate.id === challenge.playerId)
    if (!player?.normalPool) {
      throw new Error('Today’s player is not available in this game version. Please reload.')
    }
    return {
      version: 2,
      phase: 'playing',
      settings: { ...settings, mode: 'daily', pool: 'normal' },
      round: createRound(challenge.playerId, () => challenge.clueSeed / 1_000_000),
      results: [],
      usedPlayerIds: [challenge.playerId],
      totalScore: 0,
      poolCycle: 1,
      poolResetMessage: null,
      startedAt: new Date().toISOString(),
      dailyChallenge: challenge,
    }
  }

  function startGame() {
    setDailyError(null)
    if (settings.mode === 'daily') {
      const currentDaily = savedData.dailyGame
      if (currentDaily?.dailyChallenge?.date === getUtcDateKey()) {
        setDailyBoards(savedData.dailyCompletion?.boards ?? EMPTY_LEADERBOARD_BOARDS)
        setDailyNickname(savedData.dailyCompletion?.nickname ?? '')
        setGame(currentDaily)
        return
      }
      setShowGuide(true)
      return
    }
    if (
      ['challenge', 'practice'].includes(savedData.unfinishedGame?.settings.mode ?? '') &&
      !window.confirm('Start a new game and abandon the saved 10-round game?')
    ) {
      return
    }
    setShowGuide(true)
  }

  async function confirmGameStart() {
    if (settings.mode !== 'daily') {
      const newGame = buildNewGame(settings)
      setChallengeBoards(null)
      setChallengeSubmitted(false)
      setGame(newGame)
      setShowGuide(false)
      setSavedData((current) => ({
        ...current,
        lastSettings: settings,
        unfinishedGame: newGame,
      }))
      return
    }

    setDailyLoading(true)
    setDailyError(null)
    try {
      const challenge = await getDailyChallenge(savedData.installationId)
      const newGame = buildDailyGame(challenge)
      setGame(newGame)
      setShowGuide(false)
      setSavedData((current) => ({
        ...current,
        lastSettings: newGame.settings,
        dailyGame: newGame,
        dailyCompletion: null,
      }))
    } catch (error) {
      setDailyError(error instanceof Error ? error.message : 'Could not load today’s player.')
    } finally {
      setDailyLoading(false)
    }
  }

  function resumeGame() {
    if (savedData.unfinishedGame) {
      setChallengeBoards(null)
      setChallengeSubmitted(false)
      setShowGuide(false)
      setSettings(savedData.unfinishedGame.settings)
      setGame(savedData.unfinishedGame)
    }
  }

  function updateSettings(nextSettings: GameSettings) {
    const normalized =
      nextSettings.mode === 'daily' ? { ...nextSettings, pool: 'normal' as const } : nextSettings
    setSettings(normalized)
    setSavedData((current) => ({ ...current, lastSettings: normalized }))
    setDailyError(null)
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
    const result = matchAnswer(guess, currentPlayer, playerSearch)
    if (result.status === 'invalid') {
      setGame({ ...game, round: { ...game.round, statusMessage: result.message } })
      return
    }
    if (result.status === 'ambiguous') {
      setGame({ ...game, round: { ...game.round, statusMessage: 'Please be more specific.' } })
      return
    }
    if (result.status === 'correct') {
      finalizeRound(
        'correct',
        calculateAvailableScore(game.round.clueLevel, game.round.incorrectGuesses.length),
      )
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
    if (!game || game.phase !== 'review' || game.settings.mode === 'daily') return
    if (
      (game.settings.mode === 'challenge' || game.settings.mode === 'practice') &&
      game.results.length >= GAME_CONFIG.challengeRounds
    ) {
      const finished = { ...game, phase: 'results' as const }
      setGame(finished)
      setSavedData((current) => ({
        ...current,
        highScores:
          game.settings.mode === 'challenge'
            ? {
                ...current.highScores,
                [game.settings.pool]: Math.max(
                  current.highScores[game.settings.pool],
                  game.totalScore,
                ),
              }
            : current.highScores,
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

  async function submitChallengeScore() {
    if (
      !game ||
      game.settings.mode !== 'challenge' ||
      game.phase !== 'results' ||
      game.results.length !== GAME_CONFIG.challengeRounds ||
      !isValidNickname(dailyNickname)
    ) {
      return
    }
    setDailyLoading(true)
    setDailyError(null)
    try {
      const response = await submitChallengeResult({
        nickname: dailyNickname.trim(),
        pool: game.settings.pool,
        rounds: game.results.map((result) => ({
          outcome: result.outcome,
          cluesUsed: result.cluesUsed,
          incorrectGuesses: result.incorrectGuesses.length,
        })),
      })
      setChallengeBoards(response.boards)
      setChallengeSubmitted(true)
      setSavedData((current) => ({
        ...current,
        lastNickname: dailyNickname.trim(),
        unfinishedGame: null,
      }))
    } catch (error) {
      setDailyError(error instanceof Error ? error.message : 'Could not submit this game.')
    } finally {
      setDailyLoading(false)
    }
  }

  async function refreshChallengeLeaderboard() {
    if (!game || game.settings.mode !== 'challenge') return
    setDailyLoading(true)
    setDailyError(null)
    try {
      const response = await getChallengeLeaderboard(game.settings.pool)
      setChallengeBoards(response.boards)
    } catch (error) {
      setDailyError(error instanceof Error ? error.message : 'Could not refresh the leaderboard.')
    } finally {
      setDailyLoading(false)
    }
  }

  async function submitDailyScore() {
    if (
      !game ||
      game.settings.mode !== 'daily' ||
      game.phase !== 'review' ||
      !game.dailyChallenge ||
      !game.round.outcome ||
      !isValidNickname(dailyNickname)
    ) {
      return
    }
    setDailyLoading(true)
    setDailyError(null)
    try {
      const response = await submitDailyResult({
        challengeDate: game.dailyChallenge.date,
        attemptToken: game.dailyChallenge.attemptToken,
        nickname: dailyNickname.trim(),
        outcome: game.round.outcome,
        cluesUsed: game.round.clueLevel,
        incorrectGuesses: game.round.incorrectGuesses.length,
      })
      const completion: DailyCompletion = {
        date: response.date,
        nickname: dailyNickname.trim(),
        points: response.points,
        rank: response.rank,
        leaderboard: response.leaderboard,
        boards: response.boards,
      }
      const finished: GameState = { ...game, phase: 'results', totalScore: response.points }
      setDailyBoards(response.boards)
      setGame(finished)
      setSavedData((current) => ({
        ...current,
        dailyGame: finished,
        dailyCompletion: completion,
        lastNickname: dailyNickname.trim(),
      }))
    } catch (error) {
      setDailyError(error instanceof Error ? error.message : 'Could not submit your result.')
    } finally {
      setDailyLoading(false)
    }
  }

  async function refreshDailyLeaderboard() {
    if (game?.settings.mode !== 'daily') return
    setDailyLoading(true)
    setDailyError(null)
    try {
      const response = await getDailyLeaderboard()
      if (response.date !== game.dailyChallenge?.date) {
        expireDailyGame()
        return
      }
      setDailyBoards(response.boards)
      setSavedData((current) =>
        current.dailyCompletion
          ? {
              ...current,
              dailyCompletion: {
                ...current.dailyCompletion,
                leaderboard: response.leaderboard,
                boards: response.boards,
              },
            }
          : current,
      )
    } catch (error) {
      setDailyError(error instanceof Error ? error.message : 'Could not refresh the leaderboard.')
    } finally {
      setDailyLoading(false)
    }
  }

  function expireDailyGame() {
    setGame(null)
    setShowGuide(false)
    setDailyBoards(EMPTY_LEADERBOARD_BOARDS)
    setDailyNickname('')
    setDailyError('A new Player of the day is now available.')
    setSavedData((current) => ({
      ...current,
      dailyGame: null,
      dailyCompletion: null,
    }))
  }

  function exitGame() {
    if (game?.settings.mode === 'challenge') {
      const confirmation =
        game.phase === 'results' && !challengeSubmitted
          ? 'Return home without submitting this score to the leaderboard?'
          : game.phase !== 'results'
            ? 'Leave this active 10-round game? Your progress will remain saved.'
            : null
      if (confirmation && !window.confirm(confirmation)) return
    } else if (
      game?.settings.mode === 'practice' &&
      game.phase !== 'results' &&
      !window.confirm('Leave this active 10-round game? Your progress will remain saved.')
    ) {
      return
    }
    setGame(null)
    setShowGuide(false)
  }

  function playAgain() {
    if (
      game?.settings.mode === 'challenge' &&
      game.phase === 'results' &&
      !challengeSubmitted &&
      !window.confirm('Play again without submitting this score to the leaderboard?')
    ) {
      return
    }
    setChallengeBoards(null)
    setChallengeSubmitted(false)
    setDailyError(null)
    setGame(buildNewGame(game?.settings ?? settings))
  }

  function openLeaderboardHub() {
    setLeaderboardHubNickname('')
    setLeaderboardHubResponse(null)
    setDailyError(null)
    setLeaderboardHubOpen(true)
  }

  function closeLeaderboardHub() {
    setLeaderboardHubOpen(false)
    setLeaderboardHubNickname('')
    setLeaderboardHubResponse(null)
    setDailyError(null)
  }

  function resetLeaderboardAccess() {
    setLeaderboardHubNickname('')
    setLeaderboardHubResponse(null)
    setDailyError(null)
  }

  async function loadLeaderboardHub() {
    if (!isValidNickname(leaderboardHubNickname)) return
    setDailyLoading(true)
    setDailyError(null)
    try {
      const response = await getLeaderboardHub(leaderboardHubNickname.trim())
      setLeaderboardHubResponse(response)
      if (response.eligible) {
        setLeaderboardHubNickname(response.nickname)
        setSavedData((current) => ({ ...current, lastNickname: response.nickname }))
      }
    } catch (error) {
      setLeaderboardHubResponse(null)
      setDailyError(error instanceof Error ? error.message : 'Could not load the leaderboards.')
    } finally {
      setDailyLoading(false)
    }
  }

  function handleResetSavedData() {
    if (!window.confirm('Reset high scores, endless stats, preferences and saved games?')) return
    resetSavedData()
    const resetData = loadSavedData()
    setSavedData(resetData)
    setSettings(resetData.lastSettings)
    setGame(null)
    setSettingsOpen(false)
  }

  const dailyCompletion = savedData.dailyCompletion

  return (
    <div className="app">
      {!game && !showGuide && !leaderboardHubOpen && (
        <SetupScreen
          settings={settings}
          savedData={savedData}
          players={players}
          onSettingsChange={updateSettings}
          onStart={startGame}
          onResume={resumeGame}
          onOpenLeaderboard={openLeaderboardHub}
        />
      )}
      {!game && !showGuide && leaderboardHubOpen && (
        <LeaderboardHubScreen
          nickname={leaderboardHubNickname}
          response={leaderboardHubResponse}
          loading={dailyLoading}
          error={dailyError}
          onNicknameChange={setLeaderboardHubNickname}
          onSubmit={loadLeaderboardHub}
          onRefresh={loadLeaderboardHub}
          onResetAccess={resetLeaderboardAccess}
          onExit={closeLeaderboardHub}
        />
      )}
      {!game && showGuide && (
        <GameGuide
          settings={settings}
          loading={dailyLoading}
          error={dailyError}
          onBack={() => setShowGuide(false)}
          onConfirm={confirmGameStart}
        />
      )}
      {game && game.phase !== 'results' && currentPlayer && (
        <GameScreen
          game={game}
          player={currentPlayer}
          suggestionCatalog={playerSearch}
          onSubmit={submitGuess}
          onReveal={revealClue}
          onGiveUp={giveUp}
          onNext={nextPlayer}
          onExit={exitGame}
          dailyNickname={dailyNickname}
          dailySubmitting={dailyLoading}
          dailyError={dailyError}
          onDailyNicknameChange={setDailyNickname}
          onDailySubmit={submitDailyScore}
        />
      )}
      {game?.phase === 'results' && game.settings.mode !== 'daily' && (
        <ResultsScreen
          game={game}
          highScore={savedData.highScores[game.settings.pool]}
          onPlayAgain={playAgain}
          onHome={exitGame}
          nickname={dailyNickname}
          submitting={dailyLoading}
          error={dailyError}
          boards={challengeBoards}
          submitted={challengeSubmitted}
          onNicknameChange={setDailyNickname}
          onSubmit={submitChallengeScore}
          onRefresh={refreshChallengeLeaderboard}
        />
      )}
      {game?.phase === 'results' && game.settings.mode === 'daily' && dailyCompletion && (
        <DailyResultsScreen
          game={game}
          completion={dailyCompletion}
          boards={dailyBoards}
          loading={dailyLoading}
          error={dailyError}
          onRefresh={refreshDailyLeaderboard}
          onExit={exitGame}
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
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setSettingsOpen(false)}
        >
          <section
            className="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              type="button"
              onClick={() => setSettingsOpen(false)}
              aria-label="Close settings"
            >
              ×
            </button>
            <span className="eyebrow">Preferences and records</span>
            <h2 id="settings-title">Settings</h2>
            <p>
              Game progress and personal records live in this browser. Submitted daily
              nicknames and scores join the shared leaderboard.
            </p>
            <div className="settings-records">
              <span>Normal high score <strong>{savedData.highScores.normal}</strong></span>
              <span>Hardcore high score <strong>{savedData.highScores.hardcore}</strong></span>
            </div>
            <button className="danger-button" type="button" onClick={handleResetSavedData}>
              Reset saved data
            </button>
          </section>
        </div>
      )}
    </div>
  )
}
