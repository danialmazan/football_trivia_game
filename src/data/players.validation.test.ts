import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { assignDecade } from '../game/selection'
import { playerSearch, players } from './players'
import { validatePlayers } from './validation'

describe('football player dataset', () => {
  it('passes every configured validation rule', () => {
    expect(validatePlayers(players)).toEqual([])
  })

  it('contains the exact ranked Normal and Hardcore pools', () => {
    expect(players.filter((player) => player.normalPool)).toHaveLength(250)
    expect(players.filter((player) => player.hardcoreEligible)).toHaveLength(800)
    expect(players.length).toBeGreaterThanOrEqual(800)
    expect(players.some((player) => !player.normalPool && player.hardcoreEligible)).toBe(true)
    expect(
      players.filter((player) => player.normalPool).every(
        (player) => player.postCutoffBigFiveAppearances >= 50,
      ),
    ).toBe(true)
  })

  it('covers every post-cutoff practice decade', () => {
    const represented = new Set(players.map(assignDecade))
    for (const decade of ['1990s', '2000s', '2010s', '2020s']) {
      expect(represented.has(decade)).toBe(true)
    }
  })

  it('is sorted by recognition score with deterministic appearance tie-breaking', () => {
    const ranked = players.filter((player) => player.hardcoreEligible)
    for (let index = 1; index < ranked.length; index += 1) {
      const previous = ranked[index - 1]
      const current = ranked[index]
      const correctlyOrdered =
        previous.recognitionScore > current.recognitionScore ||
          (previous.recognitionScore === current.recognitionScore &&
            (previous.postCutoffBigFiveAppearances > current.postCutoffBigFiveAppearances ||
              (previous.postCutoffBigFiveAppearances === current.postCutoffBigFiveAppearances &&
                Number(previous.sourcePlayerId) < Number(current.sourcePlayerId))))
      expect(correctlyOrdered).toBe(true)
    }
  })

  it('calculates every recognition score from UCL appearances and allowed team titles', () => {
    for (const player of players) {
      const expected =
        player.postCutoffChampionsLeagueAppearances + player.postCutoffTitleRankingPoints
      expect(player.recognitionScore).toBe(expected)
    }
  })

  it('contains exact 100/300 filter-specific practice pools', () => {
    for (const key of [
      ...['1990s', '2000s', '2010s', '2020s'].map((value) => `decade:${value}`),
      ...['GB1', 'ES1', 'IT1', 'L1', 'FR1'].map((value) => `league:${value}`),
    ]) {
      expect(players.filter((player) => (player.practiceRanks[key] ?? Infinity) <= 100)).toHaveLength(100)
      expect(players.filter((player) => (player.practiceRanks[key] ?? Infinity) <= 300)).toHaveLength(300)
    }
  })

  it('has unique display names with no conflicting mononyms in the search catalog', () => {
    const normalize = (value: string) =>
      value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    const names = playerSearch.map((player) => normalize(player.displayName))
    expect(new Set(names).size).toBe(names.length)
    for (const player of playerSearch) {
      const name = normalize(player.displayName)
      if (name.includes(' ')) continue
      expect(
        playerSearch.some(
          (other) => other.id !== player.id && normalize(other.displayName).split(' ').includes(name),
        ),
      ).toBe(false)
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
