import { describe, expect, it } from 'vitest'
import type { LineupMatch } from '../data/lineupTypes'
import {
  calculateLineupScore,
  createLineupRound,
  recordLineupIncorrectGuess,
  positionLineupStarter,
  selectLineupMatch,
} from './lineups'

const starter = (id: string) => ({
  id,
  sourcePlayerId: id,
  displayName: id,
  acceptedNames: [],
  lastName: id,
  shirtNumber: '1',
  x: 50,
  y: 50,
  nationality: 'Testland',
  seasonClub: 'Test FC',
})
const match = (id: string): LineupMatch => ({
  id,
  sourceMatchId: id,
  competition: 'ucl',
  competitionLabel: 'UEFA Champions League',
  edition: '2025/26',
  seasonStart: 2025,
  stage: 'Final',
  date: '2026-05-30',
  kickoffLocal: '9:00 PM',
  timezone: 'Venue local time',
  venue: 'Stadium',
  homeTeam: { id: 'a', name: 'A' },
  awayTeam: { id: 'b', name: 'B' },
  teams: [
    { id: 'a', name: 'A', formation: '4-4-2', starters: Array.from({ length: 11 }, (_, index) => starter(`${id}-a-${index}`)), bench: [] },
    { id: 'b', name: 'B', formation: '4-3-3', starters: Array.from({ length: 11 }, (_, index) => starter(`${id}-b-${index}`)), bench: [] },
  ],
  sourceUrls: ['https://example.com/1', 'https://example.com/2'],
  lastVerified: '2026-08-05',
})

describe('lineup game rules', () => {
  it('deducts 20 per distinct miss and floors at zero', () => {
    expect([0, 1, 2, 3, 4, 5, 8].map((misses) => calculateLineupScore(misses))).toEqual([100, 80, 60, 40, 20, 0, 0])
  })

  it('caps at 40 and 20 when clues are revealed, then deducts later misses', () => {
    expect(calculateLineupScore(0, 1, [0])).toBe(40)
    expect(calculateLineupScore(1, 1, [0])).toBe(20)
    expect(calculateLineupScore(1, 1, [1])).toBe(40)
    expect(calculateLineupScore(2, 2, [1, 2])).toBe(20)
    expect(calculateLineupScore(3, 2, [1, 2])).toBe(0)
  })

  it('does not deduct a duplicate miss', () => {
    const round = createLineupRound(match('one'), () => 0)
    const first = recordLineupIncorrectGuess(round, 'Wrong', 'wrong')
    const duplicate = recordLineupIncorrectGuess(first.round, 'Wrong', 'wrong')
    expect(first.duplicate).toBe(false)
    expect(duplicate.duplicate).toBe(true)
    expect(duplicate.round.incorrectGuesses).toEqual(['Wrong'])
  })

  it('selects uniformly from all 22 starters, including goalkeepers', () => {
    const selected = createLineupRound(match('one'), () => 0)
    const last = createLineupRound(match('one'), () => 0.999999)
    expect(selected.missingPlayerId).toBe('one-a-0')
    expect(last.missingPlayerId).toBe('one-b-10')
  })

  it('does not repeat matches within a challenge', () => {
    const matches = [match('one'), match('two'), match('three')]
    expect(selectLineupMatch(matches, ['one'], () => 0).id).toBe('two')
    expect(selectLineupMatch(matches, ['one', 'two'], () => 0).id).toBe('three')
  })

  it('mirrors the top team so its tactical left remains its left', () => {
    expect(positionLineupStarter(25, 39, 1)).toEqual({ left: 75, top: 30.5 })
    expect(positionLineupStarter(75, 39, 1)).toEqual({ left: 25, top: 30.5 })
    expect(positionLineupStarter(25, 39, 0)).toEqual({ left: 25, top: 69.5 })
  })
})
