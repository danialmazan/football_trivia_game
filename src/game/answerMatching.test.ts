import { describe, expect, it } from 'vitest'
import { players } from '../data/players'
import { matchAnswer, normalizeAnswer } from './answerMatching'

const byName = (name: string) => players.find((player) => player.displayName === name)!

describe('football answer matching', () => {
  it('normalizes accents, punctuation, hyphens, case and repeated spaces', () => {
    expect(normalizeAnswer('  LUKA   Modrić. ')).toBe('luka modric')
    expect(normalizeAnswer('Pierre-Emerick')).toBe('pierre emerick')
  })

  it('accepts accent-insensitive names and unique surnames', () => {
    expect(matchAnswer('Modric', byName('Luka Modrić'), players).status).toBe('correct')
  })

  it('accepts mononyms and configured common short names', () => {
    expect(matchAnswer('Ronaldinho', byName('Ronaldinho'), players).status).toBe('correct')
    expect(matchAnswer('CR7', byName('Cristiano Ronaldo'), players).status).toBe('correct')
  })

  it('does not auto-accept an ambiguous Ronaldo answer', () => {
    const result = matchAnswer('Ronaldo', byName('Cristiano Ronaldo'), players)
    expect(result.status).toBe('ambiguous')
  })

  it('accepts a sufficiently clear minor typo', () => {
    expect(matchAnswer('Lionel Mesi', byName('Lionel Messi'), players).status).toBe('correct')
  })

  it('rejects lists of player names', () => {
    expect(matchAnswer('Messi or Ronaldo', byName('Lionel Messi'), players).status).toBe('invalid')
  })
})
