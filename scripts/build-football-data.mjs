import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline'
import { gunzipSync } from 'node:zlib'
import {
  BIG_FIVE,
  TITLE_WEIGHTS,
  choosePrimaryNationalTeam,
  isChampionsLeagueMainTournament,
  titleKind,
} from './football-rules.mjs'

const DATASET_URL = 'https://www.kaggle.com/datasets/xfkzujqjvx97n/football-datasets'
const VERIFIED_DATE = '2026-07-31'
const ERA_CUTOFF = 1995
const MAIN_NORMAL_SIZE = 250
const MAIN_HARDCORE_SIZE = 800
const PRACTICE_NORMAL_SIZE = 100
const PRACTICE_HARDCORE_SIZE = 300
const manifestOnly = process.argv.includes('--manifest-only')
const root = new URL('..', import.meta.url).pathname
const cacheRoot = process.env.FOOTBALL_DATA_CACHE ?? join(root, '.cache', 'football')
const paths = {
  performances:
    process.env.FOOTBALL_PERFORMANCES_CSV ?? join(cacheRoot, 'raw', 'player_performances.csv'),
  profiles: process.env.FOOTBALL_PROFILES_CSV ?? join(cacheRoot, 'raw', 'player_profiles.csv'),
  national:
    process.env.FOOTBALL_NATIONAL_PERFORMANCES_CSV ??
    join(cacheRoot, 'raw', 'player_national_performances.csv'),
  nationalTeamsGzip:
    process.env.FOOTBALL_NATIONAL_TEAMS_CSV_GZ ?? join(cacheRoot, 'raw', 'national_teams.csv.gz'),
  achievements: process.env.FOOTBALL_ACHIEVEMENTS_CACHE ?? join(cacheRoot, 'achievements'),
  manifest: process.env.FOOTBALL_CANDIDATE_MANIFEST ?? join(cacheRoot, 'candidates.json'),
  output: process.env.FOOTBALL_OUTPUT_JSON ?? join(root, 'src', 'data', 'players.json'),
  searchOutput:
    process.env.FOOTBALL_SEARCH_OUTPUT_JSON ?? join(root, 'src', 'data', 'playerSearch.json'),
}

for (const [label, path] of Object.entries(paths).filter(([key]) =>
  ['performances', 'profiles', 'national', 'nationalTeamsGzip'].includes(key),
)) {
  if (!existsSync(path)) throw new Error(`Missing ${label} source: ${path}`)
}

function parseCsvLine(line) {
  const values = []
  let value = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (character === ',' && !quoted) {
      values.push(value)
      value = ''
    } else {
      value += character
    }
  }
  values.push(value)
  return values
}

async function readCsv(path, callback) {
  const input = createReadStream(path, { encoding: 'utf8' })
  const lines = createInterface({ input, crlfDelay: Infinity })
  let headers
  for await (const line of lines) {
    if (!headers) {
      headers = parseCsvLine(line)
      continue
    }
    if (!line.trim()) continue
    const values = parseCsvLine(line)
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
    callback(row)
  }
}

function readCsvText(text) {
  const lines = text.trim().split(/\r?\n/)
  const headers = parseCsvLine(lines.shift())
  return lines.map((line) => {
    const values = parseCsvLine(line)
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
  })
}

function seasonStartYear(season) {
  const raw = Number(String(season).split('/')[0])
  if (!Number.isFinite(raw)) return Number.NaN
  if (raw >= 1900) return raw
  return raw >= 80 ? 1900 + raw : 2000 + raw
}

