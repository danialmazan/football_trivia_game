import type { LineupMatch } from '../data/lineupTypes'
import type { LineupGameState, LineupRoundState } from './types'
import { GAME_CONFIG } from './config'

export function calculateLineupScore(
  incorrectGuesses: number,
  cluesUsed = 0,
  clueIncorrectGuessCounts: number[] = [],
): number {
  let score = 100
  let accountedFor = 0
  for (let index = 0; index < Math.min(cluesUsed, GAME_CONFIG.lineupClueScoreCaps.length); index += 1) {
    const guessesAtClue = Math.max(accountedFor, Math.min(incorrectGuesses, clueIncorrectGuessCounts[index] ?? incorrectGuesses))
    score = Math.max(0, score - (guessesAtClue - accountedFor) * GAME_CONFIG.lineupWrongGuessPenalty)
    score = Math.min(score, GAME_CONFIG.lineupClueScoreCaps[index])
    accountedFor = guessesAtClue
  }
  return Math.max(0, score - (incorrectGuesses - accountedFor) * GAME_CONFIG.lineupWrongGuessPenalty)
}

function randomIndex(length: number, random: () => number): number {
  return Math.min(length - 1, Math.floor(Math.max(0, random()) * length))
}

export function positionLineupStarter(
  x: number,
  y: number,
  teamIndex: number,
): { left: number; top: number } {
  return teamIndex === 0
    ? { left: x, top: 50 + y / 2 }
    : { left: 100 - x, top: (100 - y) / 2 }
}

export function selectLineupMatch(
  matches: LineupMatch[],
  usedMatchIds: string[],
  random: () => number = Math.random,
): LineupMatch {
  const unused = getPlayableLineupMatches(matches).filter((match) => !usedMatchIds.includes(match.id))
  if (!unused.length) throw new Error('No unused lineup matches are available.')
  return unused[randomIndex(unused.length, random)]
}

export function isPlayableLineupMatch(match: LineupMatch): boolean {
  return (
    match.seasonStart >= GAME_CONFIG.lineupActiveFirstSeason &&
    match.seasonStart <= GAME_CONFIG.lineupActiveLastSeason
  )
}

export function getPlayableLineupMatches(matches: LineupMatch[]): LineupMatch[] {
  return matches.filter(isPlayableLineupMatch)
}

export function createLineupRound(
  match: LineupMatch,
  random: () => number = Math.random,
  missingPlayerId?: string,
): LineupRoundState {
  const starters = match.teams.flatMap((team) => team.starters)
  const selectedId = missingPlayerId ?? starters[randomIndex(starters.length, random)]?.id
  if (!selectedId || !starters.some((player) => player.id === selectedId)) {
    throw new Error('The selected missing player is not in this starting lineup.')
  }
  return {
    matchId: match.id,
    missingPlayerId: selectedId,
    cluesUsed: 0,
    clueIncorrectGuessCounts: [],
    incorrectGuesses: [],
    normalizedIncorrectGuesses: [],
    statusMessage: null,
    outcome: null,
    pointsEarned: null,
  }
}

export function buildLineupChallenge(
  matches: LineupMatch[],
  random: () => number = Math.random,
): LineupGameState {
  const match = selectLineupMatch(matches, [], random)
  return {
    version: 2,
    mode: 'lineup-challenge',
    phase: 'playing',
    round: createLineupRound(match, random),
    results: [],
    usedMatchIds: [match.id],
    totalScore: 0,
    startedAt: new Date().toISOString(),
  }
}

export function revealNextLineupClue(round: LineupRoundState): LineupRoundState {
  if (round.cluesUsed >= GAME_CONFIG.lineupClueScoreCaps.length) return round
  return {
    ...round,
    cluesUsed: round.cluesUsed + 1,
    clueIncorrectGuessCounts: [
      ...round.clueIncorrectGuessCounts,
      round.incorrectGuesses.length,
    ],
    statusMessage: null,
  }
}

export function recordLineupIncorrectGuess(
  round: LineupRoundState,
  displayGuess: string,
  normalizedGuess: string,
): { round: LineupRoundState; duplicate: boolean } {
  if (round.normalizedIncorrectGuesses.includes(normalizedGuess)) {
    return {
      duplicate: true,
      round: { ...round, statusMessage: { key: 'already-guessed' } },
    }
  }
  return {
    duplicate: false,
    round: {
      ...round,
      incorrectGuesses: [...round.incorrectGuesses, displayGuess.trim()],
      normalizedIncorrectGuesses: [...round.normalizedIncorrectGuesses, normalizedGuess],
      statusMessage: { key: 'incorrect-lineup-player' },
    },
  }
}
