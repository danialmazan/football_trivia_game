import type { Player } from '../data/types'
import { GAME_CONFIG } from './config'
import { isInPool } from './eligibility'
import type { Decade, Pool, PracticeFilter } from './types'

export function assignDecade(player: Player): string {
  const eligibleSeasons = player.seasonAppearances.filter(
    (season) => season.startYear >= GAME_CONFIG.eraCutoffStartYear,
  )
  const peakSeason = [...eligibleSeasons].sort(
    (a, b) => b.appearances - a.appearances || a.startYear - b.startYear,
  )[0]
  const startYear = peakSeason.startYear
  return `${Math.floor(startYear / 10) * 10}s`
}

export function qualifiesForPractice(player: Player, filter: PracticeFilter): boolean {
  if (filter.kind === 'decade') return assignDecade(player) === filter.value
  return player.clubs.some(
    (club) =>
      club.leagueId === filter.value &&
      club.appearances >= GAME_CONFIG.minimumClueClubAppearances,
  )
}

export function getActivePool(players: Player[], pool: Pool, practiceFilter?: PracticeFilter): Player[] {
  return players.filter(
    (player) => isInPool(player, pool) && (!practiceFilter || qualifiesForPractice(player, practiceFilter)),
  )
}

export interface SelectionResult {
  player: Player
  exhausted: boolean
}

export function selectNextPlayer(
  eligiblePlayers: Player[],
  usedPlayerIds: string[],
  random: () => number = Math.random,
): SelectionResult {
  if (!eligiblePlayers.length) throw new Error('No players are available for this game configuration.')
  const unused = eligiblePlayers.filter((player) => !usedPlayerIds.includes(player.id))
  const candidates = unused.length ? unused : eligiblePlayers
  const index = Math.min(candidates.length - 1, Math.floor(Math.max(0, random()) * candidates.length))
  return { player: candidates[index], exhausted: unused.length === 0 }
}
