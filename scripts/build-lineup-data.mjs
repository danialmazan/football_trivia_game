import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createGunzip } from 'node:zlib'
import { createInterface } from 'node:readline'

const VERIFIED_DATE = '2026-08-05'
const root = new URL('..', import.meta.url).pathname
const cacheRoot = process.env.FOOTBALL_DATA_CACHE ?? join(root, '.cache', 'football')
const lineupCache = join(cacheRoot, 'lineups')
const playerSource =
  process.env.LINEUP_PLAYERS_CSV_GZ ?? join(lineupCache, 'sources', 'players.csv.gz')
const output = process.env.LINEUP_OUTPUT_JSON ?? join(root, 'src', 'data', 'lineupMatches.json')
const searchOutput =
  process.env.LINEUP_SEARCH_OUTPUT_JSON ?? join(root, 'src', 'data', 'lineupSearch.json')
const poolOutput =
  process.env.LINEUP_DAILY_POOL_SQL ?? join(lineupCache, 'generated-lineup-daily-pool.sql')
const mononymsSource = join(root, 'src', 'data', 'lineupMononyms.json')
const activeFirstSeason = 2005
const activeLastSeason = 2025
const performancesSource = process.env.FOOTBALL_PERFORMANCES_CSV ?? join(cacheRoot, 'raw', 'player_performances.csv')
const nationalPerformancesSource = process.env.FOOTBALL_NATIONAL_PERFORMANCES_CSV ?? join(cacheRoot, 'raw', 'player_national_performances.csv')
const nationalTeamsSource = process.env.FOOTBALL_NATIONAL_TEAMS_CSV_GZ ?? join(cacheRoot, 'raw', 'national_teams.csv.gz')
const teamDetailsSource = process.env.FOOTBALL_TEAM_DETAILS_CSV ?? join(cacheRoot, 'raw', 'team_details.csv')
const playerGameSource = process.env.FOOTBALL_OUTPUT_JSON ?? join(root, 'src', 'data', 'players.json')

// Transfermarkt's performance feed omits the domestic records for these two
// tournament seasons. Their profile/transfer records identify the only team
// represented across the season, so keep the reviewed fallback explicit.
const verifiedSeasonClubOverrides = new Map([
  ['5855:1997', 'Atlético Mineiro'],
  ['1772:2001', 'Korea University'],
])

const competitions = [
  {
    id: 'ucl',
    transfermarktId: 'CL',
    slug: 'uefa-champions-league',
    label: 'UEFA Champions League',
    seasons: Array.from({ length: 31 }, (_, index) => 1995 + index),
  },
  {
    id: 'euro',
    transfermarktId: 'EURO',
    slug: 'uefa-euro',
    label: 'UEFA European Championship',
    seasons: [1995, 1999, 2003, 2007, 2011, 2015, 2020, 2023],
  },
  {
    id: 'world-cup',
    transfermarktId: 'FIWC',
    slug: 'world-cup',
    label: 'FIFA World Cup',
    seasons: [1997, 2001, 2005, 2009, 2013, 2017, 2021, 2025],
  },
]

