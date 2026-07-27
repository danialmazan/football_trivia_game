import { describe, expect, it } from 'vitest'
import { createRound, recordIncorrectGuess, revealNextClue } from './round'
import { calculateAvailableScore } from './scoring'

describe('round state', () => {
  it('does not count a normalized duplicate guess twice', () => {
    const initial = createRound('luka-modric', () => 0)
    const first = recordIncorrectGuess(initial, 'Luka-Modrić', 'luka modric')
    const duplicate = recordIncorrectGuess(first.round, '  luka   modric ', 'luka modric')

    expect(first.duplicate).toBe(false)
    expect(duplicate.duplicate).toBe(true)
    expect(duplicate.round.incorrectGuesses).toEqual(['Luka-Modrić'])
  })

  it('preserves deductions when a clue is revealed', () => {
    const initial = createRound('player', () => 0)
    const wrong = recordIncorrectGuess(initial, 'Someone else', 'someone else').round
    const revealed = revealNextClue(wrong)

    expect(revealed.incorrectGuesses).toHaveLength(1)
    expect(calculateAvailableScore(revealed.clueLevel, revealed.incorrectGuesses.length)).toBe(70)
  })
})
