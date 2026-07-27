import type { Player } from '../data/types'

export type MatchResult =
  | { status: 'correct'; player: Player }
  | { status: 'incorrect' }
  | { status: 'ambiguous'; candidates: Player[] }
  | { status: 'invalid'; message: string }

export function normalizeAnswer(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.’'`-]/g, ' ')
    .replace(/\./g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function containsMultipleAnswers(value: string): boolean {
  return /[,;/]|\s(?:or|and|&|\+)\s/i.test(value.trim())
}

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = previous[0]
    previous[0] = i
    for (let j = 1; j <= right.length; j += 1) {
      const above = previous[j]
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (left[i - 1] === right[j - 1] ? 0 : 1),
      )
      diagonal = above
    }
  }
  return previous[right.length]
}

function answerForms(player: Player): string[] {
  const normalized = [player.displayName, ...player.acceptedNames].map(normalizeAnswer).filter(Boolean)
  return [...new Set(normalized.flatMap((form) => [form, form.replace(/\s/g, '')]))]
}

export function matchAnswer(input: string, selectedPlayer: Player, activePool: Player[]): MatchResult {
  if (!input.trim()) return { status: 'invalid', message: 'Enter a player name first.' }
  if (containsMultipleAnswers(input)) {
    return { status: 'invalid', message: 'Enter one player per guess.' }
  }

  const query = normalizeAnswer(input)
  if (!query) return { status: 'invalid', message: 'Enter a player name first.' }

  const exactCandidates = activePool.filter((player) => {
    const forms = answerForms(player)
    return forms.includes(query) || normalizeAnswer(player.lastName) === query
  })
  if (exactCandidates.length > 1) return { status: 'ambiguous', candidates: exactCandidates }
  if (exactCandidates.length === 1) {
    return exactCandidates[0].id === selectedPlayer.id
      ? { status: 'correct', player: selectedPlayer }
      : { status: 'incorrect' }
  }

  if (query.length < 5) return { status: 'incorrect' }
  const allowedDistance = query.length >= 9 ? 2 : 1
  const fuzzyCandidates = activePool.filter((player) =>
    answerForms(player).some((form) => Math.abs(form.length - query.length) <= allowedDistance && editDistance(form, query) <= allowedDistance),
  )
  if (fuzzyCandidates.length > 1) return { status: 'ambiguous', candidates: fuzzyCandidates }
  if (fuzzyCandidates.length === 1 && fuzzyCandidates[0].id === selectedPlayer.id) {
    return { status: 'correct', player: selectedPlayer }
  }
  return { status: 'incorrect' }
}
