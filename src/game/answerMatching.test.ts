import { describe, expect, it } from 'vitest'
import { playerSearch, players } from '../data/players'
import { getPlayerSuggestions, matchAnswer, normalizeAnswer } from './answerMatching'

const byName = (name: string) => players.find((player) => player.displayName === name)!

describe('football answer matching', () => {
  it('normalizes accents, punctuation, hyphens, case and repeated spaces', () => {
    expect(normalizeAnswer('  LUKA   Modrić. ')).toBe('luka modric')
    expect(normalizeAnswer('Pierre-Emerick')).toBe('pierre emerick')
  })

  it('accepts accent-insensitive names and unique surnames', () => {
    expect(matchAnswer('Modric', byName('Luka Modrić'), playerSearch).status).toBe('correct')
  })

  it('accepts an exact compound surname even when the dataset stores only its final token', () => {
    expect(matchAnswer('del Piero', byName('Alessandro Del Piero'), playerSearch).status).toBe('correct')
    expect(matchAnswer('Di María', byName('Ángel Di María'), playerSearch).status).toBe('correct')
  })

  it('accepts mononyms and configured common short names', () => {
    expect(matchAnswer('Ronaldinho', byName('Ronaldinho'), playerSearch).status).toBe('correct')
    expect(matchAnswer('CR7', byName('Cristiano Ronaldo'), playerSearch).status).toBe('correct')
  })

  it('uses Ronaldo Nazario as the disambiguated Brazilian player name', () => {
    expect(matchAnswer('Ronaldo Nazario', byName('Ronaldo Nazario'), playerSearch).status).toBe('correct')
    expect(matchAnswer('Ronaldo', byName('Ronaldo Nazario'), playerSearch).status).toBe('incorrect')
    expect(matchAnswer('Ronaldo', byName('Cristiano Ronaldo'), playerSearch).status).toBe('correct')
  })

  it('accepts a sufficiently clear minor typo', () => {
    expect(matchAnswer('Lionel Mesi', byName('Lionel Messi'), playerSearch).status).toBe('correct')
  })

  it('rejects lists of player names', () => {
    expect(matchAnswer('Messi or Ronaldo', byName('Lionel Messi'), playerSearch).status).toBe('invalid')
  })

  it('suggests scoped player names only after three exact contiguous characters', () => {
    const scopedPool = [
      byName('David Beckham'),
      byName('Kevin De Bruyne'),
      byName('Lionel Messi'),
    ]

    expect(getPlayerSuggestions('Be', scopedPool)).toEqual([])
    expect(getPlayerSuggestions('Bec', scopedPool).map((player) => player.displayName)).toEqual([
      'David Beckham',
    ])
    expect(getPlayerSuggestions('vid Bec', scopedPool).map((player) => player.displayName)).toEqual([
      'David Beckham',
    ])
    expect(getPlayerSuggestions('Beckam', scopedPool)).toEqual([])
    expect(getPlayerSuggestions('Bec', [byName('Lionel Messi')])).toEqual([])
  })
})
