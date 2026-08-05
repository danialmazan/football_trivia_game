import {
  createAdminClient,
  getOrCreateChallenge,
  getOrCreateLineupChallenge,
  json,
  rankResults,
  utcDateKey,
  type StoredResult,
  type StoredLineupResult,
} from '../_shared/daily.ts'

function csvCell(value: unknown): string {
  const text = String(value ?? '')
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function createCsv(date: string, rows: StoredResult[]): string {
  const header =
    'date,rank,nickname,points,outcome,clues_used,incorrect_guesses,submitted_at'
  const body = rankResults(rows).map((row) =>
    [
      date,
      row.rank,
      row.nickname,
      row.points,
      row.outcome,
      row.clues_used,
      row.incorrect_guesses,
      row.submitted_at,
    ]
      .map(csvCell)
      .join(','),
  )
  return `${[header, ...body].join('\n')}\n`
}

function createLineupCsv(date: string, rows: StoredLineupResult[]): string {
  const header = 'date,rank,nickname,points,outcome,clues_used,clue_incorrect_guess_counts,incorrect_guesses,submitted_at'
  const body = rankResults(rows).map((row) =>
    [date, row.rank, row.nickname, row.points, row.outcome, row.clues_used, JSON.stringify(row.clue_incorrect_guess_counts), row.incorrect_guesses, row.submitted_at]
      .map(csvCell)
      .join(','),
  )
  return `${[header, ...body].join('\n')}\n`
}

const PAGE_SIZE = 1_000

async function getPendingChallengeDates(
  client: ReturnType<typeof createAdminClient>,
  today: string,
): Promise<string[]> {
  const challengeDates: string[] = []
  const archivedDates = new Set<string>()
  for (let from = 0; ; from += PAGE_SIZE) {
    const result = await client
      .from('daily_challenges')
      .select('challenge_date')
      .lt('challenge_date', today)
      .order('challenge_date')
      .range(from, from + PAGE_SIZE - 1)
    if (result.error) throw result.error
    const page = result.data ?? []
    challengeDates.push(...page.map((row) => row.challenge_date as string))
    if (page.length < PAGE_SIZE) break
  }
  for (let from = 0; ; from += PAGE_SIZE) {
    const result = await client
      .from('daily_archives')
      .select('challenge_date')
      .order('challenge_date')
      .range(from, from + PAGE_SIZE - 1)
    if (result.error) throw result.error
    const page = result.data ?? []
    page.forEach((row) => archivedDates.add(row.challenge_date as string))
    if (page.length < PAGE_SIZE) break
  }
  return challengeDates.filter((date) => !archivedDates.has(date))
}

async function getResultsForDate(
  client: ReturnType<typeof createAdminClient>,
  date: string,
): Promise<StoredResult[]> {
  const rows: StoredResult[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const result = await client
      .from('daily_results')
      .select(
        'challenge_date,participant_hash,nickname,normalized_nickname,points,outcome,clues_used,incorrect_guesses,submitted_at',
      )
      .eq('challenge_date', date)
      .order('points', { ascending: false })
      .order('submitted_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (result.error) throw result.error
    const page = (result.data ?? []) as StoredResult[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}

async function getPendingLineupDates(
  client: ReturnType<typeof createAdminClient>,
  today: string,
): Promise<string[]> {
  const challengeDates: string[] = []
  const archivedDates = new Set<string>()
  for (let from = 0; ; from += PAGE_SIZE) {
    const result = await client.from('lineup_daily_challenges').select('challenge_date')
      .lt('challenge_date', today).order('challenge_date').range(from, from + PAGE_SIZE - 1)
    if (result.error) throw result.error
    const page = result.data ?? []
    challengeDates.push(...page.map((row) => row.challenge_date as string))
    if (page.length < PAGE_SIZE) break
  }
  for (let from = 0; ; from += PAGE_SIZE) {
    const result = await client.from('lineup_daily_archives').select('challenge_date')
      .order('challenge_date').range(from, from + PAGE_SIZE - 1)
    if (result.error) throw result.error
    const page = result.data ?? []
    page.forEach((row) => archivedDates.add(row.challenge_date as string))
    if (page.length < PAGE_SIZE) break
  }
  return challengeDates.filter((date) => !archivedDates.has(date))
}

async function getLineupResultsForDate(
  client: ReturnType<typeof createAdminClient>,
  date: string,
): Promise<StoredLineupResult[]> {
  const rows: StoredLineupResult[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const result = await client.from('lineup_daily_results')
      .select('challenge_date,participant_hash,nickname,normalized_nickname,points,outcome,clues_used,clue_incorrect_guess_counts,incorrect_guesses,submitted_at')
      .eq('challenge_date', date).order('points', { ascending: false })
      .order('submitted_at', { ascending: true }).range(from, from + PAGE_SIZE - 1)
    if (result.error) throw result.error
    const page = (result.data ?? []) as StoredLineupResult[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}

Deno.serve(async (request) => {
  const maintenanceSecret = Deno.env.get('DAILY_MAINTENANCE_SECRET')
  if (
    !maintenanceSecret ||
    request.headers.get('x-maintenance-secret') !== maintenanceSecret
  ) {
    return json(request, { error: 'Unauthorized.' }, 401)
  }

  try {
    const client = createAdminClient()
    const today = utcDateKey()
    await getOrCreateChallenge(client, today)
    await getOrCreateLineupChallenge(client, today)

    const pending = await getPendingChallengeDates(client, today)

    const created: Array<{ date: string; rows: number; path: string }> = []
    for (const date of pending) {
      const rows = await getResultsForDate(client, date)
      const objectPath = `daily-leaderboards/${date}.csv`
      const upload = await client.storage
        .from('daily-leaderboard-archives')
        .upload(objectPath, createCsv(date, rows), {
          contentType: 'text/csv; charset=utf-8',
          upsert: false,
        })
      if (
        upload.error &&
        upload.error.message !== 'The resource already exists' &&
        upload.error.message !== 'Duplicate'
      ) {
        throw upload.error
      }
      const archive = await client.from('daily_archives').insert({
        challenge_date: date,
        object_path: objectPath,
        row_count: rows.length,
      })
      if (archive.error && archive.error.code !== '23505') throw archive.error
      created.push({ date, rows: rows.length, path: objectPath })
    }

    const lineupPending = await getPendingLineupDates(client, today)
    const lineupCreated: Array<{ date: string; rows: number; path: string }> = []
    for (const date of lineupPending) {
      const rows = await getLineupResultsForDate(client, date)
      const objectPath = `lineup-daily-leaderboards/${date}.csv`
      const upload = await client.storage.from('daily-leaderboard-archives')
        .upload(objectPath, createLineupCsv(date, rows), {
          contentType: 'text/csv; charset=utf-8', upsert: false,
        })
      if (upload.error && upload.error.message !== 'The resource already exists' && upload.error.message !== 'Duplicate') {
        throw upload.error
      }
      const archive = await client.from('lineup_daily_archives').insert({
        challenge_date: date, object_path: objectPath, row_count: rows.length,
      })
      if (archive.error && archive.error.code !== '23505') throw archive.error
      lineupCreated.push({ date, rows: rows.length, path: objectPath })
    }

    return json(request, {
      ok: true,
      currentChallenge: today,
      archivesCreated: created,
      lineupArchivesCreated: lineupCreated,
    })
  } catch (error) {
    console.error(error)
    return json(request, { error: 'Daily maintenance failed.' }, 500)
  }
})
