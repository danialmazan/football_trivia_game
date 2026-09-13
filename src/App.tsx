import { useEffect, useMemo, useState } from 'react'
import { DailyResultsScreen } from './components/DailyResultsScreen'
import { GameGuide } from './components/GameGuide'
import { GameScreen } from './components/GameScreen'
import { LeaderboardHubScreen, type LeaderboardFamily } from './components/LeaderboardHubScreen'
import { LineupDailyResultsScreen } from './components/LineupDailyResultsScreen'
import { LineupGameScreen } from './components/LineupGameScreen'
import { LineupGuide } from './components/LineupGuide'
import { LineupResultsScreen } from './components/LineupResultsScreen'
import { ResultsScreen } from './components/ResultsScreen'
import { SetupScreen } from './components/SetupScreen'
import { playerSearch, players } from './data/players'
import { loadLineupDataset } from './data/lineups'
import type { LineupDataset, LineupMatch } from './data/lineupTypes'
import type { SearchPlayer } from './data/types'
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
import {
  buildLineupChallenge,
  calculateLineupScore,
  createLineupRound,
  recordLineupIncorrectGuess,
  revealNextLineupClue,
  selectLineupMatch,
} from './game/lineups'
import {
  getLineupChallengeLeaderboard,
  getLineupDailyChallenge,
  getLineupDailyLeaderboard,
  getLineupLeaderboardHub,
  submitLineupChallengeResult,
  submitLineupDailyResult,
} from './game/lineupApi'
import { getActivePool, selectNextPlayer } from './game/selection'
import type {
  DailyChallenge,
  DailyCompletion,
  GameSettings,
  GameState,
  LeaderboardBoards,
  LeaderboardHubResponse,
  LineupDailyChallenge,
  LineupGameState,
  LineupLeaderboardHubResponse,
  RoundOutcome,
  RoundResult,
  SavedData,
} from './game/types'
import { LANGUAGE_STORAGE_KEY, LanguageToggle, useI18n } from './i18n'

const EMPTY_LEADERBOARD_BOARDS: LeaderboardBoards = {
  today: [],
  cumulative: [],
  average: [],
  best: [],
}

function homepageSettings(settings: GameSettings): GameSettings {
  return { ...settings, mode: 'daily', pool: 'normal' }
}

