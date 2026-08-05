export interface RankableDailyResult {
  points: number
  submitted_at: string
}

export interface HistoricalResult extends RankableDailyResult {
  challenge_date: string
  nickname: string
  normalized_nickname?: string | null
}

export interface LeaderboardMetricEntry {
  rank: number
  nickname: string
  value: number
  gamesPlayed: number
}

export interface LeaderboardBoards {
  today: LeaderboardMetricEntry[]
  cumulative?: LeaderboardMetricEntry[]
  gamesPlayed?: LeaderboardMetricEntry[]
  average: LeaderboardMetricEntry[]
  best: LeaderboardMetricEntry[]
}

export function isValidDailyNickname(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  const length = Array.from(trimmed).length
  return length >= 1 && length <= 24 && !/[\u0000-\u001f\u007f]/u.test(trimmed)
}

export function normalizeLeaderboardNickname(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en')
}

export function findTodayNicknameResult<T extends HistoricalResult>(
  rows: T[],
  today: string,
  nickname: string,
): T | null {
  const normalized = normalizeLeaderboardNickname(nickname)
  return rows.find(
    (row) =>
      row.challenge_date === today &&
      normalizeLeaderboardNickname(row.nickname) === normalized,
  ) ?? null
}

export function calculateDailyScore(
  outcome: 'correct' | 'gave-up',
  cluesUsed: number,
  incorrectGuesses: number,
): number {
  if (outcome === 'gave-up') return 0
  const clueScores = [100, 80, 60, 40, 20]
  return Math.max(0, clueScores[cluesUsed - 1] - incorrectGuesses * 10)
}

export function calculateLineupScore(
  outcome: 'correct' | 'gave-up',
  distinctIncorrectGuesses: number,
): number {
  if (outcome === 'gave-up') return 0
  return Math.max(0, 100 - distinctIncorrectGuesses * 20)
}

export function rankDailyResults<T extends RankableDailyResult>(
  results: T[],
): Array<T & { rank: number }> {
  const sorted = [...results].sort(
    (a, b) => b.points - a.points || a.submitted_at.localeCompare(b.submitted_at),
  )
  let previousPoints: number | null = null
  let previousRank = 0
  return sorted.map((result, index) => {
    const rank = result.points === previousPoints ? previousRank : index + 1
    previousPoints = result.points
    previousRank = rank
    return { ...result, rank }
  })
}

function rankMetric(
  entries: Array<Omit<LeaderboardMetricEntry, 'rank'> & { achievedAt: string }>,
): LeaderboardMetricEntry[] {
  const sorted = [...entries].sort(
    (a, b) =>
      b.value - a.value ||
      b.gamesPlayed - a.gamesPlayed ||
      a.achievedAt.localeCompare(b.achievedAt) ||
      a.nickname.localeCompare(b.nickname),
  )
  let previousValue: number | null = null
  let previousRank = 0
  return sorted.map(({ achievedAt: _achievedAt, ...entry }, index) => {
    const rank = entry.value === previousValue ? previousRank : index + 1
    previousValue = entry.value
    previousRank = rank
    return { ...entry, rank }
  })
}

function bestPerNicknameAndDay<T extends HistoricalResult>(rows: T[]): T[] {
  const best = new Map<string, T>()
  for (const row of rows) {
    const normalized = row.normalized_nickname || normalizeLeaderboardNickname(row.nickname)
    const key = `${row.challenge_date}:${normalized}`
    const current = best.get(key)
    if (
      !current ||
      row.points > current.points ||
      (row.points === current.points && row.submitted_at < current.submitted_at)
    ) {
      best.set(key, row)
    }
  }
  return [...best.values()]
}