// Venue-local IANA zones. This preserves the correct historical daylight-saving
// rules instead of freezing a modern UTC offset into old fixtures.
const venueTimezones = {
  'AT&T Stadium': 'America/Chicago', 'Abanca Riazor': 'Europe/Madrid',
  'Al-Bayt Stadium': 'Asia/Qatar', 'Allianz Arena': 'Europe/Berlin',
  'Allianz Stadium': 'Europe/Rome', 'Amsterdam ArenA': 'Europe/Amsterdam',
  Anfield: 'Europe/London', 'Atatürk Olimpiyat': 'Europe/Istanbul',
  BayArena: 'Europe/Berlin', 'Cape Town Stadium': 'Africa/Johannesburg',
  'Delle Alpi': 'Europe/Rome', 'Donbass Arena': 'Europe/Kyiv',
  'Elland Road': 'Europe/London', 'Emirates Stadium': 'Europe/London',
  'Ernst-Happel-Stadion': 'Europe/Vienna', 'Estadio Alfredo Di Stéfano': 'Europe/Madrid',
  'Estádio Governador Magalhães Pinto': 'America/Sao_Paulo',
  'Estádio Jornalista Mário Filho': 'America/Sao_Paulo',
  'Estádio José Alvalade': 'Europe/Lisbon', 'Estádio da Luz': 'Europe/Lisbon',
  'Estádio do Dragão': 'Europe/Lisbon', 'Etihad Stadium': 'Europe/London',
  'FNB-Stadium': 'Africa/Johannesburg', 'Gazprom Arena': 'Europe/Moscow',
  'Giuseppe Meazza': 'Europe/Rome', 'Groupama Stadium': 'Europe/Paris',
  'Hampden Park': 'Europe/London', Highbury: 'Europe/London',
  'Johan Cruijff ArenA': 'Europe/Amsterdam', 'Koning Boudewijnstadion': 'Europe/Brussels',
  'La Cerámica': 'Europe/Madrid', 'Lusail Stadium': 'Asia/Qatar',
  'Luzhniki Stadium': 'Europe/Moscow', 'Mercedes-Benz Stadium': 'America/New_York',
  Mestalla: 'Europe/Madrid', 'MetLife Stadium': 'America/New_York',
  'Millennium Stadium': 'Europe/London', 'Moses Mabhida Stadion': 'Africa/Johannesburg',
  'NISSAN Stadium': 'Asia/Tokyo', 'NSK Olimpisky': 'Europe/Kyiv',
  'Neo Química Arena': 'America/Sao_Paulo', 'Old Trafford': 'Europe/London',
  'Olimpico di Roma': 'Europe/Rome', 'Olympiakó Stádio Athinon "Spyros Louis"': 'Europe/Athens',
  'Olympiastadion Berlin': 'Europe/Berlin', 'Olympiastadion München': 'Europe/Berlin',
  'Olympisch Stadion Amsterdam': 'Europe/Amsterdam', 'Olímpic Lluís Companys': 'Europe/Madrid',
  'Orange Vélodrome': 'Europe/Paris', 'PGE Narodowy': 'Europe/Warsaw',
  'Parc des Princes': 'Europe/Paris', 'Philips Stadion': 'Europe/Amsterdam',
  'Puskás Aréna': 'Europe/Budapest', 'Riyadh Air Metropolitano': 'Europe/Madrid',
  'SIGNAL IDUNA PARK': 'Europe/Berlin', 'Saitama Stadium 2002': 'Asia/Tokyo',
  'Santiago Bernabéu': 'Europe/Madrid', 'Seoul World Cup Stadium': 'Asia/Seoul',
  'Spotify Camp Nou': 'Europe/Madrid', 'St. Jakob-Park': 'Europe/Zurich',
  'Stade Louis-II': 'Europe/Monaco', 'Stade de France': 'Europe/Paris',
  'Stade de Gerland': 'Europe/Paris', 'Stade de la Beaujoire': 'Europe/Paris',
  'Stadion Feyenoord "De Kuip"': 'Europe/Amsterdam', 'Stamford Bridge': 'Europe/London',
  'Tottenham Hotspur Stadium': 'Europe/London', 'Veltins-Arena': 'Europe/Berlin',
  'Vicente Calderón': 'Europe/Madrid', 'Wembley Stadium': 'Europe/London',
}

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&uuml;/g, 'ü')
    .replace(/&ouml;/g, 'ö')
    .replace(/&auml;/g, 'ä')
    .replace(/&eacute;/g, 'é')
    .replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó')
    .replace(/&aacute;/g, 'á')
    .replace(/&ccedil;/g, 'ç')
    .replace(/&szlig;/g, 'ß')
}

