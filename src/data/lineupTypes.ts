import type { SearchPlayer } from './types'

export type LineupCompetition = 'ucl' | 'euro' | 'world-cup'

export interface LineupStarter extends SearchPlayer {
  sourcePlayerId: string
  shirtNumber: string
  x: number
  y: number
  nationality: string
  seasonClub: string
}

export interface LineupBenchPlayer extends SearchPlayer {
  sourcePlayerId: string
  shirtNumber: string
  position: string
}

export interface LineupTeam {
  id: string
  name: string
  formation: string
  starters: LineupStarter[]
  bench: LineupBenchPlayer[]
}

export interface LineupMatch {
  id: string
  sourceMatchId: string
  competition: LineupCompetition
  competitionLabel: string
  edition: string
  seasonStart: number
  stage: string
  date: string
  kickoffLocal: string
  timezone: string
  venue: string
  homeTeam: { id: string; name: string }
  awayTeam: { id: string; name: string }
  teams: [LineupTeam, LineupTeam]
  sourceUrls: string[]
  lastVerified: string
}

export interface LineupDataset {
  version: string
  generatedAt: string
  matches: LineupMatch[]
}