export function App() {
  const { t, known } = useI18n()
  const [savedData, setSavedData] = useState<SavedData>(() => loadSavedData())
  const [settings, setSettings] = useState<GameSettings>(() => homepageSettings(savedData.lastSettings))
  const [game, setGame] = useState<GameState | null>(null)
  const [lineupGame, setLineupGame] = useState<LineupGameState | null>(null)
  const [lineupDataset, setLineupDataset] = useState<LineupDataset | null>(null)
  const [lineupSearch, setLineupSearch] = useState<SearchPlayer[]>([])
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
  const [lineupChallengeBoards, setLineupChallengeBoards] = useState<LeaderboardBoards | null>(null)
  const [lineupChallengeSubmitted, setLineupChallengeSubmitted] = useState(false)
  const [lineupDailyBoards, setLineupDailyBoards] = useState<LeaderboardBoards>(
    savedData.lineupDailyCompletion?.boards ?? EMPTY_LEADERBOARD_BOARDS,
  )
  const [leaderboardHubOpen, setLeaderboardHubOpen] = useState(false)
  const [leaderboardHubNickname, setLeaderboardHubNickname] = useState('')
  const [leaderboardHubResponse, setLeaderboardHubResponse] =
    useState<LeaderboardHubResponse | null>(null)
  const [lineupLeaderboardHubResponse, setLineupLeaderboardHubResponse] =
    useState<LineupLeaderboardHubResponse | null>(null)
  const [leaderboardFamily, setLeaderboardFamily] = useState<LeaderboardFamily | null>(null)

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
    if (!lineupGame) return
    setSavedData((current) =>
      lineupGame.mode === 'lineup-daily'
        ? { ...current, lineupDailyGame: lineupGame }
        : {
            ...current,
            unfinishedLineupGame:
              lineupGame.phase !== 'results' || !lineupChallengeSubmitted ? lineupGame : null,
          },
    )
  }, [lineupGame, lineupChallengeSubmitted])

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
    if (lineupGame?.mode !== 'lineup-daily' || !lineupGame.dailyChallenge) return
    const delay = new Date(lineupGame.dailyChallenge.expiresAt).getTime() - Date.now()
    if (delay <= 0) {
      expireLineupDailyGame()
      return
    }
    const timer = window.setTimeout(expireLineupDailyGame, Math.min(delay, 2_147_000_000))
    return () => window.clearTimeout(timer)
  }, [lineupGame?.dailyChallenge?.expiresAt])

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

  const currentLineupMatch = lineupGame && lineupDataset
    ? lineupDataset.matches.find((match) => match.id === lineupGame.round.matchId)
    : undefined
  const currentMissingPlayer = currentLineupMatch
    ? currentLineupMatch.teams.flatMap((team) => team.starters).find(
        (player) => player.id === lineupGame?.round.missingPlayerId,
      )
    : undefined

  async function ensureLineupData(): Promise<{ dataset: LineupDataset; search: SearchPlayer[] }> {
    if (lineupDataset) return { dataset: lineupDataset, search: lineupSearch }
    const loaded = await loadLineupDataset()
    setLineupDataset(loaded.dataset)
    setLineupSearch(loaded.search)
    return loaded
  }

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

  function buildLineupDailyGame(challenge: LineupDailyChallenge, matches: LineupMatch[]): LineupGameState {
    const match = matches.find((candidate) => candidate.id === challenge.matchId)
    if (!match) throw new Error('Today’s lineup is not available in this game version. Please reload.')
    return {
      version: 1,
      mode: 'lineup-daily',
      phase: 'playing',
      round: createLineupRound(match, Math.random, challenge.missingPlayerId),
      results: [],
      usedMatchIds: [match.id],
      totalScore: 0,
      startedAt: new Date().toISOString(),
      dailyChallenge: challenge,
    }
  }

  async function confirmLineupGameStart() {
    setDailyLoading(true)
    setDailyError(null)
    try {
      const loaded = await ensureLineupData()
      const newGame = settings.mode === 'lineup-daily'
        ? buildLineupDailyGame(
            await getLineupDailyChallenge(savedData.installationId),
            loaded.dataset.matches,
          )
        : buildLineupChallenge(loaded.dataset.matches)
      setLineupChallengeBoards(null)
      setLineupChallengeSubmitted(false)
      setLineupGame(newGame)
      setShowGuide(false)
      setSavedData((current) => ({
        ...current,
        lastSettings: settings,
        lineupDailyGame: newGame.mode === 'lineup-daily' ? newGame : current.lineupDailyGame,
        lineupDailyCompletion:
          newGame.mode === 'lineup-daily' ? null : current.lineupDailyCompletion,
        unfinishedLineupGame:
          newGame.mode === 'lineup-challenge' ? newGame : current.unfinishedLineupGame,
      }))
    } catch (error) {
      setDailyError(error instanceof Error ? error.message : 'Could not load the lineup game.')
    } finally {
      setDailyLoading(false)
    }
  }

  function startGame(selectedSettings: GameSettings = settings) {
    setSettings(selectedSettings)
    setDailyError(null)
    if (selectedSettings.mode === 'lineup-daily' || selectedSettings.mode === 'lineup-challenge') {
      if (selectedSettings.mode === 'lineup-daily') {
        const currentDaily = savedData.lineupDailyGame
        if (currentDaily?.dailyChallenge?.date === getUtcDateKey()) {
          setDailyLoading(true)
          void ensureLineupData()
            .then(() => {
              setLineupDailyBoards(savedData.lineupDailyCompletion?.boards ?? EMPTY_LEADERBOARD_BOARDS)
              setDailyNickname(savedData.lineupDailyCompletion?.nickname ?? savedData.lastNickname)
              setLineupGame(currentDaily)
            })
            .catch((error) => setDailyError(error instanceof Error ? error.message : 'Could not load lineup data.'))
            .finally(() => setDailyLoading(false))
          return
        }
      }
      if (
        selectedSettings.mode === 'lineup-challenge' &&
        savedData.unfinishedLineupGame &&
        !window.confirm(known('Start a new lineup challenge and abandon the saved one?'))
      ) return
      setShowGuide(true)
      return
    }
    if (selectedSettings.mode === 'daily') {
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
      !window.confirm(known('Start a new game and abandon the saved 10-round game?'))
    ) {
      return
    }
    setShowGuide(true)
  }

  async function confirmGameStart() {
    if (settings.mode === 'lineup-daily' || settings.mode === 'lineup-challenge') {
      await confirmLineupGameStart()
      return
    }
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

  function resumeLineupGame() {
    const unfinished = savedData.unfinishedLineupGame
    if (!unfinished) return
    setDailyLoading(true)
    void ensureLineupData()
      .then(() => {
        setLineupChallengeBoards(null)
        setLineupChallengeSubmitted(false)
        setShowGuide(false)
        setSettings((current) => ({ ...current, mode: 'lineup-challenge' }))
        setLineupGame(unfinished)
      })
      .catch((error) => setDailyError(error instanceof Error ? error.message : 'Could not load lineup data.'))
      .finally(() => setDailyLoading(false))
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
      round: { ...game.round, outcome, pointsEarned: points, statusMessage: null },
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
      setGame({ ...game, round: { ...game.round, statusMessage: {
        key: result.message === 'Enter one player per guess.' ? 'one-player-per-guess' : 'enter-player-name',
      } } })
      return
    }
    if (result.status === 'ambiguous') {
      setGame({ ...game, round: { ...game.round, statusMessage: { key: 'be-specific' } } })
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
      poolResetMessage: selection.exhausted ? { key: 'pool-reset' } : null,
    })
  }

  function finalizeLineupRound(outcome: RoundOutcome) {
    if (!lineupGame || !currentLineupMatch || !currentMissingPlayer || lineupGame.phase !== 'playing') return
    const points = outcome === 'correct'
      ? calculateLineupScore(
          lineupGame.round.incorrectGuesses.length,
          lineupGame.round.cluesUsed,
          lineupGame.round.clueIncorrectGuessCounts,
        )
      : 0
    setLineupGame({
      ...lineupGame,
      phase: 'review',
      round: { ...lineupGame.round, outcome, pointsEarned: points, statusMessage: null },
      results: [
        ...lineupGame.results,
        {
          matchId: currentLineupMatch.id,
          matchLabel: `${currentLineupMatch.homeTeam.name} vs ${currentLineupMatch.awayTeam.name}`,
          playerId: currentMissingPlayer.id,
          playerName: currentMissingPlayer.displayName,
          outcome,
          points,
          cluesUsed: lineupGame.round.cluesUsed,
          clueIncorrectGuessCounts: lineupGame.round.clueIncorrectGuessCounts,
          incorrectGuesses: lineupGame.round.incorrectGuesses,
        },
      ],
      totalScore: lineupGame.totalScore + points,
    })
  }

  function submitLineupGuess(guess: string) {
    if (!lineupGame || !currentMissingPlayer || lineupGame.phase !== 'playing') return
    const result = matchAnswer(guess, currentMissingPlayer, lineupSearch)
    if (result.status === 'invalid') {
      setLineupGame({ ...lineupGame, round: { ...lineupGame.round, statusMessage: {
        key: result.message === 'Enter one player per guess.' ? 'one-player-per-guess' : 'enter-player-name',
      } } })
      return
    }
    if (result.status === 'ambiguous') {
      setLineupGame({ ...lineupGame, round: { ...lineupGame.round, statusMessage: { key: 'be-specific' } } })
      return
    }
    if (result.status === 'correct') {
      finalizeLineupRound('correct')
      return
    }
    const update = recordLineupIncorrectGuess(lineupGame.round, guess, normalizeAnswer(guess))
    setLineupGame({ ...lineupGame, round: update.round })
  }

  function revealLineupClue() {
    if (!lineupGame || lineupGame.phase !== 'playing') return
    setLineupGame({ ...lineupGame, round: revealNextLineupClue(lineupGame.round) })
  }

  function nextLineup() {
    if (!lineupGame || lineupGame.phase !== 'review' || lineupGame.mode !== 'lineup-challenge' || !lineupDataset) return
    if (lineupGame.results.length >= GAME_CONFIG.challengeRounds) {
      const finished = { ...lineupGame, phase: 'results' as const }
      setLineupGame(finished)
      setSavedData((current) => ({
        ...current,
        lineupBestScore: Math.max(current.lineupBestScore, lineupGame.totalScore),
        unfinishedLineupGame: null,
      }))
      return
    }
    const match = selectLineupMatch(lineupDataset.matches, lineupGame.usedMatchIds)
    setLineupGame({
      ...lineupGame,
      phase: 'playing',
      round: createLineupRound(match),
      usedMatchIds: [...lineupGame.usedMatchIds, match.id],
    })
  }

  async function submitLineupChallengeScore() {
    if (!lineupGame || lineupGame.mode !== 'lineup-challenge' || lineupGame.phase !== 'results' || lineupGame.results.length !== GAME_CONFIG.challengeRounds || !isValidNickname(dailyNickname)) return
    setDailyLoading(true)
    setDailyError(null)
    try {
      const response = await submitLineupChallengeResult({
        nickname: dailyNickname.trim(),
        rounds: lineupGame.results.map((result) => ({
          outcome: result.outcome,
          cluesUsed: result.cluesUsed,
          clueIncorrectGuessCounts: result.clueIncorrectGuessCounts,
          incorrectGuesses: result.incorrectGuesses.length,
        })),
      })
      setLineupChallengeBoards(response.boards)
      setLineupChallengeSubmitted(true)
      setSavedData((current) => ({ ...current, lastNickname: dailyNickname.trim(), unfinishedLineupGame: null }))
    } catch (error) {
      setDailyError(error instanceof Error ? error.message : 'Could not submit this lineup game.')
    } finally {
      setDailyLoading(false)
    }
  }

  async function refreshLineupChallengeLeaderboard() {
    setDailyLoading(true)
    setDailyError(null)
    try {
      setLineupChallengeBoards((await getLineupChallengeLeaderboard()).boards)
    } catch (error) {
      setDailyError(error instanceof Error ? error.message : 'Could not refresh the lineup leaderboard.')
    } finally {
      setDailyLoading(false)
    }
  }

  async function submitLineupDailyScore() {
    if (!lineupGame || lineupGame.mode !== 'lineup-daily' || lineupGame.phase !== 'review' || !lineupGame.dailyChallenge || !lineupGame.round.outcome || !isValidNickname(dailyNickname)) return
    setDailyLoading(true)
    setDailyError(null)
    try {
      const response = await submitLineupDailyResult({
        challengeDate: lineupGame.dailyChallenge.date,
        attemptToken: lineupGame.dailyChallenge.attemptToken,
        nickname: dailyNickname.trim(),
        outcome: lineupGame.round.outcome,
        cluesUsed: lineupGame.round.cluesUsed,
        clueIncorrectGuessCounts: lineupGame.round.clueIncorrectGuessCounts,
        incorrectGuesses: lineupGame.round.incorrectGuesses.length,
      })
      const completion: DailyCompletion = {
        date: response.date,
        nickname: dailyNickname.trim(),
        points: response.points,
        rank: response.rank,
        leaderboard: response.leaderboard,
        boards: response.boards,
      }
      const finished: LineupGameState = { ...lineupGame, phase: 'results', totalScore: response.points }
      setLineupDailyBoards(response.boards)
      setLineupGame(finished)
      setSavedData((current) => ({ ...current, lineupDailyGame: finished, lineupDailyCompletion: completion, lastNickname: dailyNickname.trim() }))
    } catch (error) {
      setDailyError(error instanceof Error ? error.message : 'Could not submit your lineup result.')
    } finally {
      setDailyLoading(false)
    }
  }

  async function refreshLineupDailyLeaderboard() {
    if (lineupGame?.mode !== 'lineup-daily') return
    setDailyLoading(true)
    setDailyError(null)
    try {
      const response = await getLineupDailyLeaderboard()
      if (response.date !== lineupGame.dailyChallenge?.date) {
        expireLineupDailyGame()
        return
      }
      setLineupDailyBoards(response.boards)
      setSavedData((current) => current.lineupDailyCompletion ? { ...current, lineupDailyCompletion: { ...current.lineupDailyCompletion, leaderboard: response.leaderboard, boards: response.boards } } : current)
    } catch (error) {
      setDailyError(error instanceof Error ? error.message : 'Could not refresh the lineup leaderboard.')
    } finally {
      setDailyLoading(false)
    }
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
    setSettings((current) => homepageSettings(current))
    setDailyBoards(EMPTY_LEADERBOARD_BOARDS)
    setDailyNickname('')
    setDailyError('A new Player of the day is now available.')
    setSavedData((current) => ({
      ...current,
      dailyGame: null,
      dailyCompletion: null,
    }))
  }

  function expireLineupDailyGame() {
    setLineupGame(null)
    setShowGuide(false)
    setSettings((current) => homepageSettings(current))
    setLineupDailyBoards(EMPTY_LEADERBOARD_BOARDS)
    setDailyNickname('')
    setDailyError('A new Lineup of the day is now available.')
    setSavedData((current) => ({ ...current, lineupDailyGame: null, lineupDailyCompletion: null }))
  }

  function exitGame() {
    if (game?.settings.mode === 'challenge') {
      const confirmation =
        game.phase === 'results' && !challengeSubmitted
          ? 'Return home without submitting this score to the leaderboard?'
          : game.phase !== 'results'
            ? 'Leave this active 10-round game? Your progress will remain saved.'
            : null
      if (confirmation && !window.confirm(known(confirmation))) return
    } else if (
      game?.settings.mode === 'practice' &&
      game.phase !== 'results' &&
      !window.confirm(known('Leave this active 10-round game? Your progress will remain saved.'))
    ) {
      return
    }
    setGame(null)
    setShowGuide(false)
    setSettings((current) => homepageSettings(current))
  }

  function exitLineupGame() {
    if (lineupGame?.mode === 'lineup-challenge') {
      const confirmation = lineupGame.phase === 'results' && !lineupChallengeSubmitted
        ? 'Return home without submitting this lineup score?'
        : lineupGame.phase !== 'results'
          ? 'Leave this active lineup challenge? Your progress will remain saved.'
          : null
      if (confirmation && !window.confirm(known(confirmation))) return
    }
    setLineupGame(null)
    setShowGuide(false)
    setSettings((current) => homepageSettings(current))
  }

  function playAgain() {
    if (
      game?.settings.mode === 'challenge' &&
      game.phase === 'results' &&
      !challengeSubmitted &&
      !window.confirm(known('Play again without submitting this score to the leaderboard?'))
    ) {
      return
    }
    setChallengeBoards(null)
    setChallengeSubmitted(false)
    setDailyError(null)
    setGame(buildNewGame(game?.settings ?? settings))
  }

  function playLineupsAgain() {
    if (!lineupDataset) return
    if (lineupGame?.phase === 'results' && !lineupChallengeSubmitted && !window.confirm(known('Play again without submitting this lineup score?'))) return
    setLineupChallengeBoards(null)
    setLineupChallengeSubmitted(false)
    setDailyError(null)
    setLineupGame(buildLineupChallenge(lineupDataset.matches))
  }

  function openLeaderboardHub() {
    setLeaderboardHubNickname('')
    setLeaderboardHubResponse(null)
    setLineupLeaderboardHubResponse(null)
    setLeaderboardFamily(null)
    setDailyError(null)
    setSettings((current) => homepageSettings(current))
    setLeaderboardHubOpen(true)
  }

  function closeLeaderboardHub() {
    setLeaderboardHubOpen(false)
    setLeaderboardHubNickname('')
    setLeaderboardHubResponse(null)
    setLineupLeaderboardHubResponse(null)
    setLeaderboardFamily(null)
    setDailyError(null)
    setSettings((current) => homepageSettings(current))
  }

  function resetLeaderboardAccess(family: LeaderboardFamily) {
    setLeaderboardHubNickname('')
    if (family === 'player') setLeaderboardHubResponse(null)
    else setLineupLeaderboardHubResponse(null)
    setDailyError(null)
  }

  async function loadLeaderboardHub(family: LeaderboardFamily) {
    if (!isValidNickname(leaderboardHubNickname)) return
    setDailyLoading(true)
    setDailyError(null)
    try {
      const response = family === 'player'
        ? await getLeaderboardHub(leaderboardHubNickname.trim())
        : await getLineupLeaderboardHub(leaderboardHubNickname.trim())
      if (family === 'player') setLeaderboardHubResponse(response as LeaderboardHubResponse)
      else setLineupLeaderboardHubResponse(response as LineupLeaderboardHubResponse)
      if (response.eligible) {
        setLeaderboardHubNickname(response.nickname)
        setSavedData((current) => ({ ...current, lastNickname: response.nickname }))
      }
    } catch (error) {
      if (family === 'player') setLeaderboardHubResponse(null)
      else setLineupLeaderboardHubResponse(null)
      setDailyError(error instanceof Error ? error.message : 'Could not load the leaderboards.')
    } finally {
      setDailyLoading(false)
    }
  }

  function handleResetSavedData() {
    if (!window.confirm(known('Reset high scores, endless stats, preferences and saved games?'))) return
    resetSavedData()
    window.localStorage.removeItem(LANGUAGE_STORAGE_KEY)
    const resetData = loadSavedData()
    setSavedData(resetData)
    setSettings(homepageSettings(resetData.lastSettings))
    setGame(null)
    setSettingsOpen(false)
  }

  const dailyCompletion = savedData.dailyCompletion

  return (
    <div className="app">
      {!game && !lineupGame && !showGuide && !leaderboardHubOpen && (
        <SetupScreen
          settings={settings}
          savedData={savedData}
          players={players}
          onSettingsChange={updateSettings}
          onStart={startGame}
          onResume={resumeGame}
          onResumeLineup={resumeLineupGame}
          onOpenLeaderboard={openLeaderboardHub}
        />
      )}
      {!game && !lineupGame && !showGuide && leaderboardHubOpen && (
        <LeaderboardHubScreen
          family={leaderboardFamily}
          nickname={leaderboardHubNickname}
          playerResponse={leaderboardHubResponse}
          lineupResponse={lineupLeaderboardHubResponse}
          loading={dailyLoading}
          error={dailyError}
          onNicknameChange={setLeaderboardHubNickname}
          onFamilyChange={(family) => {
            setLeaderboardFamily(family)
            setLeaderboardHubNickname('')
            setDailyError(null)
          }}
          onSubmit={loadLeaderboardHub}
          onRefresh={loadLeaderboardHub}
          onResetAccess={resetLeaderboardAccess}
          onExit={closeLeaderboardHub}
        />
      )}
      {!game && !lineupGame && showGuide && (
        settings.mode === 'lineup-daily' || settings.mode === 'lineup-challenge'
          ? <LineupGuide settings={settings} loading={dailyLoading} error={dailyError} onBack={() => { setShowGuide(false); setSettings((current) => homepageSettings(current)) }} onConfirm={confirmGameStart} />
          : <GameGuide settings={settings} loading={dailyLoading} error={dailyError} onBack={() => { setShowGuide(false); setSettings((current) => homepageSettings(current)) }} onConfirm={confirmGameStart} />
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
      {lineupGame && lineupGame.phase !== 'results' && currentLineupMatch && currentMissingPlayer && (
        <LineupGameScreen
          game={lineupGame}
          match={currentLineupMatch}
          missingPlayer={currentMissingPlayer}
          search={lineupSearch}
          onSubmit={submitLineupGuess}
          onGiveUp={() => finalizeLineupRound('gave-up')}
          onClue={revealLineupClue}
          onNext={nextLineup}
          onExit={exitLineupGame}
          nickname={dailyNickname}
          submitting={dailyLoading}
          error={dailyError}
          onNicknameChange={setDailyNickname}
          onDailySubmit={submitLineupDailyScore}
        />
      )}
      {lineupGame?.phase === 'results' && lineupGame.mode === 'lineup-challenge' && (
        <LineupResultsScreen
          game={lineupGame}
          highScore={savedData.lineupBestScore}
          nickname={dailyNickname}
          submitting={dailyLoading}
          submitted={lineupChallengeSubmitted}
          error={dailyError}
          boards={lineupChallengeBoards}
          onNicknameChange={setDailyNickname}
          onSubmit={submitLineupChallengeScore}
          onRefresh={refreshLineupChallengeLeaderboard}
          onPlayAgain={playLineupsAgain}
          onHome={exitLineupGame}
        />
      )}
      {lineupGame?.phase === 'results' && lineupGame.mode === 'lineup-daily' && savedData.lineupDailyCompletion && (
        <LineupDailyResultsScreen
          game={lineupGame}
          completion={savedData.lineupDailyCompletion}
          boards={lineupDailyBoards}
          loading={dailyLoading}
          error={dailyError}
          onRefresh={refreshLineupDailyLeaderboard}
          onExit={exitLineupGame}
        />
      )}

      <button
        className="settings-trigger"
        type="button"
        aria-label={t('Open settings')}
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
              aria-label={t('Close settings')}
            >
              ×
            </button>
            <span className="eyebrow">{t('Preferences and records')}</span>
            <h2 id="settings-title">{t('Settings')}</h2>
            <p>{t('Player and lineup progress and personal records live in this browser. Submitted nicknames and scores join their matching shared leaderboard.')}</p>
            <div className="settings-records">
              <span>{t('Normal high score')} <strong>{savedData.highScores.normal}</strong></span>
              <span>{t('Hardcore high score')} <strong>{savedData.highScores.hardcore}</strong></span>
              <span>{t('Lineup challenge best')} <strong>{savedData.lineupBestScore}</strong></span>
            </div>
            <button className="danger-button" type="button" onClick={handleResetSavedData}>
              {t('Reset saved data')}
            </button>
          </section>
        </div>
      )}
      <LanguageToggle />
    </div>
  )
}
