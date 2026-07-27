import type { Player } from '../data/types'
import { GAME_CONFIG } from './config'
import type { Pool } from './types'

export function meetsEraCutoff(player: Player): boolean {
  return player.seasonAppearances.some(
    (season) => season.startYear >= GAME_CONFIG.eraCutoffStartYear && season.appearances > 0,
  )
}

export function meetsHardcoreCriteria(player: Player): boolean {
  return (
    player.bigFiveAppearances >= GAME_CONFIG.minimumBigFiveAppearances &&
    player.clubs.some((club) => club.appearances >= GAME_CONFIG.minimumClueClubAppearances) &&
    player.nationalTeam.caps > 0
  )
}

export function isInPool(player: Player, pool: Pool): boolean {
  if (!meetsEraCutoff(player)) return false
  return pool === 'normal' ? player.normalPool : player.hardcoreEligible && meetsHardcoreCriteria(player)
}
