import { GAME_CONFIG } from './config'
import type { RoundState } from './types'

export function createRound(playerId: string, random: () => number = Math.random): RoundState {
  return {
    playerId,
    clueLevel: 1,
    clueSeed: Math.floor(random() * 1_000_000),
    incorrectGuesses: [],
    normalizedIncorrectGuesses: [],
    statusMessage: null,
    outcome: null,
    pointsEarned: null,
  }
}

export function revealNextClue(round: RoundState): RoundState {
  if (round.clueLevel >= GAME_CONFIG.cluesPerRound || round.outcome) return round
  return {
    ...round,
    clueLevel: round.clueLevel + 1,
    statusMessage: { key: 'clue-revealed', number: round.clueLevel + 1 },
  }
}

export function recordIncorrectGuess(
  round: RoundState,
  displayGuess: string,
  normalizedGuess: string,
): { round: RoundState; duplicate: boolean } {
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
      statusMessage: { key: 'incorrect-player' },
    },
  }
}
