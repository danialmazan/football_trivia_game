export type LeagueId = 'GB1' | 'ES1' | 'IT1' | 'L1' | 'FR1'
export type BroadPosition = 'Goalkeeper' | 'Defender' | 'Midfielder' | 'Forward'
export type TitleKind =
  | 'domestic-league'
  | 'champions-league'
  | 'europa-league'
  | 'cup-winners-cup'
  | 'world-cup'
  | 'continental-national'

export interface ClubStint {
  clubId: string
  clubName: string
  leagueId: LeagueId
  leagueName: string
  appearances: number
  logoPath: string
}

export interface NationalTeam {
  teamId: string
  teamName: string
  caps: number
  goals: number
  flagCode: string
}

export interface TeamTitle {
  id: string
  label: string
  kind: TitleKind
  count: number
  rankingPoints: number
  sourceUrl: string
}

export interface SeasonAppearance {
  season: string
  startYear: number
  appearances: number
}

export interface PracticeMetric {
  appearances: number
  postCutoffAppearances?: number
  recognitionScore: number
  clueClubId?: string
}

export interface SearchPlayer {
  id: string
  displayName: string
  acceptedNames: string[]
  lastName: string
}

export interface FootballPlayer {
  id: string
  sourcePlayerId: string
  displayName: string
  acceptedNames: string[]
  firstName: string
  lastName: string
  initials: string
  active: boolean
  debutSeason: string
  finalSeason: string
  broadPosition: BroadPosition
  primaryRole: string
  secondaryRoles: string[]
  birthCountry: string
  clubs: ClubStint[]
  nationalTeam: NationalTeam
  seasonAppearances: SeasonAppearance[]
  bigFiveAppearances: number
  postCutoffBigFiveAppearances: number
  championsLeagueAppearances: number
  postCutoffChampionsLeagueAppearances: number
  postCutoffTitleRankingPoints: number
  titles: TeamTitle[]
  recognitionScore: number
  normalPool: boolean
  hardcoreEligible: boolean
  practiceRanks: Record<string, number>
  practiceMetrics: Record<string, PracticeMetric>
  sources: string[]
  provenanceNote: string
  lastVerified: string
}

export type Player = FootballPlayer
