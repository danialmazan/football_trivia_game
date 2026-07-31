import type { Player } from './types'
import { generateClues } from '../game/clues'
import { GAME_CONFIG } from '../game/config'
import { meetsEraCutoff, meetsHardcoreCriteria, meetsNormalCriteria } from '../game/eligibility'
import type { PracticeFilter } from '../game/types'

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
    if (player.normalPool && !meetsNormalCriteria(player)) errors.push(`${prefix} does not satisfy the Normal rules`)
    if ((player.normalPool || player.hardcoreEligible) && !meetsHardcoreCriteria(player)) {
      errors.push(`${prefix} does not satisfy the base eligibility rules`)
    }
    if (!meetsEraCutoff(player)) errors.push(`${prefix} does not overlap 1995-96 or later`)
    const practiceKeys = Object.entries(player.practiceRanks).filter(([, rank]) => rank <= 300)
    if (!player.hardcoreEligible && !practiceKeys.length) {
      errors.push(`${prefix} is in neither a main nor practice pool`)
    }
    for (const [key, rank] of practiceKeys) {
      if (rank < 1 || rank > 300) errors.push(`${prefix} has invalid ${key} rank`)
      if ((player.practiceMetrics[key]?.appearances ?? 0) < 50) {
        errors.push(`${prefix} has fewer than 50 appearances for ${key}`)
      }
    }
    if (player.titles.some((title) => title.count <= 0 || title.rankingPoints <= 0)) {
      errors.push(`${prefix} has an invalid team-title record`)
    }
    if (!player.sources?.length && !player.provenanceNote?.trim()) errors.push(`${prefix} needs a source or provenance note`)
    try {
      let filter: PracticeFilter | undefined
      if (!player.hardcoreEligible && practiceKeys.length) {
        const [kind, value] = practiceKeys[0][0].split(':')
        filter = { kind, value } as PracticeFilter
      }
      if (generateClues(player, 0, filter).length !== 5) errors.push(`${prefix} did not generate five clues`)
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
  for (const key of [
    ...['1990s', '2000s', '2010s', '2020s'].map((value) => `decade:${value}`),
    ...['GB1', 'ES1', 'IT1', 'L1', 'FR1'].map((value) => `league:${value}`),
  ]) {
    const normal = players.filter((player) => (player.practiceRanks[key] ?? Infinity) <= 100).length
    const hardcore = players.filter((player) => (player.practiceRanks[key] ?? Infinity) <= 300).length
    if (normal !== 100) errors.push(`${key} needs exactly 100 Normal practice players`)
    if (hardcore !== 300) errors.push(`${key} needs exactly 300 Hardcore practice players`)
  }
  return errors
}