function text(value) {
  return decodeHtml(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
}

function csvLine(line) {
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

async function loadPlayers() {
  if (!existsSync(playerSource)) {
    throw new Error(`Missing lineup player source: ${playerSource}`)
  }
  const input = createReadStream(playerSource).pipe(createGunzip())
  const lines = createInterface({ input, crlfDelay: Infinity })
  let headers
  const players = new Map()
  for await (const line of lines) {
    if (!headers) {
      headers = csvLine(line)
      continue
    }
    const values = csvLine(line)
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
    players.set(String(row.player_id), {
      displayName: row.name,
      firstName: row.first_name,
      lastName: row.last_name || row.name.split(/\s+/).at(-1) || row.name,
      citizenship: row.country_of_citizenship,
      cc0Name: row.name,
      cc0ComposedName: [row.first_name, row.last_name].filter(Boolean).join(' '),
    })
  }
  if (existsSync(playerGameSource)) {
    for (const player of JSON.parse(readFileSync(playerGameSource, 'utf8'))) {
      const existing = players.get(String(player.sourcePlayerId))
      players.set(String(player.sourcePlayerId), {
        ...existing,
        displayName: player.displayName,
        firstName: player.firstName,
        lastName: player.lastName,
        citizenship: existing?.citizenship || player.birthCountry,
        cc0Name: existing?.cc0Name,
        cc0ComposedName: existing?.cc0ComposedName,
      })
    }
  }
  return players
}

function loadTransfermarktMetadata() {
  const metadata = new Map()
  if (!existsSync(join(lineupCache, 'player-metadata'))) return metadata
  for (const file of readdirSync(join(lineupCache, 'player-metadata'))) {
    if (!file.endsWith('.json')) continue
    const payload = JSON.parse(readFileSync(join(lineupCache, 'player-metadata', file), 'utf8'))
    for (const player of payload.data ?? []) metadata.set(String(player.id), player)
  }
  return metadata
}

async function enrichProfileNames(candidateRegistry) {
  const requests = []
  for (const [sourcePlayerId, candidates] of candidateRegistry) {
    if (candidates.some((candidate) => nameTokens(candidate.value).length > 1)) continue
    const slug = candidates.find((candidate) => candidate.profileSlug)?.profileSlug
    if (slug) requests.push({ sourcePlayerId, slug })
  }
  await mapConcurrent(requests, 4, async ({ sourcePlayerId, slug }) => {
    const candidates = candidateRegistry.get(sourcePlayerId) ?? []
    const path = join(lineupCache, 'player-profiles', `${sourcePlayerId}.html`)
    let html
    try {
      html = await fetchCached(`https://www.transfermarkt.com/${slug}/profil/spieler/${sourcePlayerId}`, path, 1)
    } catch (error) {
      console.warn(`Could not enrich lineup player ${sourcePlayerId} from profile: ${error instanceof Error ? error.message : String(error)}`)
      return
    }
    const fullName = html.match(/Full name:\s*<\/span>\s*<span[^>]*info-table__content--bold[^>]*>([\s\S]*?)<\/span>/i)?.[1]
    const value = fullName ? text(fullName) : ''
    if (value && nameTokens(value).length > 1) {
      candidates.push({ value, source: 'Transfermarkt profile full name', profileSlug: slug })
    }
  })
}

async function enrichTransfermarktMetadata(metadata, playerIds) {
  const missing = playerIds.filter((playerId) => !metadata.has(playerId))
  const batches = Array.from({ length: Math.ceil(missing.length / 75) }, (_, index) =>
    missing.slice(index * 75, index * 75 + 75),
  )
  await mapConcurrent(batches, 4, async (ids) => {
    if (!ids.length) return
    const query = ids.map((id) => `ids%5B%5D=${encodeURIComponent(id)}`).join('&')
    const path = join(lineupCache, 'player-metadata', `batch-${cacheBatchKey(ids)}.json`)
    const payload = JSON.parse(await fetchCached(`https://tmapi.transfermarkt.technology/players?${query}`, path))
    for (const player of payload.data ?? []) metadata.set(String(player.id), player)
  })
}

function seasonStartYear(season) {
  const raw = Number(String(season).split('/')[0])
  if (!Number.isFinite(raw)) return Number.NaN
  if (raw >= 1900) return raw
  return raw >= 80 ? 1900 + raw : 2000 + raw
}

function cacheBatchKey(values) {
  let hash = 2166136261
  for (const character of values.join(',')) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

async function readCsvRows(path, callback, compressed = false) {
  if (!existsSync(path)) throw new Error(`Missing lineup clue source: ${path}`)
  const source = createReadStream(path)
  const input = compressed ? source.pipe(createGunzip()) : source
  const lines = createInterface({ input, crlfDelay: Infinity })
  let headers
  for await (const line of lines) {
    if (!headers) {
      headers = csvLine(line)
      continue
    }
    if (!line.trim()) continue
    const values = csvLine(line)
    callback(Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])))
  }
}

