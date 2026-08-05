import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
  process.env.LINEUP_DAILY_POOL_SQL ?? join(root, 'supabase', 'migrations', '202608050002_lineup_daily_pool.sql')

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
    })
  }
  return players
}

function seasonUrl(competition, season) {
  return `https://www.transfermarkt.com/${competition.slug}/gesamtspielplan/pokalwettbewerb/${competition.transfermarktId}/saison_id/${season}`
}

function matchUrl(matchId) {
  return `https://www.transfermarkt.com/spielbericht/index/spielbericht/${matchId}`
}

async function fetchCached(url, path) {
  if (existsSync(path)) return readFileSync(path, 'utf8')
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await fetch(url, {
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
    if (attempt === 5) throw new Error(`Could not fetch ${url}: ${response.status}`)
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

function playerFromAnchor(fragment, players) {
  const anchor = fragment.match(/<a(?: title="([^"]+)")? href="[^"]*\/profil\/spieler\/(\d+)">([^<]+)<\/a>/)
  if (!anchor) return null
  const playerId = anchor[2]
  const source = players.get(playerId)
  const displayName = source?.displayName || decodeHtml(anchor[1] || anchor[3])
  const shortName = decodeHtml(anchor[3])
  return {
    id: `tm-player-${playerId}`,
    sourcePlayerId: playerId,
    displayName,
    acceptedNames: [...new Set([shortName, source?.lastName].filter(Boolean))],
    lastName: source?.lastName || displayName.split(/\s+/).at(-1) || displayName,
  }
}

function parseTeam(section, players) {
  const header = section.match(/aufstellung-unterueberschrift-mannschaft[\s\S]*?class="sb-vereinslink"[^>]*href="[^"]*\/verein\/(\d+)[^"]*"[^>]*>([^<]+)<\/a>/)
  const formation = section.match(/Starting Line-up:\s*([^<\r\n]+)/)?.[1]?.trim()
  if (!header || !formation) return null
  const starterArea = section.split('aufstellung-ersatzbank-box')[0]
  const containerStarts = [...starterArea.matchAll(/<div class="formation-player-container" style="top: ([\d.]+)%; left: ([\d.]+)%;">/g)]
  const starters = containerStarts.map((container, index) => {
    const start = container.index ?? 0
    const end = containerStarts[index + 1]?.index ?? starterArea.length
    const fragment = starterArea.slice(start, end)
    const player = playerFromAnchor(fragment, players)
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
    const player = playerFromAnchor(row[1], players)
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

function parseMatchPage(html, manifest, players) {
  const lineupStart = html.indexOf('>Line-Ups')
  const lineupHtml = lineupStart >= 0 ? html.slice(lineupStart) : html
  const teamStarts = [...lineupHtml.matchAll(/<div class="unterueberschrift aufstellung-unterueberschrift-mannschaft/g)]
  const sections = teamStarts.slice(0, 2).map((entry, index) => {
    const start = entry.index ?? 0
    const end = teamStarts[index + 1]?.index ?? lineupHtml.length
    return lineupHtml.slice(start, end)
  })
  const teams = sections.map((section) => parseTeam(section, players))
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

async function main() {
  const players = await loadPlayers()
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
    return parseMatchPage(html, item, players)
  })

  matches.sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id))
  const version = rosterVersion(matches)
  const search = new Map()
  for (const match of matches) {
    for (const player of match.teams.flatMap((team) => [...team.starters, ...team.bench])) {
      const existing = search.get(player.id)
      if (!existing || player.acceptedNames.length > existing.acceptedNames.length) {
        search.set(player.id, {
          id: player.id,
          displayName: player.displayName,
          acceptedNames: player.acceptedNames,
          lastName: player.lastName,
        })
      }
    }
  }
  const searchPlayers = [...search.values()].sort((left, right) =>
    normalize(left.displayName).localeCompare(normalize(right.displayName)),
  )

  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, `${JSON.stringify({ version, generatedAt: VERIFIED_DATE, matches }, null, 2)}\n`)
  writeFileSync(searchOutput, `${JSON.stringify(searchPlayers, null, 2)}\n`)
  const poolRows = matches.map((match, index) => {
    const starterIds = match.teams
      .flatMap((team) => team.starters.map((player) => player.id))
      .map((playerId) => `'${playerId}'`)
      .join(',')
    return `  ('${match.id}', '${version}', ${index + 1}, array[${starterIds}]::text[], true)`
  })
  writeFileSync(
    poolOutput,
    `insert into public.lineup_daily_pool (match_id, roster_version, ranking, starter_ids, active)\nvalues\n${poolRows.join(',\n')}\non conflict (match_id) do update set\n  roster_version = excluded.roster_version,\n  ranking = excluded.ranking,\n  starter_ids = excluded.starter_ids,\n  active = excluded.active;\n`,
  )
  console.log(`Wrote ${matches.length} matches, ${searchPlayers.length} searchable players, roster ${version}.`)
}

await main()
