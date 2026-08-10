import { readFileSync } from 'node:fs'

const migration = readFileSync(
  'supabase/migrations/202608100001_daily_answer_cooldown.sql',
  'utf8',
)
const dailyFunction = readFileSync('supabase/functions/_shared/daily.ts', 'utf8')
const playerPoolMigration = readFileSync(
  'supabase/migrations/202607310002_daily_player_pool.sql',
  'utf8',
)

for (const unsafe of [/\bdrop\b/i, /\btruncate\b/i, /\bdelete\s+from\b/i]) {
  if (unsafe.test(migration)) throw new Error(`Cooldown migration contains unsafe SQL: ${unsafe}`)
}

for (const required of [
  'daily_answer_source_id',
  'reserve_daily_challenge',
  'reserve_lineup_daily_challenge',
  "pg_advisory_xact_lock(hashtextextended('leo-guessi-daily-answer-cooldown', 0))",
  'p_challenge_date - 30',
]) {
  if (!migration.includes(required)) throw new Error(`Cooldown migration is missing: ${required}`)
}

if ((migration.match(/pg_advisory_xact_lock/g) ?? []).length !== 2) {
  throw new Error('Both daily reservation functions must take the shared advisory lock.')
}
if ((dailyFunction.match(/\.rpc\('reserve_(?:lineup_)?daily_challenge'/g) ?? []).length !== 2) {
  throw new Error('Both daily modes must use their database reservation function.')
}

const activePlayerIds = [...playerPoolMigration.matchAll(/\('([^']+-\d+)',\s*'[^']+',\s*\d+,\s*true\)/g)]
  .map((match) => match[1])
if (activePlayerIds.length !== 250 || activePlayerIds.some((playerId) => !/-\d+$/.test(playerId))) {
  throw new Error('Every active Player of the Day ID must expose its numeric source-player suffix.')
}

console.log('Checked shared 30-day daily-answer cooldown, cross-mode identity matching, and non-destructive SQL.')
