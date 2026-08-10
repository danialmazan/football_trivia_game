import type { SearchPlayer } from './types'
import type { LineupDataset } from './lineupTypes'
import { GAME_CONFIG } from '../game/config'
import knownNames from './lineupKnownNames.json'

export const LINEUP_MATCH_COUNT = GAME_CONFIG.lineupMatchCount
export const LINEUP_ACTIVE_MATCH_COUNT = GAME_CONFIG.lineupActiveMatchCount
export const LINEUP_KNOWN_NAMES = knownNames as { sourcePlayerId: string; displayName: string; evidenceField: string }[]

export function getActiveLineupMatches(dataset: LineupDataset) {
  return dataset.matches.filter(
    (match) =>
      match.seasonStart >= GAME_CONFIG.lineupActiveFirstSeason &&
      match.seasonStart <= GAME_CONFIG.lineupActiveLastSeason,
  )
}

export function validateLineups(dataset: LineupDataset, search: SearchPlayer[]): string[] {
  const errors: string[] = []
  const matchIds = new Set<string>()
  const searchIds = new Set(search.map((player) => player.id))
  const searchById = new Map(search.map((player) => [player.id, player]))
  const knownNamesById = new Map(LINEUP_KNOWN_NAMES.map((entry) => [entry.sourcePlayerId, entry]))
  const mononymLabels = new Set<string>()
  const archivePlayers = new Map<string, { displayName: string; acceptedNames: string[] }>()
  const competitionCounts = { ucl: 0, euro: 0, 'world-cup': 0 }
  const activeCompetitionCounts = { ucl: 0, euro: 0, 'world-cup': 0 }
  const uclSeasons = new Map<number, number>()

  if (!dataset.version.trim()) errors.push('lineup roster version is required')
  if (dataset.matches.length !== LINEUP_MATCH_COUNT) {
    errors.push(`lineup dataset needs exactly ${LINEUP_MATCH_COUNT} matches`)
  }

  for (const match of dataset.matches) {
    const prefix = `[${match.id || 'missing-id'}]`
    if (matchIds.has(match.id)) errors.push(`${prefix} duplicate match ID`)
    matchIds.add(match.id)
    competitionCounts[match.competition] += 1
    if (
      match.seasonStart >= GAME_CONFIG.lineupActiveFirstSeason &&
      match.seasonStart <= GAME_CONFIG.lineupActiveLastSeason
    ) {
      activeCompetitionCounts[match.competition] += 1
    }
    if (match.competition === 'ucl') {
      uclSeasons.set(match.seasonStart, (uclSeasons.get(match.seasonStart) ?? 0) + 1)
    }
    if (!match.date || !match.kickoffLocal || !match.timezone || !match.venue) {
      errors.push(`${prefix} incomplete match metadata`)
    }
    try {
      new Intl.DateTimeFormat('en', { timeZone: match.timezone }).format()
    } catch {
      errors.push(`${prefix} invalid IANA venue timezone`)
    }
    if (match.sourceUrls.length < 2 || match.sourceUrls.some((url) => !url.startsWith('https://'))) {
      errors.push(`${prefix} incomplete provenance`)
    }
    if (match.teams.length !== 2) errors.push(`${prefix} needs exactly two teams`)
    for (const team of match.teams) {
      const playerIds = new Set<string>()
      if (!team.formation.trim()) errors.push(`${prefix} ${team.name} formation is required`)
      if (team.starters.length !== 11) errors.push(`${prefix} ${team.name} needs 11 starters`)
      if (!team.bench.length) errors.push(`${prefix} ${team.name} bench is empty`)
      for (const player of [...team.starters, ...team.bench]) {
        const existingPlayer = archivePlayers.get(player.id)
        if (existingPlayer && existingPlayer.displayName !== player.displayName) {
          errors.push(`${prefix} ${player.id} has inconsistent canonical names`)
        }
        archivePlayers.set(player.id, {
          displayName: player.displayName,
          acceptedNames: [...new Set([...(existingPlayer?.acceptedNames ?? []), ...player.acceptedNames])],
        })
        if (searchById.get(player.id)?.displayName !== player.displayName) {
          errors.push(`${prefix} ${player.id} canonical name differs from autocomplete`)
        }
        if (playerIds.has(player.id)) errors.push(`${prefix} ${team.name} repeats ${player.id}`)
        playerIds.add(player.id)
        if (!player.displayName.trim() || !player.lastName.trim()) {
          errors.push(`${prefix} ${player.id} has an incomplete name`)
        }
        if (!searchIds.has(player.id)) errors.push(`${prefix} ${player.id} is missing from autocomplete`)
      }
      for (const starter of team.starters) {
        if (starter.x < 0 || starter.x > 100 || starter.y < 0 || starter.y > 100) {
          errors.push(`${prefix} ${starter.id} has invalid pitch coordinates`)
        }
        if (!starter.nationality?.trim()) {
          errors.push(`${prefix} ${starter.id} is missing a nationality clue`)
        }
        if (match.competition !== 'ucl' && !starter.seasonClub?.trim()) {
          errors.push(`${prefix} ${starter.id} is missing a season-club clue`)
        }
      }
    }
  }

  for (const [playerId, player] of archivePlayers) {
    if (player.displayName.trim().split(/\s+/).length !== 1) continue
    const normalized = player.displayName.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    if (mononymLabels.has(normalized)) errors.push(`duplicate normalized mononym ${player.displayName}`)
    mononymLabels.add(normalized)
    if (!knownNamesById.has(playerId.replace(/^tm-player-/, ''))) {
      errors.push(`non-allowlisted one-token archive name ${player.displayName}`)
    }
  }

  for (const entry of LINEUP_KNOWN_NAMES) {
    if (!entry.sourcePlayerId.trim() || !entry.displayName.trim() || !['artistName', 'playerPoolDisplayName'].includes(entry.evidenceField)) {
      errors.push(`invalid lineup known-name override ${entry.sourcePlayerId}`)
    }
    const player = archivePlayers.get(`tm-player-${entry.sourcePlayerId}`)
    if (!player) errors.push(`lineup known-name override ID ${entry.sourcePlayerId} is not in the archive`)
    else if (player.displayName !== entry.displayName) errors.push(`lineup known-name override mismatch for ${entry.sourcePlayerId}`)
  }

  if (competitionCounts.ucl !== 153) errors.push('lineup dataset needs 153 UCL matches')
  if (competitionCounts.euro !== 24) errors.push('lineup dataset needs 24 EURO matches')
  if (competitionCounts['world-cup'] !== 24) errors.push('lineup dataset needs 24 World Cup matches')
  const activeMatches = getActiveLineupMatches(dataset)
  if (activeMatches.length !== LINEUP_ACTIVE_MATCH_COUNT) {
    errors.push(`active lineup dataset needs exactly ${LINEUP_ACTIVE_MATCH_COUNT} matches`)
  }
  if (activeCompetitionCounts.ucl !== 103) errors.push('active lineup dataset needs 103 UCL matches')
  if (activeCompetitionCounts.euro !== 15) errors.push('active lineup dataset needs 15 EURO matches')
  if (activeCompetitionCounts['world-cup'] !== 18) errors.push('active lineup dataset needs 18 World Cup matches')
  for (let season = 1995; season <= 2025; season += 1) {
    const expected = season === 2019 ? 3 : 5
    if (uclSeasons.get(season) !== expected) {
      errors.push(`UCL ${season} needs ${expected} semifinal/final matches`)
    }
  }
  return errors
}
