import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { assignDecade } from '../game/selection'
import { players } from './players'
import { validatePlayers } from './validation'

describe('football player dataset', () => {
  it('passes every configured validation rule', () => {
    expect(validatePlayers(players)).toEqual([])
  })

  it('contains the exact ranked Normal and Hardcore pools', () => {
    expect(players.filter((player) => player.normalPool)).toHaveLength(250)
    expect(players.length).toBe(800)
    expect(players.some((player) => !player.normalPool && player.hardcoreEligible)).toBe(true)
  })

  it('covers every post-cutoff practice decade', () => {
    const represented = new Set(players.map(assignDecade))
    for (const decade of ['1990s', '2000s', '2010s', '2020s']) {
      expect(represented.has(decade)).toBe(true)
    }
  })

  it('is sorted by recognition score with deterministic appearance tie-breaking', () => {
    for (let index = 1; index < players.length; index += 1) {
      const previous = players[index - 1]
      const current = players[index]
      const correctlyOrdered =
        previous.recognitionScore > current.recognitionScore ||
          (previous.recognitionScore === current.recognitionScore &&
            (previous.bigFiveAppearances > current.bigFiveAppearances ||
              (previous.bigFiveAppearances === current.bigFiveAppearances &&
                Number(previous.sourcePlayerId) < Number(current.sourcePlayerId))))
      expect(correctlyOrdered).toBe(true)
    }
  })

  it('calculates every recognition score from UCL appearances and allowed team titles', () => {
    for (const player of players) {
      const expected =
        player.championsLeagueAppearances +
        player.titles.reduce((total, title) => total + title.rankingPoints, 0)
      expect(player.recognitionScore).toBe(expected)
    }
  })

  it('bundles a badge for every referenced club', () => {
    const badgePaths = new Set(
      players.flatMap((player) => player.clubs.map((club) => club.logoPath)),
    )
    for (const badgePath of badgePaths) {
      expect(existsSync(join(process.cwd(), 'public', badgePath.replace(/^\//, '')))).toBe(true)
    }
  })
})
