import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const cachePath = join(root, '.cache', 'football', 'lineups', 'generated-lineup-daily-pool.sql')
const releasePath = join(root, 'supabase', 'migrations', '202608090001_lineup_pool_2005.sql')
const sql = readFileSync(releasePath, 'utf8')
const cachedSql = readFileSync(cachePath, 'utf8')

if (sql !== cachedSql) throw new Error('Release lineup migration differs from the generated cache.')
if (/\b(?:delete|truncate|drop)\b/i.test(sql)) throw new Error('Lineup migration contains a destructive SQL keyword.')

const rows = [...sql.matchAll(/\('([^']+)',\s*'([^']+)',\s*(\d+),\s*array\[/g)]
if (rows.length !== 136) throw new Error(`Expected 136 active lineup rows, found ${rows.length}.`)

const rosterVersions = new Set(rows.map((row) => row[2]))
if (rosterVersions.size !== 1) throw new Error('Generated lineup migration contains mixed roster versions.')

const rankings = rows.map((row) => Number(row[3]))
if (JSON.stringify(rankings) !== JSON.stringify(Array.from({ length: 136 }, (_, index) => index + 1))) {
  throw new Error('Active lineup rankings are not contiguous from 1 to 136.')
}

console.log(`Checked ${rows.length} active lineup rows, one roster version, and no destructive SQL.`)
