import {
  consumeRateLimit,
  createAdminClient,
  createAttemptToken,
  getOrCreateChallenge,
  isOriginAllowed,
  json,
  nextUtcMidnight,
  rankResults,
  utcDateKey,
  verifyAttemptToken,
  type StoredResult,
} from '../_shared/daily.ts'
import { calculateDailyScore, isValidDailyNickname } from '../_shared/rules.ts'

function publicLeaderboard(results: StoredResult[]) {
  return rankResults(results).map((result) => ({
    rank: result.rank,
    nickname: result.nickname,
    points: result.points,
    submittedAt: result.submitted_at,
  }))
}

async function getResults(client: ReturnType<typeof createAdminClient>, date: string) {
  const result = await client
    .from('daily_results')
    .select(
      'participant_hash,nickname,points,outcome,clues_used,incorrect_guesses,submitted_at',
    )
    .eq('challenge_date', date)
    .order('points', { ascending: false })
    .order('submitted_at', { ascending: true })
  if (result.error) throw result.error
  return (result.data ?? []) as StoredResult[]
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return json(request, { ok: true })
  if (!isOriginAllowed(request)) return json(request, { error: 'Origin is not allowed.' }, 403)

  try {
    const client = createAdminClient()
    if (!(await consumeRateLimit(client, request))) {
      return json(request, { error: 'Too many requests. Please wait a minute.' }, 429)
    }

    const url = new URL(request.url)
    const action = url.searchParams.get('action')
    const today = utcDateKey()

    if (request.method === 'GET' && action === 'challenge') {
      const installationId = url.searchParams.get('installationId') ?? ''
      if (installationId.length < 8 || installationId.length > 128) {
        return json(request, { error: 'A valid browser installation ID is required.' }, 400)
      }
      const challenge = await getOrCreateChallenge(client, today)
      const attemptToken = await createAttemptToken(today, installationId)
      return json(request, {
        date: challenge.challenge_date,
        expiresAt: nextUtcMidnight(),
        playerId: challenge.player_id,
        clueSeed: challenge.clue_seed,
        rosterVersion: challenge.roster_version,
        attemptToken,
      })
    }

    if (request.method === 'GET' && action === 'leaderboard') {
      await getOrCreateChallenge(client, today)
      return json(request, {
        date: today,
        leaderboard: publicLeaderboard(await getResults(client, today)),
      })
    }

    if (request.method === 'POST' && action === 'result') {
      const body = await request.json().catch(() => null) as Record<string, unknown> | null
      if (!body || body.challengeDate !== today) {
        return json(request, { error: 'This daily challenge has expired.' }, 409)
      }
      if (!isValidDailyNickname(body.nickname)) {
        return json(request, { error: 'Use a nickname between 1 and 24 characters.' }, 400)
      }
      if (
        (body.outcome !== 'correct' && body.outcome !== 'gave-up') ||
        !Number.isInteger(body.cluesUsed) ||
        Number(body.cluesUsed) < 1 ||
        Number(body.cluesUsed) > 5 ||
        !Number.isInteger(body.incorrectGuesses) ||
        Number(body.incorrectGuesses) < 0 ||
        Number(body.incorrectGuesses) > 50
      ) {
        return json(request, { error: 'The submitted round statistics are invalid.' }, 400)
      }

      const participantHash = await verifyAttemptToken(
        today,
        String(body.attemptToken ?? ''),
      )
      if (!participantHash) {
        return json(request, { error: 'The daily attempt token is invalid.' }, 401)
      }

      await getOrCreateChallenge(client, today)
      const cluesUsed = Number(body.cluesUsed)
      const incorrectGuesses = Number(body.incorrectGuesses)
      const points = calculateDailyScore(body.outcome, cluesUsed, incorrectGuesses)
      const inserted = await client.from('daily_results').insert({
        challenge_date: today,
        participant_hash: participantHash,
        nickname: body.nickname.trim(),
        points,
        outcome: body.outcome,
        clues_used: cluesUsed,
        incorrect_guesses: incorrectGuesses,
      })
      if (inserted.error && inserted.error.code !== '23505') throw inserted.error

      const results = await getResults(client, today)
      const ranked = rankResults(results)
      const ownResult = ranked.find((result) => result.participant_hash === participantHash)
      if (!ownResult) throw new Error('The saved daily result could not be read back.')

      return json(request, {
        date: today,
        points: ownResult.points,
        rank: ownResult.rank,
        leaderboard: publicLeaderboard(results),
      })
    }

    return json(request, { error: 'Unknown daily-game action.' }, 404)
  } catch (error) {
    console.error(error)
    return json(request, { error: 'The daily game service is temporarily unavailable.' }, 500)
  }
})
