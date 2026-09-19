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
import {
  buildChallengeLeaderboardBoards,
  buildDailyLeaderboardBoards,
  calculateDailyScore,
  findTodayNicknameResult,
  isValidDailyNickname,
  normalizeLeaderboardNickname,
  type HistoricalResult,
} from '../_shared/rules.ts'

function publicLeaderboard(results: StoredResult[]) {
  return rankResults(results).map((result) => ({
    rank: result.rank,
    nickname: result.nickname,
    points: result.points,
    submittedAt: result.submitted_at,
  }))
}

const DAILY_FIELDS =
  'challenge_date,participant_hash,nickname,normalized_nickname,points,outcome,clues_used,incorrect_guesses,submitted_at'

async function getDailyResults(
  client: ReturnType<typeof createAdminClient>,
  date?: string,
) {
  const rows: StoredResult[] = []
  const pageSize = 1_000
  for (let from = 0; ; from += pageSize) {
    let query = client
      .from('daily_results')
      .select(DAILY_FIELDS)
      .order('submitted_at', { ascending: true })
    if (date) query = query.eq('challenge_date', date)
    const result = await query.range(from, from + pageSize - 1)
    if (result.error) throw result.error
    const page = (result.data ?? []) as StoredResult[]
    rows.push(...page)
    if (page.length < pageSize) return rows
  }
}

async function getChallengeResults(
  client: ReturnType<typeof createAdminClient>,
  pool: 'normal' | 'hardcore',
) {
  const rows: HistoricalResult[] = []
  const pageSize = 1_000
  for (let from = 0; ; from += pageSize) {
    const result = await client
      .from('challenge_results')
      .select('challenge_date,nickname,normalized_nickname,points,submitted_at')
      .eq('pool', pool)
      .order('submitted_at', { ascending: true })
      .range(from, from + pageSize - 1)
    if (result.error) throw result.error
    const page = (result.data ?? []) as HistoricalResult[]
    rows.push(...page)
    if (page.length < pageSize) return rows
  }
}

