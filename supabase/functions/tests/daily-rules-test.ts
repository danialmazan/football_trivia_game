import {
  buildChallengeLeaderboardBoards,
  buildDailyLeaderboardBoards,
  calculateDailyScore,
  calculateLineupScore,
  findTodayNicknameResult,
  isValidDailyNickname,
  normalizeLeaderboardNickname,
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

Deno.test('lineup scores subtract distinct misses and floor at zero', () => {
  assert(calculateLineupScore('correct', 0) === 100, 'first try should score 100')
  assert(calculateLineupScore('correct', 3) === 40, 'three misses should score 40')
  assert(calculateLineupScore('correct', 8) === 0, 'scores should floor at zero')
  assert(calculateLineupScore('gave-up', 0) === 0, 'giving up should score zero')
})

Deno.test('nickname history is normalized without browser ownership', () => {
  assert(normalizeLeaderboardNickname('  Dani   FC ') === 'dani fc', 'nickname should be normalized')
})

Deno.test('daily history uses one best score per nickname and day', () => {
  const boards = buildDailyLeaderboardBoards([
    { challenge_date: '2026-07-30', nickname: 'Dani', normalized_nickname: 'dani', points: 80, submitted_at: '2026-07-30T09:00:00Z' },
    { challenge_date: '2026-07-30', nickname: 'dani', normalized_nickname: 'dani', points: 100, submitted_at: '2026-07-30T10:00:00Z' },
    { challenge_date: '2026-07-31', nickname: 'Dani', normalized_nickname: 'dani', points: 60, submitted_at: '2026-07-31T09:00:00Z' },
  ], '2026-07-31')
  assert(boards.today[0].value === 60, 'today should use the current-day result')
  assert(boards.cumulative?.[0].value === 160, 'history should use the best result per day')
})

Deno.test('challenge boards count every game but use the daily best for Today', () => {
  const rows = [
    { challenge_date: '2026-07-31', nickname: 'Dani', normalized_nickname: 'dani', points: 600, submitted_at: '2026-07-31T09:00:00Z' },
    { challenge_date: '2026-07-31', nickname: 'Dani', normalized_nickname: 'dani', points: 750, submitted_at: '2026-07-31T10:00:00Z' },
    { challenge_date: '2026-07-30', nickname: 'Dani', normalized_nickname: 'dani', points: 450, submitted_at: '2026-07-30T10:00:00Z' },
  ]
  const boards = buildChallengeLeaderboardBoards(rows, '2026-07-31')
  assert(boards.today[0].value === 750, 'Today should show the best same-day attempt')
  assert(boards.gamesPlayed?.[0].value === 3, 'all completed games should count')
  assert(boards.average[0].value === 600, 'average should unlock after three games')
})

Deno.test('daily nickname validation supports Unicode and enforces length', () => {
  assert(isValidDailyNickname(' Leo '), 'trimmed nicknames should be accepted')
  assert(isValidDailyNickname('⚽'), 'Unicode nicknames should be accepted')
  assert(!isValidDailyNickname(''), 'empty nicknames should be rejected')
  assert(!isValidDailyNickname('x'.repeat(25)), 'nicknames over 24 characters should be rejected')
})

Deno.test('homepage access requires the normalized nickname to have played today', () => {
  const rows = [
    { challenge_date: '2026-07-30', nickname: 'Yesterday', points: 80, submitted_at: '2026-07-30T09:00:00Z' },
    { challenge_date: '2026-07-31', nickname: 'Dani FC', points: 100, submitted_at: '2026-07-31T09:00:00Z' },
  ]
  assert(
    findTodayNicknameResult(rows, '2026-07-31', '  DANI   FC ')?.nickname === 'Dani FC',
    'matching should be normalized and case-insensitive',
  )
  assert(
    findTodayNicknameResult(rows, '2026-07-31', 'Yesterday') === null,
    'yesterday should not unlock today',
  )
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
