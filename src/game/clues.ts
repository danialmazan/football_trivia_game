import type { ClubStint, Player, TeamTitle } from '../data/types'
import type { PracticeFilter } from './types'

export interface TeamClueData {
  kind: 'teams'
  label: string
  teams: ClubStint[]
  decades: string[]
}

export interface TextClueData {
  kind: 'text'
  label: string
  text: string
}

export type Clue = TeamClueData | TextClueData

export function getMainTeams(player: Player): ClubStint[] {
  return [...player.clubs]
    .sort((a, b) => b.appearances - a.appearances || a.clubName.localeCompare(b.clubName))
    .slice(0, Math.min(2, player.clubs.length))
}

export function getTeamClueCandidates(
  player: Player,
  practiceFilter?: PracticeFilter,
): ClubStint[] {
  if (practiceFilter) {
    const clueClubId = player.practiceMetrics[`${practiceFilter.kind}:${practiceFilter.value}`]?.clueClubId
    const selected = player.clubs.find((club) => club.clubId === clueClubId)
    return selected ? [selected] : []
  }
  return player.clubs.filter((club) => club.appearances >= 50)
}

export function getTeamClue(
  player: Player,
  clueSeed = 0,
  practiceFilter?: PracticeFilter,
): ClubStint {
  const candidates = getTeamClueCandidates(player, practiceFilter)
  if (!candidates.length) throw new Error(`No qualifying clue club for ${player.displayName}`)
  return candidates[Math.abs(Math.trunc(clueSeed)) % candidates.length]
}

export function getCareerDecades(player: Player): string[] {
  return [...new Set(
    player.seasonAppearances.map(({ startYear }) => `${Math.floor(startYear / 10) * 10}s`),
  )].sort()
}

function formatTitle(title: TeamTitle): string {
  return `${title.count}× ${title.label}`
}

export function getTitleHighlights(player: Player): string[] {
  if (player.titles.length) {
    const club = player.titles.filter(
      (title) => title.kind !== 'world-cup' && title.kind !== 'continental-national',
    )
    const national = player.titles.filter(
      (title) => title.kind === 'world-cup' || title.kind === 'continental-national',
    )
    const selected = [...club.slice(0, 3), ...national.slice(0, national.length ? 1 : 0)]
      .sort((a, b) => b.rankingPoints - a.rankingPoints || a.label.localeCompare(b.label))
      .slice(0, 4)
    return selected.map(formatTitle)
  }

  const milestones: string[] = []
  if (player.championsLeagueAppearances > 0) {
    milestones.push(`${player.championsLeagueAppearances} Champions League appearances`)
  }
  if (player.nationalTeam.caps > 0) milestones.push(`${player.nationalTeam.caps} senior caps`)
    if (!milestones.length) milestones.push(`${player.bigFiveAppearances} appearances in the Big-Five leagues`)
  return milestones
}

export function generateClues(
  player: Player,
  clueSeed = 0,
  practiceFilter?: PracticeFilter,
): Clue[] {
  return [
    {
      kind: 'teams',
      label: 'Club & career era',
      teams: [getTeamClue(player, clueSeed, practiceFilter)],
      decades: getCareerDecades(player),
    },
    {
      kind: 'text',
      label: 'National team',
      text: `${player.nationalTeam.teamName} · ${player.nationalTeam.caps} caps`,
    },
    { kind: 'text', label: player.titles.length ? 'Major team titles' : 'Career milestones', text: getTitleHighlights(player).join(' · ') },
    { kind: 'text', label: 'Position', text: `${player.broadPosition} · ${player.primaryRole}` },
    { kind: 'text', label: 'Initials', text: `Initials: ${player.initials}` },
  ]
}

export function getCareerSummary(player: Player): string {
  const team = getMainTeams(player)[0]
  const keyAchievement = getTitleHighlights(player)[0].toLowerCase()
  return `${player.broadPosition} · ${player.bigFiveAppearances.toLocaleString('en-US')} appearances in the Big-Five leagues · Most appearances for ${team.clubName} · ${keyAchievement}.`
}
