import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import rawDataset from './lineupMatches.json'
import rawSearch from './lineupSearch.json'
import type { SearchPlayer } from './types'
import type { LineupDataset } from './lineupTypes'
import { GAME_CONFIG } from '../game/config'
import { getActiveLineupMatches, LINEUP_ACTIVE_MATCH_COUNT, LINEUP_MATCH_COUNT, LINEUP_MONONYMS, validateLineups } from './lineupValidation'

const dataset = rawDataset as LineupDataset
const search = rawSearch as SearchPlayer[]

describe('lineup data snapshot', () => {
  it('contains every real semifinal and final in the requested era', () => {
    expect(dataset.matches).toHaveLength(LINEUP_MATCH_COUNT)
    expect(dataset.matches.filter((match) => match.competition === 'ucl')).toHaveLength(153)
    expect(dataset.matches.filter((match) => match.competition === 'euro')).toHaveLength(24)
    expect(dataset.matches.filter((match) => match.competition === 'world-cup')).toHaveLength(24)
    const active = getActiveLineupMatches(dataset)
    expect(active).toHaveLength(LINEUP_ACTIVE_MATCH_COUNT)
    expect(active.filter((match) => match.competition === 'ucl')).toHaveLength(103)
    expect(active.filter((match) => match.competition === 'euro')).toHaveLength(15)
    expect(active.filter((match) => match.competition === 'world-cup')).toHaveLength(18)
    expect(Math.min(...active.map((match) => match.seasonStart))).toBe(GAME_CONFIG.lineupActiveFirstSeason)
    expect(Math.max(...active.map((match) => match.seasonStart))).toBe(GAME_CONFIG.lineupActiveLastSeason)
  })

  it('documents the single-leg 2019/20 UCL exception', () => {
    const lisbon = dataset.matches.filter(
      (match) => match.competition === 'ucl' && match.seasonStart === 2019,
    )
    expect(lisbon).toHaveLength(3)
    expect(lisbon.map((match) => match.stage)).toEqual(['Semi-final', 'Semi-final', 'Final'])
  })

  it('has complete valid lineups, benches, metadata and autocomplete coverage', () => {
    expect(validateLineups(dataset, search)).toEqual([])
  })

  it('retains the fullest sourced name for players seen under multiple labels', () => {
    expect(search.find((player) => player.id === 'tm-player-294')).toMatchObject({
      displayName: 'Hans Jörg Butt',
    })
    expect(search.find((player) => player.id === 'tm-player-692')).toMatchObject({
      displayName: 'Tim Borowski',
      acceptedNames: expect.arrayContaining(['Borowski']),
    })
    expect(LINEUP_MONONYMS).toEqual([{ sourcePlayerId: '3373', displayName: 'Ronaldinho', evidenceField: 'artistName' }])
    expect(search.find((player) => player.id === 'tm-player-3373')).toMatchObject({
      displayName: 'Ronaldinho',
      acceptedNames: expect.arrayContaining(['Ronaldo de Assis Moreira']),
    })
  })

  it('matches the active JSON archive exactly to the release migration pool', () => {
    const migration = readFileSync('supabase/migrations/202608090001_lineup_pool_2005.sql', 'utf8')
    const migrationIds = [...migration.matchAll(/\('([^']+)',\s*'[^']+',\s*\d+,\s*array\[/g)].map((match) => match[1])
    expect(new Set(migrationIds)).toEqual(new Set(getActiveLineupMatches(dataset).map((match) => match.id)))
    expect(migrationIds).toHaveLength(LINEUP_ACTIVE_MATCH_COUNT)
  })
})
