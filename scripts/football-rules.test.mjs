import { describe, expect, it } from 'vitest'
import {
  BIG_FIVE,
  TITLE_WEIGHTS,
  choosePrimaryNationalTeam,
  isChampionsLeagueMainTournament,
  titleKind,
} from './football-rules.mjs'

describe('football source rules', () => {
  it('counts only the five requested first-tier competition IDs', () => {
    expect([...BIG_FIVE.keys()]).toEqual(['GB1', 'ES1', 'IT1', 'L1', 'FR1'])
  })

  it('uses the exact recognition ranking weights', () => {
    expect(TITLE_WEIGHTS).toEqual({
      'champions-league': 40,
      'europa-league': 25,
      'cup-winners-cup': 25,
      'domestic-league': 15,
      'world-cup': 50,
      'continental-national': 30,
    })
  })

  it('counts the Champions League main tournament but not qualifiers', () => {
    expect(isChampionsLeagueMainTournament('CL')).toBe(true)
    expect(isChampionsLeagueMainTournament('CLQ')).toBe(false)
  })

  it('maps only requested team titles and excludes other honours', () => {
    expect(titleKind('UEFA Champions League winner')).toBe('champions-league')
    expect(titleKind('English Champion')).toBe('domestic-league')
    expect(titleKind('World Cup winner')).toBe('world-cup')
    for (const excluded of [
      'FA Cup Winner',
      'English Super Cup Winner',
      'UEFA Nations League Winner',
      'Olympic Medalist',
      'FIFA Club World Cup Winner',
      'Ballon d’Or Winner',
    ]) expect(titleKind(excluded)).toBeNull()
  })

  it('selects the dual international side with most caps and breaks ties deterministically', () => {
    const first = { teamId: '99', caps: 8 }
    const mostCaps = { teamId: '100', caps: 12 }
    const stableTie = { teamId: '42', caps: 12 }
    expect(choosePrimaryNationalTeam(first, mostCaps)).toBe(mostCaps)
    expect(choosePrimaryNationalTeam(mostCaps, stableTie)).toBe(stableTie)
  })
})
