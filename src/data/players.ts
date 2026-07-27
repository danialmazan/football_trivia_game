import rawPlayers from './players.json'
import type { Player } from './types'
import { validatePlayers } from './validation'

export const players = rawPlayers as Player[]

if (import.meta.env.DEV) {
  const errors = validatePlayers(players)
  if (errors.length) {
    throw new Error(`Football player dataset validation failed:\n${errors.join('\n')}`)
  }
}
