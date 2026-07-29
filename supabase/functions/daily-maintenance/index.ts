import {
  createAdminClient,
  getOrCreateChallenge,
  json,
  rankResults,
  utcDateKey,
  type StoredResult,
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

    const challenges = await client
      .from('daily_challenges')
      .select('challenge_date')
      .lt('challenge_date', today)
      .order('challenge_date')
    if (challenges.error) throw challenges.error

    const archives = await client.from('daily_archives').select('challenge_date')
    if (archives.error) throw archives.error
    const archived = new Set((archives.data ?? []).map((row) => row.challenge_date as string))
    const pending = (challenges.data ?? [])
      .map((row) => row.challenge_date as string)
      .filter((date) => !archived.has(date))

    const created: Array<{ date: string; rows: number; path: string }> = []
    for (const date of pending) {
      const results = await client
        .from('daily_results')
        .select(
          'participant_hash,nickname,points,outcome,clues_used,incorrect_guesses,submitted_at',
        )
        .eq('challenge_date', date)
        .order('points', { ascending: false })
        .order('submitted_at', { ascending: true })
      if (results.error) throw results.error
      const rows = (results.data ?? []) as StoredResult[]
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

    return json(request, {
      ok: true,
      currentChallenge: today,
      archivesCreated: created,
    })
  } catch (error) {
    console.error(error)
    return json(request, { error: 'Daily maintenance failed.' }, 500)
  }
})