async function addStarterClues(matches, players) {
  const requiredSeasons = new Map()
  for (const match of matches) {
    for (const starter of match.teams.flatMap((team) => team.starters)) {
      const seasons = requiredSeasons.get(starter.sourcePlayerId) ?? new Set()
      seasons.add(match.seasonStart)
      requiredSeasons.set(starter.sourcePlayerId, seasons)
    }
  }

  const nationalTeamNames = new Map()
  const nationalityNames = new Map()
  await readCsvRows(nationalTeamsSource, (row) => {
    nationalTeamNames.set(row.national_team_id, row.name)
    nationalityNames.set(Number(row.country_id), row.country_name)
  }, true)
  const nationalTeamsByPlayer = new Map()
  await readCsvRows(nationalPerformancesSource, (row) => {
    if (!requiredSeasons.has(row.player_id) || Number(row.matches || 0) <= 0) return
    const name = nationalTeamNames.get(row.team_id)
    if (!name) return
    const teams = nationalTeamsByPlayer.get(row.player_id) ?? []
    teams.push({ name, caps: Number(row.matches || 0) })
    nationalTeamsByPlayer.set(row.player_id, teams)
  })

  const clubRows = new Map()
  await readCsvRows(performancesSource, (row) => {
    const seasons = requiredSeasons.get(row.player_id)
    const startYear = seasonStartYear(row.season_name)
    const appearances = Number(row.nb_on_pitch || 0)
    if (!seasons?.has(startYear) || !Number.isFinite(appearances) || appearances <= 0) return
    const key = `${row.player_id}:${startYear}:${row.team_id}`
    const current = clubRows.get(key) ?? { playerId: row.player_id, startYear, name: row.team_name, appearances: 0 }
    current.appearances += appearances
    clubRows.set(key, current)
  })
  const primaryClub = new Map()
  for (const club of clubRows.values()) {
    const key = `${club.playerId}:${club.startYear}`
    const current = primaryClub.get(key)
    if (!current || club.appearances > current.appearances || (club.appearances === current.appearances && club.name.localeCompare(current.name) < 0)) {
      primaryClub.set(key, club)
    }
  }

  const uclMissingNationalityIds = [...new Set(matches
    .filter((match) => match.competition === 'ucl')
    .flatMap((match) => match.teams.flatMap((team) => team.starters))
    .filter((starter) => !(nationalTeamsByPlayer.get(starter.sourcePlayerId)?.length) && !players.get(starter.sourcePlayerId)?.citizenship)
    .map((starter) => starter.sourcePlayerId))]
  const apiNationalities = new Map()
  const nationalityBatches = Array.from({ length: Math.ceil(uclMissingNationalityIds.length / 75) }, (_, index) =>
    uclMissingNationalityIds.slice(index * 75, index * 75 + 75))
  await mapConcurrent(nationalityBatches, 4, async (ids, index) => {
    if (!ids.length) return
    const query = ids.map((id) => `ids%5B%5D=${encodeURIComponent(id)}`).join('&')
    const path = join(lineupCache, 'player-metadata', `batch-${cacheBatchKey(ids)}.json`)
    const payload = JSON.parse(await fetchCached(`https://tmapi.transfermarkt.technology/players?${query}`, path))
    for (const player of payload.data ?? []) {
      const details = player.nationalityDetails?.nationalities ?? {}
      const ids = [details.nationalityId, details.secondNationalityId].filter((id) => Number(id) > 0)
      const names = ids
        .map((id) => nationalityNames.get(Number(id)))
        .filter(Boolean)
      if (names.length) apiNationalities.set(String(player.id), [...new Set(names)])
    }
  })
  const unresolvedNationalityIds = uclMissingNationalityIds.filter((id) => !apiNationalities.has(id))
  await mapConcurrent(unresolvedNationalityIds, 4, async (playerId) => {
    const player = players.get(playerId)
    const slug = normalize(player?.displayName ?? playerId).replace(/\s+/g, '-')
    const path = join(lineupCache, 'player-profiles', `${playerId}.html`)
    const html = await fetchCached(`https://www.transfermarkt.com/${slug}/profil/spieler/${playerId}`, path)
    const citizenshipBlock = html.match(/Citizenship:[\s\S]{0,900}/)?.[0] ?? ''
    const names = [...citizenshipBlock.matchAll(/title="([^"]+)" alt="\1" class="flaggenrahmen/g)].map((match) => decodeHtml(match[1]))
    if (names.length) apiNationalities.set(playerId, [...new Set(names)])
  })

  const missingClubKeys = new Set(matches
    .filter((match) => match.competition !== 'ucl')
    .flatMap((match) => match.teams.flatMap((team) => team.starters.map((starter) => `${starter.sourcePlayerId}:${match.seasonStart}`)))
    .filter((key) => !primaryClub.has(key)))
  const missingClubPlayerIds = [...new Set([...missingClubKeys].map((key) => key.split(':')[0]))]
  const clubNames = new Map()
  await readCsvRows(teamDetailsSource, (row) => {
    clubNames.set(String(row.club_id), row.club_name.replace(/\s*\(\d+\)\s*$/, ''))
  })
  const performanceClubCounts = []
  await mapConcurrent(missingClubPlayerIds, 6, async (playerId, index) => {
    const path = join(lineupCache, 'player-performance', `${playerId}.json`)
    const payload = JSON.parse(await fetchCached(`https://tmapi.transfermarkt.technology/player/${playerId}/performance-game`, path))
    const counts = new Map()
    for (const performance of payload.data?.performance ?? []) {
      const season = Number(performance.gameInformation?.seasonId)
      const key = `${playerId}:${season}`
      if (!missingClubKeys.has(key) || performance.gameInformation?.isNationalGame || performance.statistics?.generalStatistics?.participationState !== 'played') continue
      const primaryClubId = Number(performance.statistics?.generalStatistics?.primaryClubId)
      const clubId = String(primaryClubId > 0 ? primaryClubId : performance.clubsInformation?.club?.clubId ?? '')
      if (!clubId) continue
      const clubKey = `${key}:${clubId}`
      counts.set(clubKey, (counts.get(clubKey) ?? 0) + 1)
    }
    for (const [clubKey, appearances] of counts) {
      const [id, season, clubId] = clubKey.split(':')
      performanceClubCounts.push({ id, season, clubId, appearances })
    }
    console.log(`Clue performance ${index + 1}/${missingClubPlayerIds.length}: ${playerId}`)
  })
  const unresolvedClubIds = [...new Set(performanceClubCounts.map((row) => row.clubId).filter((id) => !clubNames.has(id)))]
  const clubBatches = Array.from({ length: Math.ceil(unresolvedClubIds.length / 75) }, (_, index) =>
    unresolvedClubIds.slice(index * 75, index * 75 + 75))
  await mapConcurrent(clubBatches, 4, async (ids, index) => {
    if (!ids.length) return
    const query = ids.map((id) => `ids%5B%5D=${encodeURIComponent(id)}`).join('&')
    const path = join(lineupCache, 'club-metadata', `batch-${cacheBatchKey(ids)}.json`)
    const payload = JSON.parse(await fetchCached(`https://tmapi.transfermarkt.technology/clubs?${query}`, path))
    for (const club of payload.data ?? []) clubNames.set(String(club.id), club.name.replace(/\s*\(.*\)\s*$/, ''))
  })
  for (const { id, season, clubId, appearances } of performanceClubCounts) {
    const key = `${id}:${season}`
    const name = clubNames.get(clubId)
    if (!name) continue
    const current = primaryClub.get(key)
    if (!current || appearances > current.appearances || (appearances === current.appearances && name.localeCompare(current.name) < 0)) {
      primaryClub.set(key, { playerId: id, startYear: Number(season), name, appearances })
    }
  }
  for (const [key, name] of verifiedSeasonClubOverrides) {
    primaryClub.set(key, { playerId: key.split(':')[0], startYear: Number(key.split(':')[1]), name, appearances: 1 })
  }

  for (const match of matches) {
    for (const team of match.teams) for (const starter of team.starters) {
      const cappedTeams = (nationalTeamsByPlayer.get(starter.sourcePlayerId) ?? [])
        .sort((left, right) => right.caps - left.caps || left.name.localeCompare(right.name))
      const nationalities = [...new Set(cappedTeams.map((team) => team.name))]
      const citizenship = String(players.get(starter.sourcePlayerId)?.citizenship ?? '')
        .split(/[,;/]/)
        .map((value) => value.trim())
        .filter(Boolean)
      starter.nationality = match.competition !== 'ucl'
        ? team.name
        : (nationalities.length ? nationalities : citizenship.length ? citizenship : apiNationalities.get(starter.sourcePlayerId) ?? []).join(' / ')
      starter.seasonClub = primaryClub.get(`${starter.sourcePlayerId}:${match.seasonStart}`)?.name ?? ''
    }
  }
}