function cleanPlayerName(name) {
  return name
    .replace(/\p{Cf}/gu, '')
    .replace(/\s*\(\d+\)\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const playerNameOverrides = {
  '3540': "John O'Shea",
  '55769': "Danilo D'Ambrosio",
  '65278': 'Pedro Rodríguez',
  '44501': 'Marcelo Vieira',
  '7349': 'Raúl González',
  '14132': 'Pepe Ferreira',
  '34495': 'Adriano Correia',
  '3140': 'Ronaldo Nazario',
  '33947': 'Rafinha Souza',
  '145707': 'Danilo Luiz',
  '15420': 'Alex Costa',
  '102586': 'Leonardo Araújo',
  '129473': 'Rafinha Alcântara',
  '4248': 'Diego Ribas',
  '5876': 'Adriano Leite',
  '1599': 'Juan Silveira',
  '61892': 'Rafael da Silva',
  '7500': 'Sergio González',
}

const DECADE_RANGES = new Map([
  ['1990s', [1995, 1999]],
  ['2000s', [2000, 2009]],
  ['2010s', [2010, 2019]],
  ['2020s', [2020, 2029]],
])

function decadeForYear(startYear) {
  if (startYear < ERA_CUTOFF) return null
  return `${Math.floor(startYear / 10) * 10}s`
}

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function broadPosition(position) {
  const value = position.toLowerCase()
  if (value.includes('goalkeeper')) return 'Goalkeeper'
  if (value.includes('defender') || value.includes('back')) return 'Defender'
  if (value.includes('midfield')) return 'Midfielder'
  return 'Forward'
}

function flagCode(teamCode, teamName) {
  const exceptions = {
    England: 'gb-eng',
    Scotland: 'gb-sct',
    Wales: 'gb-wls',
    'Northern Ireland': 'gb-nir',
  }
  if (exceptions[teamName]) return exceptions[teamName]
  return String(teamCode || '').slice(0, 2).toLowerCase()
}

function createInitials(name) {
  return name
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => `${part[0].toLocaleUpperCase()}.`)
    .join('')
}

function normalizeName(value) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function disambiguateDisplayNames(candidates) {
  const tokenOwners = new Map()
  for (const candidate of candidates) {
    for (const token of new Set(normalizeName(candidate.displayName).split(' '))) {
      const owners = tokenOwners.get(token) ?? new Set()
      owners.add(candidate.sourcePlayerId)
      tokenOwners.set(token, owners)
    }
  }

  for (const candidate of candidates) {
    const normalized = normalizeName(candidate.displayName)
    if (normalized.includes(' ') || (tokenOwners.get(normalized)?.size ?? 0) <= 1) continue
    const homeTokens = cleanPlayerName(candidate.profile.name_in_home_country || '')
      .split(/\s+/)
      .filter(Boolean)
    const differentiator = [...homeTokens]
      .reverse()
      .find((token) => normalizeName(token) !== normalized && token.length > 1)
    if (differentiator) candidate.displayName = `${candidate.displayName} ${differentiator}`
  }

  const duplicateGroups = new Map()
  for (const candidate of candidates) {
    const key = normalizeName(candidate.displayName)
    const group = duplicateGroups.get(key) ?? []
    group.push(candidate)
    duplicateGroups.set(key, group)
  }
  for (const group of duplicateGroups.values()) {
    if (group.length < 2) continue
    for (const candidate of group) {
      const homeName = cleanPlayerName(candidate.profile.name_in_home_country || '')
      if (homeName && normalizeName(homeName) !== normalizeName(candidate.displayName)) {
        candidate.displayName = homeName
      } else {
        candidate.displayName = `${candidate.displayName} ${candidate.nationalTeam.teamName}`
      }
    }
  }
}

function parseTitleSections(html) {
  const sections = []
  const sectionPattern =
    /<h2 class="content-box-headline">\s*(\d+)x\s+([^<]+?)\s*<\/h2>[\s\S]*?<table class="auflistung">([\s\S]*?)<\/table>/g
  for (const match of html.matchAll(sectionPattern)) {
    const rows = [...match[3].matchAll(/\/verein\/(\d+)\/saison_id\/(\d+)/g)].map((row) => ({
      teamId: row[1],
      seasonStart: Number(row[2]),
    }))
    sections.push({ count: Number(match[1]), label: match[2].trim(), rows })
  }
  return sections
}

function titleDisplayLabel(kind, sourceLabel, leagueName) {
  if (kind === 'champions-league') return 'UEFA Champions League'
  if (kind === 'europa-league') return 'UEFA Cup / Europa League'
  if (kind === 'cup-winners-cup') return 'UEFA Cup Winners’ Cup'
  if (kind === 'world-cup') return 'FIFA World Cup'
  if (kind === 'domestic-league') return leagueName
  const value = sourceLabel.toLowerCase()
  if (value.includes('copa')) return 'Copa América'
  if (value.includes('africa')) return 'Africa Cup of Nations'
  if (value.includes('asian')) return 'AFC Asian Cup'
  if (value.includes('gold')) return 'CONCACAF Gold Cup'
  if (value.includes('ofc')) return 'OFC Nations Cup'
  return 'UEFA European Championship'
}

function buildTitles(candidate, achievementPath) {
  if (!existsSync(achievementPath)) return { titles: [], campaigns: [] }
  const sourceUrl = `https://www.transfermarkt.com/${candidate.slug}/erfolge/spieler/${candidate.sourcePlayerId}`
  const groups = new Map()
  const seenCampaigns = new Set()
  const campaigns = []
  for (const section of parseTitleSections(readFileSync(achievementPath, 'utf8'))) {
    const kind = titleKind(section.label)
    if (!kind) continue
    for (const row of section.rows) {
      const club = candidate.clubs.get(row.teamId)
      const isNational = kind === 'world-cup' || kind === 'continental-national'
      if (isNational && row.teamId !== candidate.nationalTeam.teamId) continue
      if (!isNational && !club) continue
      const label = titleDisplayLabel(kind, section.label, club?.leagueName)
      const id = `${kind}:${slugify(label)}`
      const campaignKey = `${id}:${row.teamId}:${row.seasonStart}`
      if (seenCampaigns.has(campaignKey)) continue
      seenCampaigns.add(campaignKey)
      campaigns.push({
        id,
        label,
        kind,
        teamId: row.teamId,
        seasonStart: row.seasonStart,
        rankingPoints: TITLE_WEIGHTS[kind],
        sourceUrl,
      })
      const existing = groups.get(id) ?? {
        id,
        label,
        kind,
        count: 0,
        rankingPoints: 0,
        sourceUrl,
      }
      existing.count += 1
      existing.rankingPoints += TITLE_WEIGHTS[kind]
      groups.set(id, existing)
    }
  }
  return {
    titles: [...groups.values()].sort(
      (a, b) => b.rankingPoints - a.rankingPoints || a.label.localeCompare(b.label),
    ),
    campaigns,
  }
}

const aggregates = new Map()
await readCsv(paths.performances, (row) => {
  const competitionId = row.competition_id
  if (!BIG_FIVE.has(competitionId) && !isChampionsLeagueMainTournament(competitionId)) return
  const appearances = Number(row.nb_on_pitch || 0)
  if (!Number.isFinite(appearances) || appearances <= 0) return
  const playerId = row.player_id
  const aggregate = aggregates.get(playerId) ?? {
    sourcePlayerId: playerId,
    clubs: new Map(),
    seasons: new Map(),
    clubSeasons: new Map(),
    championsLeagueRows: [],
  }

  if (BIG_FIVE.has(competitionId)) {
    const club = aggregate.clubs.get(row.team_id) ?? {
      clubId: row.team_id,
      clubName: row.team_name,
      leagueId: competitionId,
      leagueName: BIG_FIVE.get(competitionId),
      appearances: 0,
      logoPath: `/club-badges/${row.team_id}.png`,
    }
    club.appearances += appearances
    aggregate.clubs.set(row.team_id, club)

    const startYear = seasonStartYear(row.season_name)
    const season = aggregate.seasons.get(row.season_name) ?? {
      season: row.season_name,
      startYear,
      appearances: 0,
    }
    season.appearances += appearances
    aggregate.seasons.set(row.season_name, season)
    const clubSeasons = aggregate.clubSeasons.get(row.team_id) ?? new Map()
    clubSeasons.set(startYear, (clubSeasons.get(startYear) ?? 0) + appearances)
    aggregate.clubSeasons.set(row.team_id, clubSeasons)
  } else {
    aggregate.championsLeagueRows.push({
      clubId: row.team_id,
      startYear: seasonStartYear(row.season_name),
      appearances,
    })
  }
  aggregates.set(playerId, aggregate)
})

const seniorTeams = new Map(
  readCsvText(gunzipSync(readFileSync(paths.nationalTeamsGzip)).toString('utf8')).map((team) => [
    team.national_team_id,
    team,
  ]),
)
const nationalByPlayer = new Map()
await readCsv(paths.national, (row) => {
  const team = seniorTeams.get(row.team_id)
  const caps = Number(row.matches || 0)
  if (!team || caps <= 0) return
  const candidate = {
    teamId: row.team_id,
    teamName: team.name,
    caps,
    goals: Number(row.goals || 0),
    flagCode: flagCode(team.country_code, team.name),
  }
  nationalByPlayer.set(
    row.player_id,
    choosePrimaryNationalTeam(nationalByPlayer.get(row.player_id), candidate),
  )
})

function aggregateSliceMetrics(aggregate) {
  const clubs = [...aggregate.clubs.values()]
  const seasons = [...aggregate.seasons.values()]
  const postCutoffAppearances = seasons
    .filter((season) => season.startYear >= ERA_CUTOFF)
    .reduce((sum, season) => sum + season.appearances, 0)
  const decadeAppearances = Object.fromEntries(
    [...DECADE_RANGES].map(([key, [start, end]]) => [
      key,
      seasons
        .filter((season) => season.startYear >= start && season.startYear <= end)
        .reduce((sum, season) => sum + season.appearances, 0),
    ]),
  )
  const leagueAppearances = Object.fromEntries(
    [...BIG_FIVE.keys()].map((leagueId) => [
      leagueId,
      clubs
        .filter((club) => club.leagueId === leagueId)
        .reduce((sum, club) => sum + club.appearances, 0),
    ]),
  )
  const leaguePostCutoffAppearances = Object.fromEntries(
    [...BIG_FIVE.keys()].map((leagueId) => [
      leagueId,
      clubs
        .filter((club) => club.leagueId === leagueId)
        .reduce((sum, club) => {
          const clubSeasons = aggregate.clubSeasons.get(club.clubId) ?? new Map()
          return (
            sum +
            [...clubSeasons]
              .filter(([startYear]) => startYear >= ERA_CUTOFF)
              .reduce((clubSum, [, appearances]) => clubSum + appearances, 0)
          )
        }, 0),
    ]),
  )
  return { postCutoffAppearances, decadeAppearances, leagueAppearances, leaguePostCutoffAppearances }
}

const candidateIds = new Set()
for (const [playerId, aggregate] of aggregates) {
  if (!nationalByPlayer.has(playerId)) continue
  const clubs = [...aggregate.clubs.values()]
  const total = clubs.reduce((sum, club) => sum + club.appearances, 0)
  const metrics = aggregateSliceMetrics(aggregate)
  const mainEligible =
    total >= 150 &&
    metrics.postCutoffAppearances > 0 &&
    clubs.some((club) => club.appearances >= 50)
  const practiceEligible =
    Object.values(metrics.decadeAppearances).some((appearances) => appearances >= 50) ||
    [...BIG_FIVE.keys()].some(
      (leagueId) =>
        metrics.leagueAppearances[leagueId] >= 50 &&
        metrics.leaguePostCutoffAppearances[leagueId] > 0,
    )
  if (mainEligible || practiceEligible) candidateIds.add(playerId)
}

const profiles = new Map()
await readCsv(paths.profiles, (row) => {
  if (candidateIds.has(row.player_id)) profiles.set(row.player_id, row)
})

const candidates = []
for (const playerId of candidateIds) {
  const profile = profiles.get(playerId)
  const aggregate = aggregates.get(playerId)
  const nationalTeam = nationalByPlayer.get(playerId)
  if (!profile || !nationalTeam) continue
  const clubs = new Map(
    [...aggregate.clubs.entries()].sort(
      ([, a], [, b]) => b.appearances - a.appearances || a.clubName.localeCompare(b.clubName),
    ),
  )
  const eligibleClubIds = new Set(clubs.keys())
  const championsLeagueRows = aggregate.championsLeagueRows.filter((row) =>
    eligibleClubIds.has(row.clubId),
  )
  const championsLeagueAppearances = championsLeagueRows.reduce(
    (sum, row) => sum + row.appearances,
    0,
  )
  const displayName =
    playerNameOverrides[playerId] ||
    cleanPlayerName(profile.player_name) ||
    cleanPlayerName(profile.name_in_home_country) ||
    String(profile.player_slug || '')
      .split('-')
      .filter(Boolean)
      .map((part) => `${part[0]?.toLocaleUpperCase() ?? ''}${part.slice(1)}`)
      .join(' ')
  const seasons = [...aggregate.seasons.values()].sort((a, b) => a.startYear - b.startYear)
  const candidate = {
    sourcePlayerId: playerId,
    slug: profile.player_slug || slugify(displayName),
    displayName,
    profile,
    clubs,
    nationalTeam,
    seasons,
    clubSeasons: aggregate.clubSeasons,
    championsLeagueRows,
    championsLeagueAppearances,
    bigFiveAppearances: [...clubs.values()].reduce((sum, club) => sum + club.appearances, 0),
  }
  const titleData = buildTitles(candidate, join(paths.achievements, `${playerId}.html`))
  candidate.titles = titleData.titles
  candidate.titleCampaigns = titleData.campaigns
  const sliceMetrics = aggregateSliceMetrics(aggregate)
  candidate.postCutoffBigFiveAppearances = sliceMetrics.postCutoffAppearances
  candidate.postCutoffChampionsLeagueAppearances = championsLeagueRows
    .filter((row) => row.startYear >= ERA_CUTOFF)
    .reduce((sum, row) => sum + row.appearances, 0)
  candidate.postCutoffTitleRankingPoints = candidate.titleCampaigns
      .filter((campaign) => campaign.seasonStart >= ERA_CUTOFF)
      .reduce((sum, campaign) => sum + campaign.rankingPoints, 0)
  candidate.recognitionScore =
    candidate.postCutoffChampionsLeagueAppearances + candidate.postCutoffTitleRankingPoints

  candidate.practiceMetrics = {}
  for (const [decade, [start, end]] of DECADE_RANGES) {
    const clubAppearances = [...clubs.values()].map((club) => ({
      clubId: club.clubId,
      appearances: [...(candidate.clubSeasons.get(club.clubId) ?? new Map())]
        .filter(([startYear]) => startYear >= start && startYear <= end)
        .reduce((sum, [, appearances]) => sum + appearances, 0),
    }))
    const clueClubId = clubAppearances.sort(
      (a, b) => b.appearances - a.appearances || Number(a.clubId) - Number(b.clubId),
    )[0]?.clubId
    const recognitionScore =
      championsLeagueRows
        .filter((row) => row.startYear >= start && row.startYear <= end)
        .reduce((sum, row) => sum + row.appearances, 0) +
      candidate.titleCampaigns
        .filter((campaign) => campaign.seasonStart >= start && campaign.seasonStart <= end)
        .reduce((sum, campaign) => sum + campaign.rankingPoints, 0)
    candidate.practiceMetrics[`decade:${decade}`] = {
      appearances: sliceMetrics.decadeAppearances[decade],
      recognitionScore,
      clueClubId,
    }
  }
  for (const leagueId of BIG_FIVE.keys()) {
    const leagueClubs = [...clubs.values()].filter((club) => club.leagueId === leagueId)
    const leagueClubIds = new Set(leagueClubs.map((club) => club.clubId))
    const clueClubId = [...leagueClubs].sort(
      (a, b) => b.appearances - a.appearances || Number(a.clubId) - Number(b.clubId),
    )[0]?.clubId
    const recognitionScore =
      championsLeagueRows
        .filter((row) => leagueClubIds.has(row.clubId))
        .reduce((sum, row) => sum + row.appearances, 0) +
      candidate.titleCampaigns
        .filter(
          (campaign) =>
            leagueClubIds.has(campaign.teamId) &&
            campaign.kind !== 'world-cup' &&
            campaign.kind !== 'continental-national',
        )
        .reduce((sum, campaign) => sum + campaign.rankingPoints, 0)
    candidate.practiceMetrics[`league:${leagueId}`] = {
      appearances: sliceMetrics.leagueAppearances[leagueId],
      postCutoffAppearances: sliceMetrics.leaguePostCutoffAppearances[leagueId],
      recognitionScore,
      clueClubId,
    }
  }
  candidates.push(candidate)
}

disambiguateDisplayNames(candidates)

const mainRanking = [...candidates].sort(
  (a, b) =>
    b.recognitionScore - a.recognitionScore ||
    b.postCutoffBigFiveAppearances - a.postCutoffBigFiveAppearances ||
    Number(a.sourcePlayerId) - Number(b.sourcePlayerId),
)

const baseMainEligible = mainRanking.filter(
  (candidate) =>
    candidate.bigFiveAppearances >= 150 &&
    candidate.postCutoffBigFiveAppearances > 0 &&
    [...candidate.clubs.values()].some((club) => club.appearances >= 50),
)
const normalCandidates = baseMainEligible
  .filter((candidate) => candidate.postCutoffBigFiveAppearances >= 50)
  .slice(0, MAIN_NORMAL_SIZE)
if (normalCandidates.length < MAIN_NORMAL_SIZE) {
  throw new Error(`Only ${normalCandidates.length} candidates satisfy the Normal rules.`)
}
const normalIds = new Set(normalCandidates.map((candidate) => candidate.sourcePlayerId))
const hardcoreCandidates = [
  ...normalCandidates,
  ...baseMainEligible.filter((candidate) => !normalIds.has(candidate.sourcePlayerId)),
].slice(0, MAIN_HARDCORE_SIZE)
if (hardcoreCandidates.length < MAIN_HARDCORE_SIZE) {
  throw new Error(`Only ${hardcoreCandidates.length} candidates satisfy the Hardcore rules.`)
}
const hardcoreIds = new Set(hardcoreCandidates.map((candidate) => candidate.sourcePlayerId))

const practiceRanks = new Map()
for (const filterKey of [
  ...[...DECADE_RANGES.keys()].map((value) => `decade:${value}`),
  ...[...BIG_FIVE.keys()].map((value) => `league:${value}`),
]) {
  const ranked = candidates
    .filter((candidate) => {
      const metric = candidate.practiceMetrics[filterKey]
      return (
        metric?.appearances >= 50 &&
        (!filterKey.startsWith('league:') || metric.postCutoffAppearances > 0)
      )
    })
    .sort((a, b) => {
      const left = a.practiceMetrics[filterKey]
      const right = b.practiceMetrics[filterKey]
      return (
        right.recognitionScore - left.recognitionScore ||
        right.appearances - left.appearances ||
        Number(a.sourcePlayerId) - Number(b.sourcePlayerId)
      )
    })
  if (ranked.length < PRACTICE_HARDCORE_SIZE) {
    throw new Error(`${filterKey} has only ${ranked.length} players; ${PRACTICE_HARDCORE_SIZE} are required.`)
  }
  ranked.slice(0, PRACTICE_HARDCORE_SIZE).forEach((candidate, index) => {
    const ranks = practiceRanks.get(candidate.sourcePlayerId) ?? {}
    ranks[filterKey] = index + 1
    practiceRanks.set(candidate.sourcePlayerId, ranks)
  })
}

mkdirSync(dirname(paths.manifest), { recursive: true })
writeFileSync(
  paths.manifest,
  `${JSON.stringify(
    candidates.map((candidate) => ({
      sourcePlayerId: candidate.sourcePlayerId,
      slug: candidate.slug,
      displayName: candidate.displayName,
      recognitionScore: candidate.recognitionScore,
      postCutoffBigFiveAppearances: candidate.postCutoffBigFiveAppearances,
      practiceMetrics: candidate.practiceMetrics,
      bigFiveAppearances: candidate.bigFiveAppearances,
    })),
    null,
    2,
  )}\n`,
)

if (manifestOnly) {
  console.log(`Wrote ${candidates.length} candidates to ${paths.manifest}`)
  process.exit(0)
}

const aliasOverrides = {
  'cristiano-ronaldo': ['Cristiano', 'CR7'],
  ronaldinho: ['Ronaldinho Gaúcho'],
  'lionel-messi': ['Messi', 'Leo Messi'],
  'zlatan-ibrahimovic': ['Zlatan'],
  'neymar-jr-': ['Neymar'],
  'kylian-mbappe': ['Mbappé', 'Mbappe'],
  'erling-haaland': ['Haaland'],
}

const selectedIds = new Set([...hardcoreIds, ...practiceRanks.keys()])
const selectedCandidates = candidates
  .filter((candidate) => selectedIds.has(candidate.sourcePlayerId))
  .sort(
    (a, b) =>
      Number(hardcoreIds.has(b.sourcePlayerId)) - Number(hardcoreIds.has(a.sourcePlayerId)) ||
      b.recognitionScore - a.recognitionScore ||
      b.postCutoffBigFiveAppearances - a.postCutoffBigFiveAppearances ||
      Number(a.sourcePlayerId) - Number(b.sourcePlayerId),
  )

const players = selectedCandidates.map((candidate) => {
  const nameParts = candidate.displayName.split(/\s+/)
  const profilePosition = candidate.profile.position || candidate.profile.main_position || 'Attack'
  const role = candidate.profile.main_position || profilePosition.split(' - ').at(-1) || 'Forward'
  const homeName = cleanPlayerName(candidate.profile.name_in_home_country || '')
  const acceptedNames = [
    candidate.displayName,
    ...(homeName && homeName !== candidate.displayName ? [homeName] : []),
    ...(aliasOverrides[candidate.slug] ?? []),
  ]
  const titles = candidate.titles
  return {
    id: `${candidate.slug}-${candidate.sourcePlayerId}`,
    sourcePlayerId: candidate.sourcePlayerId,
    displayName: candidate.displayName,
    acceptedNames: [...new Set(acceptedNames)],
    firstName: nameParts[0],
    lastName: nameParts.at(-1),
    initials: createInitials(candidate.displayName),
    active: candidate.seasons.at(-1).startYear >= 2025,
    debutSeason: candidate.seasons[0].season,
    finalSeason: candidate.seasons.at(-1).season,
    broadPosition: broadPosition(profilePosition),
    primaryRole: role,
    secondaryRoles: [],
    birthCountry: candidate.profile.country_of_birth || candidate.profile.citizenship || 'Unknown',
    clubs: [...candidate.clubs.values()],
    nationalTeam: candidate.nationalTeam,
    seasonAppearances: candidate.seasons,
    bigFiveAppearances: candidate.bigFiveAppearances,
    postCutoffBigFiveAppearances: candidate.postCutoffBigFiveAppearances,
    championsLeagueAppearances: candidate.championsLeagueAppearances,
    postCutoffChampionsLeagueAppearances: candidate.postCutoffChampionsLeagueAppearances,
    postCutoffTitleRankingPoints: candidate.postCutoffTitleRankingPoints,
    titles,
    recognitionScore: candidate.recognitionScore,
    normalPool: normalIds.has(candidate.sourcePlayerId),
    hardcoreEligible: hardcoreIds.has(candidate.sourcePlayerId),
    practiceRanks: practiceRanks.get(candidate.sourcePlayerId) ?? {},
    practiceMetrics: candidate.practiceMetrics,
    sources: [
      DATASET_URL,
      `https://www.transfermarkt.com/${candidate.slug}/profil/spieler/${candidate.sourcePlayerId}`,
      `https://www.transfermarkt.com/${candidate.slug}/erfolge/spieler/${candidate.sourcePlayerId}`,
    ],
    provenanceNote:
      'Big-Five league and Champions League appearances are aggregated from the CC0 source snapshot; senior-team records and selected major team titles are source-linked and validated during generation.',
    lastVerified: VERIFIED_DATE,
  }
})

mkdirSync(dirname(paths.output), { recursive: true })
writeFileSync(paths.output, `${JSON.stringify(players, null, 2)}\n`)
writeFileSync(
  paths.searchOutput,
  `${JSON.stringify(
    candidates.map((candidate) => {
      const homeName = cleanPlayerName(candidate.profile.name_in_home_country || '')
      return {
        id: `${candidate.slug}-${candidate.sourcePlayerId}`,
        displayName: candidate.displayName,
        acceptedNames: [
          candidate.displayName,
          ...(homeName && homeName !== candidate.displayName ? [homeName] : []),
          ...(aliasOverrides[candidate.slug] ?? []),
        ],
        lastName: candidate.displayName.split(/\s+/).at(-1),
      }
    }),
    null,
    2,
  )}\n`,
)
console.log(
  `Wrote ${players.length} answer players (${players.filter((player) => player.normalPool).length} Normal, ${players.filter((player) => player.hardcoreEligible).length} Hardcore) and ${candidates.length} search players.`,
)
