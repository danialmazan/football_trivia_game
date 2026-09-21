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
  expireDailyResult,
  sendDailyAttemptEvent,
  startDailyAttempt,
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
  expireLineupDailyResult,
  sendLineupDailyAttemptEvent,
  startLineupDailyAttempt,
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
  DailyAttemptEvent,
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
  const [syncingDailyEvent, setSyncingDailyEvent] = useState(false)
  const [syncingLineupEvent, setSyncingLineupEvent] = useState(false)
  const [dailySyncPaused, setDailySyncPaused] = useState(false)
  const [lineupSyncPaused, setLineupSyncPaused] = useState(false)

  useEffect(() => {
    saveData(savedData)
  }, [savedData])

  useEffect(() => {
    const resumeSync = () => {
      setDailySyncPaused(false)
      setLineupSyncPaused(false)
    }
    window.addEventListener('online', resumeSync)
    return () => window.removeEventListener('online', resumeSync)
  }, [])

  useEffect(() => {
    const event = savedData.pendingDailyEvents[0]
    if (!event || !game?.dailyChallenge || game.settings.mode !== 'daily' || syncingDailyEvent || dailySyncPaused) return
    setSyncingDailyEvent(true)
    setDailyError(null)
    void sendDailyAttemptEvent({
      challengeDate: game.dailyChallenge.date,
      attemptToken: game.dailyChallenge.attemptToken,
      revision: game.dailyChallenge.attemptRevision ?? 0,
      event,
    }).then((response) => {
      if (response.status === 'resolved') {
        const resolvedBoards = response.boards ?? EMPTY_LEADERBOARD_BOARDS
        const player = players.find((candidate) => candidate.id === game.round.playerId)
        const outcome = game.round.outcome ?? (event.type === 'correct' ? 'correct' : 'gave-up')
        const finished: GameState = game.phase === 'review'
          ? { ...game, phase: 'results', totalScore: response.points }
          : {
              ...game,
              phase: 'results',
              round: { ...game.round, outcome, pointsEarned: response.points },
              results: [{ playerId: game.round.playerId, playerName: player?.displayName ?? '', outcome, points: response.points, cluesUsed: game.round.clueLevel, incorrectGuesses: game.round.incorrectGuesses }],
              totalScore: response.points,
            }
        const completion: DailyCompletion = { date: response.date, nickname: response.nickname, points: response.points, rank: response.rank, leaderboard: response.leaderboard, boards: resolvedBoards }
        setDailyBoards(resolvedBoards)
        setGame(finished)
        setSavedData((current) => ({ ...current, dailyGame: finished, dailyCompletion: completion, lastNickname: response.nickname, pendingDailyEvents: [] }))
        return
      }
      if (response.status === 'stale') {
        setGame((current) => current ? {
          ...current,
          phase: 'playing',
          results: [],
          totalScore: 0,
          dailyChallenge: response.challenge,
          round: { ...current.round, ...response.progress, outcome: null, pointsEarned: null, statusMessage: null },
        } : current)
        setDailyError('This game was updated in another browser. The latest progress has been restored.')
        setSavedData((current) => ({ ...current, pendingDailyEvents: [] }))
        return
      }
      if (response.status === 'resume-required') return
      setGame((current) => current ? { ...current, dailyChallenge: response.challenge } : current)
      setSavedData((current) => ({ ...current, pendingDailyEvents: current.pendingDailyEvents.slice(1) }))
    }).catch((error) => {
      setDailySyncPaused(true)
      setDailyError(error instanceof Error ? error.message : 'Could not save your result. Your progress is waiting to sync.')
    }).finally(() => setSyncingDailyEvent(false))
  }, [dailySyncPaused, game, savedData.pendingDailyEvents, syncingDailyEvent])

  useEffect(() => {
    const event = savedData.pendingLineupDailyEvents[0]
    if (!event || !lineupGame?.dailyChallenge || lineupGame.mode !== 'lineup-daily' || syncingLineupEvent || lineupSyncPaused) return
    setSyncingLineupEvent(true)
    setDailyError(null)
    void sendLineupDailyAttemptEvent({
      challengeDate: lineupGame.dailyChallenge.date,
      attemptToken: lineupGame.dailyChallenge.attemptToken,
      revision: lineupGame.dailyChallenge.attemptRevision ?? 0,
      event,
    }).then((response) => {
      if (response.status === 'resolved') {
        const resolvedBoards = response.boards ?? EMPTY_LEADERBOARD_BOARDS
        const match = lineupDataset?.matches.find((candidate) => candidate.id === lineupGame.round.matchId)
        const player = match?.teams.flatMap((team) => team.starters).find((candidate) => candidate.id === lineupGame.round.missingPlayerId)
        const outcome = lineupGame.round.outcome ?? (event.type === 'correct' ? 'correct' : 'gave-up')
        const finished: LineupGameState = lineupGame.phase === 'review'
          ? { ...lineupGame, phase: 'results', totalScore: response.points }
          : { ...lineupGame, phase: 'results', round: { ...lineupGame.round, outcome, pointsEarned: response.points }, results: [{ matchId: lineupGame.round.matchId, matchLabel: match ? `${match.homeTeam.name} vs ${match.awayTeam.name}` : '', playerId: lineupGame.round.missingPlayerId, playerName: player?.displayName ?? '', outcome, points: response.points, cluesUsed: lineupGame.round.cluesUsed, clueIncorrectGuessCounts: lineupGame.round.clueIncorrectGuessCounts, incorrectGuesses: lineupGame.round.incorrectGuesses }], totalScore: response.points }
        const completion: DailyCompletion = { date: response.date, nickname: response.nickname, points: response.points, rank: response.rank, leaderboard: response.leaderboard, boards: resolvedBoards }
        setLineupDailyBoards(resolvedBoards)
        setLineupGame(finished)
        setSavedData((current) => ({ ...current, lineupDailyGame: finished, lineupDailyCompletion: completion, lastNickname: response.nickname, pendingLineupDailyEvents: [] }))
        return
      }
      if (response.status === 'stale') {
        setLineupGame((current) => current ? { ...current, phase: 'playing', results: [], totalScore: 0, dailyChallenge: response.challenge, round: { ...current.round, ...response.progress, outcome: null, pointsEarned: null, statusMessage: null } } : current)
        setDailyError('This game was updated in another browser. The latest progress has been restored.')
        setSavedData((current) => ({ ...current, pendingLineupDailyEvents: [] }))
        return
      }
      if (response.status === 'resume-required') return
      setLineupGame((current) => current ? { ...current, dailyChallenge: response.challenge } : current)
      setSavedData((current) => ({ ...current, pendingLineupDailyEvents: current.pendingLineupDailyEvents.slice(1) }))
    }).catch((error) => {
      setLineupSyncPaused(true)
      setDailyError(error instanceof Error ? error.message : 'Could not save your lineup result. Your progress is waiting to sync.')
    }).finally(() => setSyncingLineupEvent(false))
  }, [lineupDataset, lineupGame, lineupSyncPaused, savedData.pendingLineupDailyEvents, syncingLineupEvent])

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
    if (savedData.dailyGame?.dailyChallenge?.date && savedData.dailyGame.dailyChallenge.date < getUtcDateKey()) {
      void settleExpiredDailyGame(savedData.dailyGame)
    }
    if (savedData.lineupDailyGame?.dailyChallenge?.date && savedData.lineupDailyGame.dailyChallenge.date < getUtcDateKey()) {
      void settleExpiredLineupGame(savedData.lineupDailyGame)
    }
    // Recovery for a browser that was closed at midnight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (game?.settings.mode !== 'daily' || !game.dailyChallenge) return
    const delay = new Date(game.dailyChallenge.expiresAt).getTime() - Date.now()
    if (delay <= 0) {
      void settleExpiredDailyGame(game)
      return
    }
    const timer = window.setTimeout(() => void settleExpiredDailyGame(game), Math.min(delay, 2_147_000_000))
    return () => window.clearTimeout(timer)
  }, [game?.dailyChallenge?.expiresAt])

  useEffect(() => {
    if (lineupGame?.mode !== 'lineup-daily' || !lineupGame.dailyChallenge) return
    const delay = new Date(lineupGame.dailyChallenge.expiresAt).getTime() - Date.now()
    if (delay <= 0) {
      void settleExpiredLineupGame(lineupGame)
      return
    }
    const timer = window.setTimeout(() => void settleExpiredLineupGame(lineupGame), Math.min(delay, 2_147_000_000))
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
      nickname: dailyNickname.trim(),
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
      nickname: dailyNickname.trim(),
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
      nickname: dailyNickname.trim(),
      dailyChallenge: challenge,
    }
  }

  async function confirmLineupGameStart() {
    if (!isValidNickname(dailyNickname)) {
      setDailyError('Enter your name or nickname before playing.')
      return
    }
    setDailyLoading(true)
    setDailyError(null)
    try {
      const loaded = await ensureLineupData()
      let builtGame: LineupGameState
      if (settings.mode === 'lineup-daily') {
        const local = savedData.lineupDailyGame?.dailyChallenge?.date === getUtcDateKey()
          ? savedData.lineupDailyGame.round
          : null
        let response = await startLineupDailyAttempt({
          installationId: savedData.installationId,
          nickname: dailyNickname.trim(),
          localProgress: local ? {
            cluesUsed: local.cluesUsed,
            clueIncorrectGuessCounts: local.clueIncorrectGuessCounts,
            incorrectGuesses: local.incorrectGuesses,
            normalizedIncorrectGuesses: local.normalizedIncorrectGuesses,
          } : undefined,
        })
        if (response.status === 'resume-required') {
          if (!window.confirm(t('An unfinished Lineup of the Day already exists for {nickname}. Continue it here?', { nickname: response.nickname }))) return
          response = await startLineupDailyAttempt({ installationId: savedData.installationId, nickname: dailyNickname.trim(), confirmResume: true })
        }
        if (response.status === 'resolved') {
          const challenge = await getLineupDailyChallenge(savedData.installationId)
          const base = buildLineupDailyGame(challenge, loaded.dataset.matches)
          const match = loaded.dataset.matches.find((candidate) => candidate.id === challenge.matchId)!
          const player = match.teams.flatMap((team) => team.starters).find((candidate) => candidate.id === challenge.missingPlayerId)!
          const finished: LineupGameState = { ...base, phase: 'results', round: { ...base.round, outcome: response.points > 0 ? 'correct' : 'gave-up', pointsEarned: response.points }, results: [{ matchId: match.id, matchLabel: `${match.homeTeam.name} vs ${match.awayTeam.name}`, playerId: player.id, playerName: player.displayName, outcome: response.points > 0 ? 'correct' : 'gave-up', points: response.points, cluesUsed: 0, clueIncorrectGuessCounts: [], incorrectGuesses: [] }], totalScore: response.points }
          const completion: DailyCompletion = { date: response.date, nickname: response.nickname, points: response.points, rank: response.rank, leaderboard: response.leaderboard, boards: response.boards }
          setLineupDailyBoards(response.boards)
          setLineupGame(finished)
          setShowGuide(false)
          setSavedData((current) => ({ ...current, lineupDailyGame: finished, lineupDailyCompletion: completion, lastNickname: response.nickname, pendingLineupDailyEvents: [] }))
          return
        }
        if (response.status === 'resume-required') throw new Error('Could not confirm the unfinished lineup game.')
        builtGame = buildLineupDailyGame(response.challenge, loaded.dataset.matches)
        builtGame = { ...builtGame, nickname: response.nickname, round: { ...builtGame.round, ...response.progress } }
      } else {
        builtGame = buildLineupChallenge(loaded.dataset.matches)
      }
      const newGame = { ...builtGame, nickname: builtGame.nickname ?? dailyNickname.trim() }
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
        if (currentDaily?.dailyChallenge?.date === getUtcDateKey() && currentDaily.nickname) {
          if (currentDaily.phase !== 'results' || !savedData.lineupDailyCompletion) {
            setDailyNickname(currentDaily.nickname)
            setShowGuide(true)
            return
          }
          setDailyLoading(true)
          void ensureLineupData()
            .then(() => {
              setLineupDailyBoards(savedData.lineupDailyCompletion?.boards ?? EMPTY_LEADERBOARD_BOARDS)
              setDailyNickname(currentDaily.nickname ?? savedData.lineupDailyCompletion?.nickname ?? savedData.lastNickname)
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
      if (currentDaily?.dailyChallenge?.date === getUtcDateKey() && currentDaily.nickname) {
        if (currentDaily.phase !== 'results' || !savedData.dailyCompletion) {
          setDailyNickname(currentDaily.nickname)
          setShowGuide(true)
          return
        }
        setDailyBoards(savedData.dailyCompletion?.boards ?? EMPTY_LEADERBOARD_BOARDS)
        setDailyNickname(currentDaily.nickname)
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
    if (!isValidNickname(dailyNickname)) {
      setDailyError('Enter your name or nickname before playing.')
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
      const local = savedData.dailyGame?.dailyChallenge?.date === getUtcDateKey() ? savedData.dailyGame.round : null
      let response = await startDailyAttempt({
        installationId: savedData.installationId,
        nickname: dailyNickname.trim(),
        localProgress: local ? { clueLevel: local.clueLevel, incorrectGuesses: local.incorrectGuesses, normalizedIncorrectGuesses: local.normalizedIncorrectGuesses } : undefined,
      })
      if (response.status === 'resume-required') {
        if (!window.confirm(t('An unfinished Player of the Day already exists for {nickname}. Continue it here?', { nickname: response.nickname }))) return
        response = await startDailyAttempt({ installationId: savedData.installationId, nickname: dailyNickname.trim(), confirmResume: true })
      }
      if (response.status === 'resolved') {
        const challenge = await getDailyChallenge(savedData.installationId)
        const base = buildDailyGame(challenge)
        const player = players.find((candidate) => candidate.id === challenge.playerId)!
        const outcome: RoundOutcome = response.points > 0 ? 'correct' : 'gave-up'
        const finished: GameState = { ...base, phase: 'results', round: { ...base.round, outcome, pointsEarned: response.points }, results: [{ playerId: player.id, playerName: player.displayName, outcome, points: response.points, cluesUsed: 1, incorrectGuesses: [] }], totalScore: response.points }
        const completion: DailyCompletion = { date: response.date, nickname: response.nickname, points: response.points, rank: response.rank, leaderboard: response.leaderboard, boards: response.boards }
        setDailyBoards(response.boards)
        setGame(finished)
        setShowGuide(false)
        setSavedData((current) => ({ ...current, dailyGame: finished, dailyCompletion: completion, lastNickname: response.nickname, pendingDailyEvents: [] }))
        return
      }
      if (response.status === 'resume-required') throw new Error('Could not confirm the unfinished daily game.')
      let newGame = buildDailyGame(response.challenge)
      newGame = { ...newGame, nickname: response.nickname, round: { ...newGame.round, ...response.progress } }
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
      setDailyNickname(savedData.unfinishedGame.nickname ?? savedData.lastNickname)
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
        setDailyNickname(unfinished.nickname ?? savedData.lastNickname)
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

  function queueDailyEvent(event: DailyAttemptEvent) {
    setDailySyncPaused(false)
    setSavedData((current) => ({ ...current, pendingDailyEvents: [...current.pendingDailyEvents, event] }))
  }

  function queueLineupDailyEvent(event: DailyAttemptEvent) {
    setLineupSyncPaused(false)
    setSavedData((current) => ({ ...current, pendingLineupDailyEvents: [...current.pendingLineupDailyEvents, event] }))
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
    if (game.settings.mode === 'daily') {
      queueDailyEvent(outcome === 'correct'
        ? { type: 'correct', answerId: currentPlayer.id }
        : { type: 'give-up' })
    }
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
    if (game.settings.mode === 'daily' && !update.duplicate) {
      queueDailyEvent({ type: 'incorrect-guess', guess: guess.trim(), normalizedGuess: normalizeAnswer(guess) })
    }
  }

  function revealClue() {
    if (!game || game.phase !== 'playing') return
    const round = revealNextClue(game.round)
    setGame({ ...game, round })
    if (game.settings.mode === 'daily' && round.clueLevel !== game.round.clueLevel) queueDailyEvent({ type: 'reveal-clue' })
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
    if (lineupGame.mode === 'lineup-daily') {
      queueLineupDailyEvent(outcome === 'correct'
        ? { type: 'correct', answerId: currentMissingPlayer.id }
        : { type: 'give-up' })
    }
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
    if (lineupGame.mode === 'lineup-daily' && !update.duplicate) {
      queueLineupDailyEvent({ type: 'incorrect-guess', guess: guess.trim(), normalizedGuess: normalizeAnswer(guess) })
    }
  }

  function revealLineupClue() {
    if (!lineupGame || lineupGame.phase !== 'playing') return
    const round = revealNextLineupClue(lineupGame.round)
    setLineupGame({ ...lineupGame, round })
    if (lineupGame.mode === 'lineup-daily' && round.cluesUsed !== lineupGame.round.cluesUsed) queueLineupDailyEvent({ type: 'reveal-clue' })
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
        void settleExpiredLineupGame(lineupGame)
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
        void settleExpiredDailyGame(game)
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

  async function settleExpiredDailyGame(expiredGame: GameState) {
    const challenge = expiredGame.dailyChallenge
    if (!challenge) return
    const nickname = expiredGame.nickname?.trim() || dailyNickname.trim() || savedData.lastNickname.trim()
    try {
      if (expiredGame.phase !== 'results' && isValidNickname(nickname)) {
        setDailyLoading(true)
        if (challenge.attemptRevision !== undefined) {
          await sendDailyAttemptEvent({ challengeDate: challenge.date, attemptToken: challenge.attemptToken, revision: challenge.attemptRevision, event: { type: 'give-up' } })
        } else {
          await expireDailyResult({
            challengeDate: challenge.date,
            attemptToken: challenge.attemptToken,
            nickname,
            outcome: 'gave-up',
            cluesUsed: expiredGame.round.clueLevel,
            incorrectGuesses: expiredGame.round.incorrectGuesses.length,
          })
        }
      }
      if (game?.dailyChallenge?.date === challenge.date) setGame(null)
      setShowGuide(false)
      setSettings((current) => homepageSettings(current))
      setDailyBoards(EMPTY_LEADERBOARD_BOARDS)
      setDailyError('A new Player of the day is now available.')
      setSavedData((current) => ({ ...current, dailyGame: null, dailyCompletion: null }))
    } catch (error) {
      setDailyError(error instanceof Error ? error.message : 'Could not save the expired Player of the Day.')
    } finally {
      setDailyLoading(false)
    }
  }

  async function settleExpiredLineupGame(expiredGame: LineupGameState) {
    const challenge = expiredGame.dailyChallenge
    if (!challenge) return
    const nickname = expiredGame.nickname?.trim() || dailyNickname.trim() || savedData.lastNickname.trim()
    try {
      if (expiredGame.phase !== 'results' && isValidNickname(nickname)) {
        setDailyLoading(true)
        if (challenge.attemptRevision !== undefined) {
          await sendLineupDailyAttemptEvent({ challengeDate: challenge.date, attemptToken: challenge.attemptToken, revision: challenge.attemptRevision, event: { type: 'give-up' } })
        } else {
          await expireLineupDailyResult({
            challengeDate: challenge.date,
            attemptToken: challenge.attemptToken,
            nickname,
            outcome: 'gave-up',
            cluesUsed: expiredGame.round.cluesUsed,
            clueIncorrectGuessCounts: expiredGame.round.clueIncorrectGuessCounts,
            incorrectGuesses: expiredGame.round.incorrectGuesses.length,
          })
        }
      }
      if (lineupGame?.dailyChallenge?.date === challenge.date) setLineupGame(null)
      setShowGuide(false)
      setSettings((current) => homepageSettings(current))
      setLineupDailyBoards(EMPTY_LEADERBOARD_BOARDS)
      setDailyError('A new Lineup of the day is now available.')
      setSavedData((current) => ({ ...current, lineupDailyGame: null, lineupDailyCompletion: null }))
    } catch (error) {
      setDailyError(error instanceof Error ? error.message : 'Could not save the expired Lineup of the Day.')
    } finally {
      setDailyLoading(false)
    }
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
          ? <LineupGuide settings={settings} loading={dailyLoading} error={dailyError} nickname={dailyNickname} onNicknameChange={setDailyNickname} onBack={() => { setShowGuide(false); setSettings((current) => homepageSettings(current)) }} onConfirm={confirmGameStart} />
          : <GameGuide settings={settings} loading={dailyLoading} error={dailyError} nickname={dailyNickname} onNicknameChange={setDailyNickname} onBack={() => { setShowGuide(false); setSettings((current) => homepageSettings(current)) }} onConfirm={confirmGameStart} />
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
          dailySubmitting={syncingDailyEvent}
          dailyError={dailyError}
          onDailyRetry={() => { setDailyError(null); setDailySyncPaused(false) }}
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
          submitting={syncingLineupEvent}
          error={dailyError}
          onDailyRetry={() => { setDailyError(null); setLineupSyncPaused(false) }}
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
