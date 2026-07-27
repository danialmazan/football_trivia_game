export const BIG_FIVE = new Map([
  ['GB1', 'Premier League'],
  ['ES1', 'La Liga'],
  ['IT1', 'Serie A'],
  ['L1', 'Bundesliga'],
  ['FR1', 'Ligue 1'],
])

export const TITLE_WEIGHTS = {
  'champions-league': 40,
  'europa-league': 25,
  'cup-winners-cup': 25,
  'domestic-league': 15,
  'world-cup': 50,
  'continental-national': 30,
}

export function isChampionsLeagueMainTournament(competitionId) {
  return competitionId === 'CL'
}

export function titleKind(label) {
  const value = label.toLowerCase()
  if (
    value.includes('uefa champions league winner') ||
    value.includes("european champion clubs' cup winner")
  ) return 'champions-league'
  if (value.includes('uefa cup winner') || value.includes('europa league winner')) {
    return 'europa-league'
  }
  if (value.includes("cup winners' cup winner") || value.includes('cup winners cup winner')) {
    return 'cup-winners-cup'
  }
  if (value === 'world cup winner') return 'world-cup'
  if (
    value === 'european champion' ||
    value === 'copa américa winner' ||
    value === 'copa america winner' ||
    value === 'africa cup winner' ||
    value === 'asian cup winner' ||
    value === 'gold cup winner' ||
    value === 'ofc nations cup winner'
  ) return 'continental-national'
  if (
    value === 'english champion' ||
    value === 'spanish champion' ||
    value === 'italian champion' ||
    value === 'german champion' ||
    value === 'french champion'
  ) return 'domestic-league'
  return null
}

export function choosePrimaryNationalTeam(current, candidate) {
  if (!current) return candidate
  if (candidate.caps > current.caps) return candidate
  if (candidate.caps < current.caps) return current
  return Number(candidate.teamId) < Number(current.teamId) ? candidate : current
}