function isPool(value: unknown): value is 'normal' | 'hardcore' {
  return value === 'normal' || value === 'hardcore'
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
      const allResults = await getDailyResults(client)
      return json(request, {
        date: today,
        leaderboard: publicLeaderboard(allResults.filter((row) => row.challenge_date === today)),
        boards: buildDailyLeaderboardBoards(allResults, today),
      })
    }

    if (request.method === 'GET' && action === 'challenge-leaderboard') {
      const pool = url.searchParams.get('pool')
      if (!isPool(pool)) return json(request, { error: 'A valid player pool is required.' }, 400)
      return json(request, {
        date: today,
        pool,
        boards: buildChallengeLeaderboardBoards(await getChallengeResults(client, pool), today),
      })
    }

    if (request.method === 'POST' && action === 'leaderboard-hub') {
      const body = await request.json().catch(() => null) as Record<string, unknown> | null
      if (!body || !isValidDailyNickname(body.nickname)) {
        return json(request, { error: 'Use a nickname between 1 and 24 characters.' }, 400)
      }

      const todayResults = await getDailyResults(client, today)
      const ownResult = findTodayNicknameResult(todayResults, today, body.nickname)
      if (!ownResult) return json(request, { eligible: false, date: today })

      const [allDailyResults, normalResults, hardcoreResults] = await Promise.all([
        getDailyResults(client),
        getChallengeResults(client, 'normal'),
        getChallengeResults(client, 'hardcore'),
      ])
      return json(request, {
        eligible: true,
        date: today,
        nickname: ownResult.nickname,
        dailyBoards: buildDailyLeaderboardBoards(allDailyResults, today),
        challengeBoards: {
          normal: buildChallengeLeaderboardBoards(normalResults, today),
          hardcore: buildChallengeLeaderboardBoards(hardcoreResults, today),
        },
      })
    }

    if (request.method === 'POST' && (action === 'result' || action === 'expire-result')) {
      const body = await request.json().catch(() => null) as Record<string, unknown> | null
      const challengeDate = String(body?.challengeDate ?? '')
      const expiring = action === 'expire-result'
      if (!body || (!expiring && challengeDate !== today) || (expiring && (challengeDate >= today || body.outcome !== 'gave-up'))) {
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

      const participantHash = await verifyAttemptToken(challengeDate, String(body.attemptToken ?? ''))
      if (!participantHash) {
        return json(request, { error: 'The daily attempt token is invalid.' }, 401)
      }

      await getOrCreateChallenge(client, challengeDate)
      const cluesUsed = Number(body.cluesUsed)
      const incorrectGuesses = Number(body.incorrectGuesses)
      const points = calculateDailyScore(body.outcome, cluesUsed, incorrectGuesses)
      const inserted = await client.rpc('submit_locked_daily_result', {
        p_challenge_date: challengeDate,
        p_participant_hash: participantHash,
        p_nickname: body.nickname.trim(),
        p_points: points,
        p_outcome: body.outcome,
        p_clues_used: cluesUsed,
        p_incorrect_guesses: incorrectGuesses,
      })
      if (inserted.error) throw inserted.error
      if (inserted.data === 'nickname-used') {
        return json(request, { error: 'That nickname has already submitted today.' }, 409)
      }
      if (inserted.data === 'participant-used') {
        if (expiring) return json(request, { expired: true })
        return json(request, { error: 'This browser has already submitted today.' }, 409)
      }

      if (expiring) return json(request, { expired: true })

      const allResults = await getDailyResults(client)
      const todayResults = allResults.filter((row) => row.challenge_date === challengeDate)
      const ranked = rankResults(todayResults)
      const ownResult = ranked.find((result) => result.participant_hash === participantHash)
      if (!ownResult) throw new Error('The saved daily result could not be read back.')

      return json(request, {
        date: challengeDate,
        points: ownResult.points,
        rank: ownResult.rank,
        leaderboard: publicLeaderboard(todayResults),
        boards: buildDailyLeaderboardBoards(allResults, today),
      })
    }

    if (request.method === 'POST' && action === 'challenge-result') {
      const body = await request.json().catch(() => null) as Record<string, unknown> | null
      if (!body || !isPool(body.pool) || !isValidDailyNickname(body.nickname)) {
        return json(request, { error: 'A valid nickname and player pool are required.' }, 400)
      }
      if (!Array.isArray(body.rounds) || body.rounds.length !== 10) {
        return json(request, { error: 'A completed 10-round game is required.' }, 400)
      }
      const rounds = body.rounds as Array<Record<string, unknown>>
      const invalid = rounds.some(
        (round) =>
          (round.outcome !== 'correct' && round.outcome !== 'gave-up') ||
          !Number.isInteger(round.cluesUsed) ||
          Number(round.cluesUsed) < 1 ||
          Number(round.cluesUsed) > 5 ||
          !Number.isInteger(round.incorrectGuesses) ||
          Number(round.incorrectGuesses) < 0 ||
          Number(round.incorrectGuesses) > 50,
      )
      if (invalid) return json(request, { error: 'One or more rounds are invalid.' }, 400)

      const publicRounds = rounds.map((round) => ({
        outcome: round.outcome,
        cluesUsed: Number(round.cluesUsed),
        incorrectGuesses: Number(round.incorrectGuesses),
      }))
      const points = publicRounds.reduce(
        (sum, round) =>
          sum + calculateDailyScore(round.outcome as 'correct' | 'gave-up', round.cluesUsed, round.incorrectGuesses),
        0,
      )
      const inserted = await client.from('challenge_results').insert({
        challenge_date: today,
        pool: body.pool,
        nickname: body.nickname.trim(),
        normalized_nickname: normalizeLeaderboardNickname(body.nickname),
        points,
        rounds: publicRounds,
      })
      if (inserted.error) throw inserted.error
      return json(request, {
        date: today,
        pool: body.pool,
        points,
        boards: buildChallengeLeaderboardBoards(
          await getChallengeResults(client, body.pool),
          today,
        ),
      })
    }

    return json(request, { error: 'Unknown daily-game action.' }, 404)
  } catch (error) {
    console.error(error)
    return json(request, { error: 'The game service is temporarily unavailable.' }, 500)
  }
})
