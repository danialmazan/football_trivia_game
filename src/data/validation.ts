import type { Player } from './types'
import { generateClues } from '../game/clues'
import { GAME_CONFIG } from '../game/config'
import { meetsEraCutoff, meetsHardcoreCriteria } from '../game/eligibility'

export function validatePlayers(players: Player[]): string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  for (const player of players) {
    const prefix = `[${player.id || 'missing-id'}]`
    if (ids.has(player.id)) errors.push(`${prefix} duplicate player ID`)
    ids.add(player.id)
    if (!player.acceptedNames?.length) errors.push(`${prefix} needs at least one accepted answer`)
    if (!player.clubs?.length) errors.push(`${prefix} needs at least one Big-Five club`)
    if (player.clubs?.some((club) => club.appearances < 0)) errors.push(`${prefix} has negative club totals`)
    if (!player.initials?.trim()) errors.push(`${prefix} initials are required`)
    if (player.bigFiveAppearances !== player.clubs.reduce((sum, club) => sum + club.appearances, 0)) {
      errors.push(`${prefix} Big-Five total does not match club totals`)
    }
    if (player.nationalTeam?.caps <= 0) errors.push(`${prefix} needs a senior national team`)
    if (player.normalPool && !player.hardcoreEligible) errors.push(`${prefix} Normal player must be Hardcore-eligible`)
    if (!meetsHardcoreCriteria(player)) errors.push(`${prefix} does not satisfy the base eligibility rules`)
    if (!meetsEraCutoff(player)) errors.push(`${prefix} does not overlap 1995-96 or later`)
    if (player.titles.some((title) => title.count <= 0 || title.rankingPoints <= 0)) {
      errors.push(`${prefix} has an invalid team-title record`)
    }
    if (!player.sources?.length && !player.provenanceNote?.trim()) errors.push(`${prefix} needs a source or provenance note`)
    try {
      if (generateClues(player).length !== 5) errors.push(`${prefix} did not generate five clues`)
    } catch (error) {
      errors.push(`${prefix} clue generation failed: ${(error as Error).message}`)
    }
  }
  if (players.filter((player) => player.normalPool).length !== GAME_CONFIG.normalPoolSize) {
    errors.push(`dataset needs exactly ${GAME_CONFIG.normalPoolSize} Normal players`)
  }
  if (players.filter((player) => player.hardcoreEligible).length !== GAME_CONFIG.hardcorePoolSize) {
    errors.push(`dataset needs exactly ${GAME_CONFIG.hardcorePoolSize} Hardcore players`)
  }
  return errors
}
