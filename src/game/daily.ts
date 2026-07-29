import type { LeaderboardEntry } from './types'

export function getUtcDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

export function getNextUtcMidnight(date = new Date()): string {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1),
  ).toISOString()
}

export function isValidNickname(nickname: string): boolean {
  const trimmed = nickname.trim()
  const length = Array.from(trimmed).length
  return length >= 1 && length <= 24 && !/[\u0000-\u001f\u007f]/u.test(trimmed)
}

export function rankLeaderboard<T extends { points: number; submittedAt: string }>(
  entries: T[],
): Array<T & Pick<LeaderboardEntry, 'rank'>> {
  const sorted = [...entries].sort(
    (a, b) => b.points - a.points || a.submittedAt.localeCompare(b.submittedAt),
  )
  let previousPoints: number | null = null
  let previousRank = 0
  return sorted.map((entry, index) => {
    const rank = entry.points === previousPoints ? previousRank : index + 1
    previousPoints = entry.points
    previousRank = rank
    return { ...entry, rank }
  })
}