function seasonUrl(competition, season) {
  return `https://www.transfermarkt.com/${competition.slug}/gesamtspielplan/pokalwettbewerb/${competition.transfermarktId}/saison_id/${season}`
}

function matchUrl(matchId) {
  return `https://www.transfermarkt.com/spielbericht/index/spielbericht/${matchId}`
}

async function fetchCached(url, path, maxAttempts = 5) {
  if (existsSync(path)) return readFileSync(path, 'utf8')
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; LeoGuessiData/1.0; project data refresh)',
        'accept-language': 'en-GB,en;q=0.9',
      },
    })
    if (response.ok) {
      const body = await response.text()
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, body)
      await new Promise((resolve) => setTimeout(resolve, 350))
      return body
    }
    if (attempt === maxAttempts) throw new Error(`Could not fetch ${url}: ${response.status}`)
    await new Promise((resolve) => setTimeout(resolve, attempt * 1_500))
  }
  throw new Error(`Could not fetch ${url}`)
}

async function mapConcurrent(items, concurrency, callback) {
  const results = Array(items.length)
  let cursor = 0
  async function worker() {
    for (;;) {
      const index = cursor
      cursor += 1
      if (index >= items.length) return
      results[index] = await callback(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return results
}

function editionLabel(competition, season) {
  if (competition.id === 'ucl') {
    return `${season}/${String(season + 1).slice(-2)}`
  }
  if (competition.id === 'euro') return `EURO ${season === 2020 ? 2020 : season + 1}`
  return `World Cup ${season + 1}`
}

function normalizedStage(stage) {
  const value = text(stage)
  if (/Semi-Finals 1st Leg/i.test(value)) return 'Semi-final · First leg'
  if (/Semi-Finals 2nd Leg/i.test(value)) return 'Semi-final · Second leg'
  if (/Semi-Finals/i.test(value)) return 'Semi-final'
  return 'Final'
}

function targetStage(competitionId, value) {
  if (competitionId === 'ucl') return /^(Semi-Finals(?: 1st Leg| 2nd Leg)?|Final)$/i.test(value)
  return /^(Semi-Finals|Final)$/i.test(value)
}

function parseSeasonPage(html, competition, season) {
  const matches = []
  for (const bodyMatch of html.matchAll(/<tbody>([\s\S]*?)<\/tbody>/g)) {
    const body = bodyMatch[1]
    const stageMatch = body.match(/class="bg_Sturm"[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/)
    if (!stageMatch) continue
    const stage = text(stageMatch[1])
    if (!targetStage(competition.id, stage)) continue

    const reportMatches = [...body.matchAll(/<a title="Match report"[^>]*id="(\d+)"[^>]*href="([^"]+)"/g)]
    for (const report of reportMatches) {
      const reportIndex = report.index ?? 0
      const before = body.slice(0, reportIndex)
      const dateMatches = [...before.matchAll(/datum\/(\d{4}-\d{2}-\d{2})/g)]
      const date = dateMatches.at(-1)?.[1] ?? ''
      const rowStart = before.lastIndexOf('<tr>')
      const rowEnd = body.indexOf('</tr>', reportIndex)
      const row = body.slice(rowStart, rowEnd)
      const clubs = [...row.matchAll(/<a title="([^"]+)" href="[^"]*\/verein\/(\d+)[^"]*">/g)]
        .map((club) => ({ name: decodeHtml(club[1]), id: club[2] }))
        .filter((club, index, all) => all.findIndex((item) => item.id === club.id) === index)
      const timeBlockStart = before.lastIndexOf('class="bg_blau_20"')
      const timeBlock = before.slice(timeBlockStart, reportIndex)
      const timeMatch = text(timeBlock).match(/\b(\d{1,2}:\d{2}\s+(?:AM|PM))\b/i)
      if (!date || clubs.length < 2) {
        throw new Error(`Could not parse ${competition.id} ${season} match ${report[1]}`)
      }
      matches.push({
        id: `tm-${report[1]}`,
        sourceMatchId: report[1],
        competition: competition.id,
        competitionLabel: competition.label,
        edition: editionLabel(competition, season),
        seasonStart: season,
        stage: normalizedStage(stage),
        date,
        kickoffLocal: timeMatch?.[1].toUpperCase() ?? '',
        homeTeam: clubs[0],
        awayTeam: clubs[1],
        sourceUrls: [matchUrl(report[1]), seasonUrl(competition, season)],
      })
    }
  }
  return matches
}

function playerFromAnchor(fragment, players, candidateRegistry) {
  const anchor = fragment.match(/<a(?: title="([^"]+)")? href="[^"]*\/([^"/]+)\/profil\/spieler\/(\d+)">([^<]+)<\/a>/)
  if (!anchor) return null
  const playerId = anchor[3]
  const source = players.get(playerId)
  const displayName = source?.displayName || decodeHtml(anchor[1] || anchor[4])
  const shortName = decodeHtml(anchor[4])
  const candidates = candidateRegistry.get(playerId) ?? []
  for (const [value, sourceName] of [
    [anchor[1] || (nameTokens(source?.displayName).length < 2 ? anchor[2].replace(/-/g, ' ') : ''), 'match-sheet anchor title'],
    [anchor[4], 'match-sheet short label'],
    [source?.cc0ComposedName, 'composed CC0 first_name + last_name'],
    [source?.cc0Name, 'CC0 name'],
  ]) {
    if (value?.trim()) candidates.push({ value: value.trim(), source: sourceName, profileSlug: anchor[2] })
  }
  candidateRegistry.set(playerId, candidates)
  return {
    id: `tm-player-${playerId}`,
    sourcePlayerId: playerId,
    displayName,
    acceptedNames: [...new Set([shortName, source?.lastName].filter(Boolean))],
    lastName: source?.lastName || displayName.split(/\s+/).at(-1) || displayName,
  }
}

function parseTeam(section, players, candidateRegistry) {
  const header = section.match(/aufstellung-unterueberschrift-mannschaft[\s\S]*?class="sb-vereinslink"[^>]*href="[^"]*\/verein\/(\d+)[^"]*"[^>]*>([^<]+)<\/a>/)
  const formation = section.match(/Starting Line-up:\s*([^<\r\n]+)/)?.[1]?.trim()
  if (!header || !formation) return null
  const starterArea = section.split('aufstellung-ersatzbank-box')[0]
  const containerStarts = [...starterArea.matchAll(/<div class="formation-player-container" style="top: ([\d.]+)%; left: ([\d.]+)%;">/g)]
  const starters = containerStarts.map((container, index) => {
    const start = container.index ?? 0
    const end = containerStarts[index + 1]?.index ?? starterArea.length
    const fragment = starterArea.slice(start, end)
    const player = playerFromAnchor(fragment, players, candidateRegistry)
    const number = text(fragment.match(/tm-shirt-number[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? '')
    if (!player) throw new Error(`Missing starter in ${text(header[2])}`)
    return {
      ...player,
      shirtNumber: number,
      x: Math.min(100, Math.max(0, Number(container[2]) + 10)),
      y: Math.min(100, Math.max(0, Number(container[1]) + 5)),
    }
  })

  const benchArea = section.match(/<table class="ersatzbank">([\s\S]*?)<tr class="bench-table__tr">/)?.[1] ?? ''
  const bench = [...benchArea.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((row) => {
    const player = playerFromAnchor(row[1], players, candidateRegistry)
    if (!player) return null
    const number = text(row[1].match(/tm-shirt-number[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? '')
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)]
    return { ...player, shirtNumber: number, position: text(cells.at(-1)?.[1] ?? '') }
  }).filter(Boolean)

  return {
    id: `tm-team-${header[1]}`,
    name: text(header[2]),
    formation: decodeHtml(formation),
    starters,
    bench,
  }
}

function parseMatchPage(html, manifest, players, candidateRegistry) {
  const lineupStart = html.indexOf('>Line-Ups')
  const lineupHtml = lineupStart >= 0 ? html.slice(lineupStart) : html
  const teamStarts = [...lineupHtml.matchAll(/<div class="unterueberschrift aufstellung-unterueberschrift-mannschaft/g)]
  const sections = teamStarts.slice(0, 2).map((entry, index) => {
    const start = entry.index ?? 0
    const end = teamStarts[index + 1]?.index ?? lineupHtml.length
    return lineupHtml.slice(start, end)
  })
  const teams = sections.map((section) => parseTeam(section, players, candidateRegistry))
  const stadiumBlock = html.match(/<p class="sb-zusatzinfos">([\s\S]*?)<\/p>/)?.[1] ?? ''
  const stadium = text(stadiumBlock.match(/<a href="\/stadion\/[^"]+">([^<]+)<\/a>/)?.[1] ?? '')
  if (teams.length !== 2 || teams.some((team) => !team)) {
    throw new Error(`Match ${manifest.sourceMatchId} does not have two parsed lineups.`)
  }
  const timezone = venueTimezones[stadium]
  if (!timezone) throw new Error(`Missing verified timezone for venue: ${stadium}`)
  return {
    ...manifest,
    kickoffLocal: manifest.kickoffLocal || 'Time unavailable',
    timezone,
    venue: stadium,
    teams,
    lastVerified: VERIFIED_DATE,
  }
}

function normalize(value) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function rosterVersion(matches) {
  let hash = 2166136261
  const value = matches.map((match) => `${match.id}:${match.teams.flatMap((team) => team.starters.map((player) => player.id)).join(',')}`).join('|')
  for (const character of value) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return `lineups-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function normalizeWhitespace(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
}

function nameTokens(value) {
  return normalizeWhitespace(value).split(/\s+/).filter(Boolean)
}

function codePointLength(value) {
  return [...value].length
}

function canonicalizeNames(matches, candidateRegistry, metadata, previousNames) {
  const allowlist = JSON.parse(readFileSync(mononymsSource, 'utf8'))
  const allowlisted = new Map(allowlist.map((entry) => [String(entry.sourcePlayerId), entry]))
  const players = new Map()
  for (const match of matches) {
    for (const player of match.teams.flatMap((team) => [...team.starters, ...team.bench])) {
      const current = players.get(player.sourcePlayerId) ?? { player, names: [] }
      current.names.push(player.displayName, player.lastName, ...(player.acceptedNames ?? []))
      players.set(player.sourcePlayerId, current)
    }
  }

  const canonical = new Map()
  for (const [sourcePlayerId, entry] of players) {
    const metadataPlayer = metadata.get(sourcePlayerId)
    const candidates = [
      ...(metadataPlayer?.displayName ? [{ value: metadataPlayer.displayName, source: 'metadata displayName', priority: 0 }] : []),
      ...(metadataPlayer?.name ? [{ value: metadataPlayer.name, source: 'metadata name', priority: 1 }] : []),
      ...(candidateRegistry.get(sourcePlayerId) ?? []).map((candidate) => ({
        ...candidate,
        priority: candidate.source === 'composed CC0 first_name + last_name' ? 2
          : candidate.source === 'CC0 name' ? 3
            : candidate.source === 'match-sheet anchor title' ? 4 : 5,
      })),
      ...entry.names.map((value) => ({ value, source: 'existing snapshot alias', priority: 5 })),
    ]
      .map((candidate) => ({ ...candidate, value: normalizeWhitespace(candidate.value) }))
      .filter((candidate) => candidate.value)

    const override = allowlisted.get(sourcePlayerId)
    let displayName
    if (override) {
      displayName = normalizeWhitespace(override.displayName)
      const artistName = normalizeWhitespace(metadataPlayer?.artistName || override.displayName)
      if (!artistName || normalizeWhitespace(artistName) !== displayName) {
        throw new Error(`Stale lineup mononym allowlist entry ${sourcePlayerId}: ${displayName} does not match metadata artistName.`)
      }
    } else {
      const ranked = candidates.sort((left, right) =>
        nameTokens(right.value).length - nameTokens(left.value).length ||
        codePointLength(right.value) - codePointLength(left.value) ||
        left.priority - right.priority ||
        normalize(left.value).localeCompare(normalize(right.value)),
      )
      displayName = ranked[0]?.value
    }
    if (!displayName) throw new Error(`No display name candidates for lineup player ${sourcePlayerId}.`)
    if (nameTokens(displayName).length < 2 && !override) {
      const details = candidates.map((candidate) => `${candidate.source}: ${candidate.value}`).join('; ')
      throw new Error(`Unresolved one-token lineup player ${sourcePlayerId}: ${details}`)
    }
    canonical.set(sourcePlayerId, {
      displayName,
      lastName: nameTokens(displayName).at(-1) ?? displayName,
      acceptedNames: [...new Set([
        ...(previousNames.get(sourcePlayerId) ?? []),
        ...entry.names,
        ...candidates.map((candidate) => candidate.value),
        displayName,
      ].map(normalizeWhitespace).filter(Boolean))],
    })
  }

  for (const match of matches) {
    for (const team of match.teams) {
      for (const player of [...team.starters, ...team.bench]) {
        const resolved = canonical.get(player.sourcePlayerId)
        player.displayName = resolved.displayName
        player.lastName = resolved.lastName
        player.acceptedNames = resolved.acceptedNames
      }
    }
  }
  return canonical
}

async function main() {
  const players = await loadPlayers()
  const metadata = loadTransfermarktMetadata()
  const previousNames = new Map()
  if (existsSync(output)) {
    const previous = JSON.parse(readFileSync(output, 'utf8'))
    for (const match of previous.matches ?? []) {
      for (const player of match.teams.flatMap((team) => [...team.starters, ...team.bench])) {
        const names = previousNames.get(player.sourcePlayerId) ?? []
        names.push(player.displayName, player.lastName, ...(player.acceptedNames ?? []))
        previousNames.set(player.sourcePlayerId, names)
      }
    }
  }
  const candidateRegistry = new Map()
  const seasonItems = competitions.flatMap((competition) =>
    competition.seasons.map((season) => ({ competition, season })),
  )
  const manifestGroups = await mapConcurrent(seasonItems, 4, async ({ competition, season }) => {
    const path = join(lineupCache, 'seasons', `${competition.transfermarktId}-${season}.html`)
    const html = await fetchCached(seasonUrl(competition, season), path)
    console.log(`Manifest ${competition.id} ${season}`)
    return parseSeasonPage(html, competition, season)
  })
  const manifest = manifestGroups.flat()

  const matches = await mapConcurrent(manifest, 4, async (item, index) => {
    const path = join(lineupCache, 'matches', `${item.sourceMatchId}.html`)
    const html = await fetchCached(matchUrl(item.sourceMatchId), path)
    console.log(`Match ${index + 1}/${manifest.length}: ${item.sourceMatchId}`)
    return parseMatchPage(html, item, players, candidateRegistry)
  })

  await addStarterClues(matches, players)

  matches.sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id))
  const archivePlayerIds = [...new Set(matches.flatMap((match) => match.teams.flatMap((team) => [...team.starters, ...team.bench]).map((player) => player.sourcePlayerId)))]
  if (process.env.LINEUP_REFRESH_METADATA === 'true') {
    await enrichTransfermarktMetadata(metadata, archivePlayerIds)
  }
  await enrichProfileNames(candidateRegistry)
  canonicalizeNames(matches, candidateRegistry, metadata, previousNames)
  const version = rosterVersion(matches)
  const search = new Map()
  for (const match of matches) {
    for (const player of match.teams.flatMap((team) => [...team.starters, ...team.bench])) {
      const existing = search.get(player.id)
      const acceptedNames = [...new Set([...(existing?.acceptedNames ?? []), ...player.acceptedNames, player.displayName].filter(Boolean))]
      const displayName = player.displayName
      search.set(player.id, {
        id: player.id,
        displayName,
        acceptedNames,
        lastName: player.lastName.length > (existing?.lastName.length ?? 0)
          ? player.lastName
          : existing?.lastName ?? player.lastName,
      })
    }
  }
  const searchPlayers = [...search.values()].sort((left, right) =>
    normalize(left.displayName).localeCompare(normalize(right.displayName)),
  )

  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, `${JSON.stringify({ version, generatedAt: VERIFIED_DATE, matches }, null, 2)}\n`)
  writeFileSync(searchOutput, `${JSON.stringify(searchPlayers, null, 2)}\n`)
  const activeMatches = matches.filter((match) => match.seasonStart >= activeFirstSeason && match.seasonStart <= activeLastSeason)
  const activePoolRows = activeMatches.map((match, index) => {
    const starterIds = match.teams.flatMap((team) => team.starters.map((player) => player.id)).map((playerId) => `'${playerId}'`).join(',')
    return `  ('${match.id}', '${version}', ${index + 1}, array[${starterIds}]::text[], true)`
  })
  writeFileSync(poolOutput, `begin;\nupdate public.lineup_daily_pool set active = false where active;\n\ninsert into public.lineup_daily_pool (match_id, roster_version, ranking, starter_ids, active)\nvalues\n${activePoolRows.join(',\n')}\non conflict (match_id) do update set\n  roster_version = excluded.roster_version,\n  ranking = excluded.ranking,\n  starter_ids = excluded.starter_ids,\n  active = excluded.active;\ncommit;\n`)
  console.log(`Wrote ${matches.length} archive matches, ${activeMatches.length} active matches, ${searchPlayers.length} searchable players, roster ${version}.`)
}

await main()
