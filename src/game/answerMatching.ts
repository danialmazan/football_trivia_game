import type { Player, SearchPlayer } from '../data/types'

export type MatchResult =
  | { status: 'correct'; player: SearchPlayer }
  | { status: 'incorrect' }
  | { status: 'ambiguous'; candidates: SearchPlayer[] }
  | { status: 'invalid'; message: string }

export const MIN_AUTOCOMPLETE_CHARACTERS = 3
export const MAX_AUTOCOMPLETE_RESULTS = 6

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

function answerForms(player: SearchPlayer): string[] {
  const normalized = [player.displayName, ...player.acceptedNames].map(normalizeAnswer).filter(Boolean)
  return [...new Set(normalized.flatMap((form) => [form, form.replace(/\s/g, '')]))]
}

function isExactAnswer(player: SearchPlayer, query: string): boolean {
  if (answerForms(player).includes(query) || normalizeAnswer(player.lastName) === query) return true

  // Compound surnames such as "Del Piero", "De Bruyne" and "Di María" are
  // sometimes stored with only their final token in `lastName`. Accept an
  // exact, word-boundary suffix without making arbitrary partial names valid.
  if (!query.includes(' ')) return false
  return [player.displayName, ...player.acceptedNames]
    .map(normalizeAnswer)
    .some((form) => form.endsWith(` ${query}`))
}

export function getPlayerSuggestions(
  input: string,
  searchCatalog: SearchPlayer[],
  limit = MAX_AUTOCOMPLETE_RESULTS,
): SearchPlayer[] {
  const query = normalizeAnswer(input)
  if (query.replace(/\s/g, '').length < MIN_AUTOCOMPLETE_CHARACTERS) return []

  return searchCatalog
    .map((player) => {
      const name = normalizeAnswer(player.displayName)
      const matchIndex = name.indexOf(query)
      if (matchIndex < 0) return null
      const startsWord = matchIndex === 0 || name[matchIndex - 1] === ' '
      return { player, matchIndex, startsWord }
    })
    .filter((match): match is { player: Player; matchIndex: number; startsWord: boolean } => match !== null)
    .sort(
      (left, right) =>
        Number(right.startsWord) - Number(left.startsWord) ||
        left.matchIndex - right.matchIndex ||
        left.player.displayName.localeCompare(right.player.displayName),
    )
    .slice(0, Math.max(0, limit))
    .map(({ player }) => player)
}

export function matchAnswer(
  input: string,
  selectedPlayer: SearchPlayer,
  searchCatalog: SearchPlayer[],
): MatchResult {
  if (!input.trim()) return { status: 'invalid', message: 'Enter a player name first.' }
  if (containsMultipleAnswers(input)) {
    return { status: 'invalid', message: 'Enter one player per guess.' }
  }

  const query = normalizeAnswer(input)
  if (!query) return { status: 'invalid', message: 'Enter a player name first.' }

  const exactCandidates = searchCatalog.filter((player) => isExactAnswer(player, query))
  if (exactCandidates.length > 1) return { status: 'ambiguous', candidates: exactCandidates }
  if (exactCandidates.length === 1) {
    return exactCandidates[0].id === selectedPlayer.id
      ? { status: 'correct', player: exactCandidates[0] }
      : { status: 'incorrect' }
  }

  if (query.length < 5) return { status: 'incorrect' }
  const allowedDistance = query.length >= 9 ? 2 : 1
  const fuzzyCandidates = searchCatalog.filter((player) =>
    answerForms(player).some((form) => Math.abs(form.length - query.length) <= allowedDistance && editDistance(form, query) <= allowedDistance),
  )
  if (fuzzyCandidates.length > 1) return { status: 'ambiguous', candidates: fuzzyCandidates }
  if (fuzzyCandidates.length === 1 && fuzzyCandidates[0].id === selectedPlayer.id) {
    return { status: 'correct', player: fuzzyCandidates[0] }
  }
  return { status: 'incorrect' }
}
