import rawPlayers from './players.json'
import rawPlayerSearch from './playerSearch.json'
import type { Player, SearchPlayer } from './types'
import { validatePlayers } from './validation'

export const players = rawPlayers as Player[]
export const playerSearch = rawPlayerSearch as SearchPlayer[]

if (import.meta.env.DEV) {
  const errors = validatePlayers(players)
  if (errors.length) {
    throw new Error(`Football player dataset validation failed:\n${errors.join('\n')}`)
  }
}
