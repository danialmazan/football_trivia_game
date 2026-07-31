import { describe, expect, it } from 'vitest'
import { players } from '../data/players'
import type { Player } from '../data/types'
import { assignDecade, getActivePool, qualifiesForPractice, selectNextPlayer } from './selection'

describe('football player selection', () => {
  it('assigns practice decade from the busiest post-cutoff season', () => {
    const player = {
      ...players[0],
      seasonAppearances: [
        { season: '94/95', startYear: 1994, appearances: 38 },
        { season: '99/00', startYear: 1999, appearances: 30 },
        { season: '00/01', startYear: 2000, appearances: 34 },
      ],
    } as Player
    expect(assignDecade(player)).toBe('2000s')
  })

  it('uses the generated filter-local rank for practice eligibility', () => {
    const player = players.find((candidate) => (candidate.practiceRanks['league:GB1'] ?? Infinity) <= 300)!
    expect(qualifiesForPractice(player, { kind: 'league', value: 'GB1' })).toBe(true)
    expect(player.practiceMetrics['league:GB1'].appearances).toBeGreaterThanOrEqual(50)
  })

  it('returns exact filter-specific Normal and Hardcore practice rosters', () => {
    expect(getActivePool(players, 'normal', { kind: 'decade', value: '1990s' })).toHaveLength(100)
    expect(getActivePool(players, 'hardcore', { kind: 'league', value: 'FR1' })).toHaveLength(300)
  })

  it('prevents repeats while unused players remain', () => {
    const pool = players.slice(0, 3)
    const selected = selectNextPlayer(pool, [pool[0].id], () => 0)
    expect(selected.player.id).toBe(pool[1].id)
    expect(selected.exhausted).toBe(false)
  })

  it('resets selection only after exhausting the pool', () => {
    const pool = players.slice(0, 2)
    const selected = selectNextPlayer(pool, pool.map((player) => player.id), () => 0)
    expect(selected.player.id).toBe(pool[0].id)
    expect(selected.exhausted).toBe(true)
  })
})
