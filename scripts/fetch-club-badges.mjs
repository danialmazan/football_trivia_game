import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const playersPath = join(root, 'src', 'data', 'players.json')
const teamDetailsPath =
  process.env.FOOTBALL_TEAM_DETAILS_CSV ??
  join(process.env.FOOTBALL_DATA_CACHE ?? join(root, '.cache', 'football'), 'raw', 'team_details.csv')
const outputDir = join(root, 'public', 'club-badges')
const badgeOverrides = new Map([
  [
    '236',
    'https://upload.wikimedia.org/wikipedia/commons/c/cd/CD_Logro%C3%B1%C3%A9s.png',
  ],
])

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
      } else quoted = !quoted
    } else if (character === ',' && !quoted) {
      values.push(value)
      value = ''
    } else value += character
  }
  values.push(value)
  return values
}

const players = JSON.parse(readFileSync(playersPath, 'utf8'))
const requiredIds = new Set(players.flatMap((player) => player.clubs.map((club) => club.clubId)))
const lines = readFileSync(teamDetailsPath, 'utf8').trim().split(/\r?\n/)
const headers = parseCsvLine(lines.shift())
const badges = new Map()
for (const line of lines) {
  const values = parseCsvLine(line)
  const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
  if (requiredIds.has(row.club_id) && row.logo_url) badges.set(row.club_id, row.logo_url)
}
for (const [clubId, url] of badgeOverrides) {
  if (requiredIds.has(clubId)) badges.set(clubId, url)
}

mkdirSync(outputDir, { recursive: true })
let completed = 0
for (const [clubId, url] of badges) {
  const outputPath = join(outputDir, `${clubId}.png`)
  if (!existsSync(outputPath)) {
    const response = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } })
    if (!response.ok) throw new Error(`Badge download failed for ${clubId}: ${response.status}`)
    writeFileSync(outputPath, Buffer.from(await response.arrayBuffer()))
  }
  completed += 1
}
console.log(`Bundled ${completed}/${requiredIds.size} club badges`)
if (completed !== requiredIds.size) {
  throw new Error(`Missing ${requiredIds.size - completed} required club badges`)
}
