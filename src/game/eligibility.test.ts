import { describe, expect, it } from 'vitest'
import { players } from '../data/players'
import type { Player } from '../data/types'
import { meetsEraCutoff, meetsHardcoreCriteria } from './eligibility'

describe('football pool eligibility', () => {
  it('requires an eligible appearance in 1995-96 or later', () => {
    const base = players[0]
    expect(meetsEraCutoff(base)).toBe(true)
    expect(
      meetsEraCutoff({
        ...base,
        seasonAppearances: [{ season: '94/95', startYear: 1994, appearances: 30 }],
      }),
    ).toBe(false)
  })

  it('counts full careers while enforcing 150 total Big-Five appearances', () => {
    const base = players[0]
    const clubs = [{ ...base.clubs[0], appearances: 150 }]
    const player = { ...base, clubs, bigFiveAppearances: 150 } as Player
    expect(meetsHardcoreCriteria(player)).toBe(true)
    expect(meetsHardcoreCriteria({ ...player, bigFiveAppearances: 149, clubs: [{ ...clubs[0], appearances: 149 }] })).toBe(false)
  })

  it('requires a 50-appearance clue club', () => {
    const base = players[0]
    const clubs = [
      { ...base.clubs[0], clubId: 'a', appearances: 49 },
      { ...base.clubs[0], clubId: 'b', appearances: 101 },
    ]
    expect(meetsHardcoreCriteria({ ...base, clubs, bigFiveAppearances: 150 })).toBe(true)
    expect(
      meetsHardcoreCriteria({
        ...base,
        clubs: clubs.map((club) => ({ ...club, appearances: 49 })),
        bigFiveAppearances: 98,
      }),
    ).toBe(false)
  })

  it('requires a senior international cap', () => {
    const base = players[0]
    expect(meetsHardcoreCriteria({ ...base, nationalTeam: { ...base.nationalTeam, caps: 0 } })).toBe(false)
  })

  it('keeps the 250-player Normal pool inside the 800-player Hardcore pool', () => {
    expect(players.filter((player) => player.normalPool)).toHaveLength(250)
    expect(players.filter((player) => player.hardcoreEligible)).toHaveLength(800)
    expect(players.filter((player) => player.normalPool).every((player) => player.hardcoreEligible)).toBe(true)
  })
})
