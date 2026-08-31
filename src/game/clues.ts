import type { ClubStint, Player, TeamTitle } from '../data/types'
import type { PracticeFilter } from './types'
import { translate, translateCountryName, translateFootballTerm, type Locale } from '../i18n'

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

export function getTitleHighlights(player: Player, locale: Locale = 'en'): string[] {
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
    milestones.push(translate(locale, '{count} Champions League appearances', { count: player.championsLeagueAppearances }))
  }
  if (player.nationalTeam.caps > 0) milestones.push(translate(locale, '{count} senior caps', { count: player.nationalTeam.caps }))
    if (!milestones.length) milestones.push(translate(locale, '{count} appearances in the Big-Five leagues', { count: player.bigFiveAppearances }))
  return milestones
}

export function generateClues(
  player: Player,
  clueSeed = 0,
  practiceFilter?: PracticeFilter,
  locale: Locale = 'en',
): Clue[] {
  return [
    {
      kind: 'teams',
      label: translate(locale, 'Club & career era'),
      teams: [getTeamClue(player, clueSeed, practiceFilter)],
      decades: getCareerDecades(player),
    },
    {
      kind: 'text',
      label: translate(locale, 'National team'),
      text: `${translateCountryName(locale, player.nationalTeam.teamName)} · ${translate(locale, '{caps} caps', { caps: player.nationalTeam.caps })}`,
    },
    { kind: 'text', label: translate(locale, player.titles.length ? 'Major team titles' : 'Career milestones'), text: getTitleHighlights(player, locale).join(' · ') },
    { kind: 'text', label: translate(locale, 'Position'), text: `${translateFootballTerm(locale, player.broadPosition)} · ${translateFootballTerm(locale, player.primaryRole)}` },
    { kind: 'text', label: translate(locale, 'Initials'), text: translate(locale, 'Initials: {initials}', { initials: player.initials }) },
  ]
}

export function getCareerSummary(player: Player, locale: Locale = 'en'): string {
  const team = getMainTeams(player)[0]
  const keyAchievement = getTitleHighlights(player, locale)[0].toLocaleLowerCase(locale)
  return translate(locale, '{position} · {appearances} appearances in the Big-Five leagues · Most appearances for {club} · {achievement}.', {
    position: translateFootballTerm(locale, player.broadPosition),
    appearances: player.bigFiveAppearances.toLocaleString(locale === 'es' ? 'es-ES' : 'en-US'),
    club: team.clubName,
    achievement: keyAchievement,
  })
}
