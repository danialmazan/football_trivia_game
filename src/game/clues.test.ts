import { describe, expect, it } from 'vitest'
import { players } from '../data/players'
import type { Player } from '../data/types'
import {
  generateClues,
  getCareerDecades,
  getMainTeams,
  getTeamClue,
  getTeamClueCandidates,
  getTitleHighlights,
} from './clues'

const byName = (name: string) => players.find((player) => player.displayName === name)!

describe('football clue generation', () => {
  it('orders main clubs by eligible league appearances', () => {
    const messi = byName('Lionel Messi')
    const main = getMainTeams(messi)
    expect(main[0].clubName).toContain('Barcelona')
    expect(main[0].appearances).toBeGreaterThanOrEqual(main[1].appearances)
  })

  it('uses only clubs with at least 50 league appearances for clue one', () => {
    expect(getTeamClueCandidates(byName('Cristiano Ronaldo')).every((club) => club.appearances >= 50)).toBe(true)
  })

  it('selects a clue club deterministically from the round seed', () => {
    const player = byName('Cristiano Ronaldo')
    const candidates = getTeamClueCandidates(player)
    expect(getTeamClue(player, 0).clubId).toBe(candidates[0].clubId)
    expect(getTeamClue(player, 1).clubId).toBe(candidates[1].clubId)
  })

  it('constrains a league-practice club clue to the selected league', () => {
    const player = byName('Cristiano Ronaldo')
    const clue = getTeamClue(player, 0, { kind: 'league', value: 'GB1' })
    expect(clue.leagueId).toBe('GB1')
    expect(clue.appearances).toBeGreaterThanOrEqual(50)
  })

  it('emits the five decided clues in order', () => {
    const player = byName('Lionel Messi')
    const clues = generateClues(player, 0)
    expect(clues.map((clue) => clue.label)).toEqual([
      'Club & career era',
      'National team',
      'Major team titles',
      'Position',
      'Initials',
    ])
    expect(clues[1]).toMatchObject({ kind: 'text', text: expect.stringContaining('Argentina') })
    expect(clues[2]).toMatchObject({ kind: 'text', text: expect.stringContaining('UEFA Champions League') })
    expect(clues[3]).toMatchObject({ kind: 'text', text: expect.stringContaining(player.primaryRole) })
  })

  it('shows milestones when a player has no qualifying title', () => {
    const base = players[0]
    const titleless = {
      ...base,
      titles: [],
      championsLeagueAppearances: 7,
      nationalTeam: { ...base.nationalTeam, caps: 31 },
    } as Player
    expect(getTitleHighlights(titleless)).toEqual([
      '7 Champions League appearances',
      '31 senior caps',
    ])
  })

  it('falls back to Big-Five appearances when both milestone counts are zero', () => {
    const base = players[0]
    const titleless = {
      ...base,
      titles: [],
      championsLeagueAppearances: 0,
      nationalTeam: { ...base.nationalTeam, caps: 0 },
      bigFiveAppearances: 321,
    } as Player
    expect(getTitleHighlights(titleless)).toEqual(['321 appearances in the Big-Five leagues'])
  })

  it('derives all career decades from Big-Five seasons', () => {
    const player = byName('Cristiano Ronaldo')
    expect(getCareerDecades(player)).toEqual(['2000s', '2010s', '2020s'])
  })
})
