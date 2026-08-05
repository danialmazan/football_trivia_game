import { describe, expect, it } from 'vitest'
import rawDataset from './lineupMatches.json'
import rawSearch from './lineupSearch.json'
import type { SearchPlayer } from './types'
import type { LineupDataset } from './lineupTypes'
import { LINEUP_MATCH_COUNT, validateLineups } from './lineupValidation'

const dataset = rawDataset as LineupDataset
const search = rawSearch as SearchPlayer[]

describe('lineup data snapshot', () => {
  it('contains every real semifinal and final in the requested era', () => {
    expect(dataset.matches).toHaveLength(LINEUP_MATCH_COUNT)
    expect(dataset.matches.filter((match) => match.competition === 'ucl')).toHaveLength(153)
    expect(dataset.matches.filter((match) => match.competition === 'euro')).toHaveLength(24)
    expect(dataset.matches.filter((match) => match.competition === 'world-cup')).toHaveLength(24)
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
  })
})
