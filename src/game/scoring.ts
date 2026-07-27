import { GAME_CONFIG } from './config'

export function getClueBaseScore(clueLevel: number): number {
  const safeIndex = Math.min(Math.max(Math.trunc(clueLevel), 1), GAME_CONFIG.cluesPerRound) - 1
  return GAME_CONFIG.clueBaseScores[safeIndex]
}

export function calculateAvailableScore(clueLevel: number, totalIncorrectGuesses: number): number {
  return Math.max(
    0,
    getClueBaseScore(clueLevel) - GAME_CONFIG.incorrectGuessPenalty * Math.max(0, totalIncorrectGuesses),
  )
}
