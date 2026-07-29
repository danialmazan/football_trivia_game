export interface RankableDailyResult {
  points: number
  submitted_at: string
}

export function isValidDailyNickname(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  const length = Array.from(trimmed).length
  return length >= 1 && length <= 24 && !/[\u0000-\u001f\u007f]/u.test(trimmed)
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
