import type { LineupMatch } from '../data/lineupTypes'
import type { LineupGameState, LineupRoundState } from './types'
import { GAME_CONFIG } from './config'

export function calculateLineupScore(incorrectGuesses: number): number {
  return Math.max(0, 100 - incorrectGuesses * GAME_CONFIG.lineupWrongGuessPenalty)
}

function randomIndex(length: number, random: () => number): number {
  return Math.min(length - 1, Math.floor(Math.max(0, random()) * length))
}

export function selectLineupMatch(
  matches: LineupMatch[],
  usedMatchIds: string[],
  random: () => number = Math.random,
): LineupMatch {
  const unused = matches.filter((match) => !usedMatchIds.includes(match.id))
  if (!unused.length) throw new Error('No unused lineup matches are available.')
  return unused[randomIndex(unused.length, random)]
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
    incorrectGuesses: [],
    normalizedIncorrectGuesses: [],
    statusMessage: '',
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
    version: 1,
    mode: 'lineup-challenge',
    phase: 'playing',
    round: createLineupRound(match, random),
    results: [],
    usedMatchIds: [match.id],
    totalScore: 0,
    startedAt: new Date().toISOString(),
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
      round: { ...round, statusMessage: 'Already guessed — no points deducted.' },
    }
  }
  return {
    duplicate: false,
    round: {
      ...round,
      incorrectGuesses: [...round.incorrectGuesses, displayGuess.trim()],
      normalizedIncorrectGuesses: [...round.normalizedIncorrectGuesses, normalizedGuess],
      statusMessage: 'Not the missing starter. Keep going.',
    },
  }
}
