import {
  calculateDailyScore,
  isValidDailyNickname,
  rankDailyResults,
} from '../_shared/rules.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

Deno.test('daily scores use the shared clue and miss rules', () => {
  assert(calculateDailyScore('correct', 1, 0) === 100, 'first-clue score should be 100')
  assert(calculateDailyScore('correct', 2, 1) === 70, 'second clue with one miss should be 70')
  assert(calculateDailyScore('correct', 5, 4) === 0, 'scores should not fall below zero')
  assert(calculateDailyScore('gave-up', 1, 0) === 0, 'giving up should score zero')
})

Deno.test('daily nickname validation supports Unicode and enforces length', () => {
  assert(isValidDailyNickname(' Leo '), 'trimmed nicknames should be accepted')
  assert(isValidDailyNickname('⚽'), 'Unicode nicknames should be accepted')
  assert(!isValidDailyNickname(''), 'empty nicknames should be rejected')
  assert(!isValidDailyNickname('x'.repeat(25)), 'nicknames over 24 characters should be rejected')
})

Deno.test('daily leaderboard uses competition ranking for ties', () => {
  const ranked = rankDailyResults([
    { name: 'late', points: 100, submitted_at: '2026-07-29T12:00:00Z' },
    { name: 'second', points: 80, submitted_at: '2026-07-29T09:00:00Z' },
    { name: 'early', points: 100, submitted_at: '2026-07-29T08:00:00Z' },
  ])
  assert(
    JSON.stringify(ranked.map(({ name, rank }) => [name, rank])) ===
      JSON.stringify([
        ['early', 1],
        ['late', 1],
        ['second', 3],
      ]),
    'ties should share rank and use submission time for display order',
  )
})