export function buildDailyLeaderboardBoards<T extends HistoricalResult>(
  rows: T[],
  today: string,
): LeaderboardBoards {
  const dailyBest = bestPerNicknameAndDay(rows)
  const grouped = new Map<
    string,
    { nickname: string; scores: number[]; firstAt: string; bestAt: string }
  >()
  for (const row of dailyBest) {
    const key = row.normalized_nickname || normalizeLeaderboardNickname(row.nickname)
    const current = grouped.get(key) ?? {
      nickname: row.nickname,
      scores: [],
      firstAt: row.submitted_at,
      bestAt: row.submitted_at,
    }
    current.nickname = row.nickname
    current.scores.push(row.points)
    if (row.submitted_at < current.firstAt) current.firstAt = row.submitted_at
    if (row.points > Math.max(...current.scores.slice(0, -1), -1)) current.bestAt = row.submitted_at
    grouped.set(key, current)
  }

  const todayRows = dailyBest.filter((row) => row.challenge_date === today)
  return {
    today: rankMetric(
      todayRows.map((row) => ({
        nickname: row.nickname,
        value: row.points,
        gamesPlayed: 1,
        achievedAt: row.submitted_at,
      })),
    ),
    cumulative: rankMetric(
      [...grouped.values()].map((entry) => ({
        nickname: entry.nickname,
        value: entry.scores.reduce((sum, score) => sum + score, 0),
        gamesPlayed: entry.scores.length,
        achievedAt: entry.firstAt,
      })),
    ),
    average: rankMetric(
      [...grouped.values()]
        .filter((entry) => entry.scores.length >= 3)
        .map((entry) => ({
          nickname: entry.nickname,
          value: Math.round(
            (entry.scores.reduce((sum, score) => sum + score, 0) / entry.scores.length) * 10,
          ) / 10,
          gamesPlayed: entry.scores.length,
          achievedAt: entry.firstAt,
        })),
    ),
    best: rankMetric(
      [...grouped.values()].map((entry) => ({
        nickname: entry.nickname,
        value: Math.max(...entry.scores),
        gamesPlayed: entry.scores.length,
        achievedAt: entry.bestAt,
      })),
    ),
  }
}

export function buildChallengeLeaderboardBoards<T extends HistoricalResult>(
  rows: T[],
  today: string,
): LeaderboardBoards {
  const grouped = new Map<
    string,
    { nickname: string; scores: number[]; firstAt: string; bestAt: string }
  >()
  for (const row of rows) {
    const key = row.normalized_nickname || normalizeLeaderboardNickname(row.nickname)
    const current = grouped.get(key) ?? {
      nickname: row.nickname,
      scores: [],
      firstAt: row.submitted_at,
      bestAt: row.submitted_at,
    }
    const previousBest = Math.max(...current.scores, -1)
    current.nickname = row.nickname
    current.scores.push(row.points)
    if (row.submitted_at < current.firstAt) current.firstAt = row.submitted_at
    if (row.points > previousBest) current.bestAt = row.submitted_at
    grouped.set(key, current)
  }

  const todayBest = bestPerNicknameAndDay(rows).filter((row) => row.challenge_date === today)
  return {
    today: rankMetric(
      todayBest.map((row) => ({
        nickname: row.nickname,
        value: row.points,
        gamesPlayed: grouped.get(
          row.normalized_nickname || normalizeLeaderboardNickname(row.nickname),
        )?.scores.length ?? 1,
        achievedAt: row.submitted_at,
      })),
    ),
    gamesPlayed: rankMetric(
      [...grouped.values()].map((entry) => ({
        nickname: entry.nickname,
        value: entry.scores.length,
        gamesPlayed: entry.scores.length,
        achievedAt: entry.firstAt,
      })),
    ),
    average: rankMetric(
      [...grouped.values()]
        .filter((entry) => entry.scores.length >= 3)
        .map((entry) => ({
          nickname: entry.nickname,
          value: Math.round(
            (entry.scores.reduce((sum, score) => sum + score, 0) / entry.scores.length) * 10,
          ) / 10,
          gamesPlayed: entry.scores.length,
          achievedAt: entry.firstAt,
        })),
    ),
    best: rankMetric(
      [...grouped.values()].map((entry) => ({
        nickname: entry.nickname,
        value: Math.max(...entry.scores),
        gamesPlayed: entry.scores.length,
        achievedAt: entry.bestAt,
      })),
    ),
  }
}
