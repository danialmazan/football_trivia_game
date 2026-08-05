import {
  consumeRateLimit,
  createAdminClient,
  createLineupAttemptToken,
  getOrCreateLineupChallenge,
  isOriginAllowed,
  json,
  nextUtcMidnight,
  rankResults,
  utcDateKey,
  verifyLineupAttemptToken,
  type StoredLineupResult,
} from '../_shared/daily.ts'
import {
  buildChallengeLeaderboardBoards,
  buildDailyLeaderboardBoards,
  calculateLineupScore,
  findTodayNicknameResult,
  isValidDailyNickname,
  normalizeLeaderboardNickname,
  type HistoricalResult,
} from '../_shared/rules.ts'

const DAILY_FIELDS =
  'challenge_date,participant_hash,nickname,normalized_nickname,points,outcome,incorrect_guesses,submitted_at'

async function getDailyResults(
  client: ReturnType<typeof createAdminClient>,
  date?: string,
): Promise<StoredLineupResult[]> {
  const rows: StoredLineupResult[] = []
  for (let from = 0; ; from += 1_000) {
    let query = client
      .from('lineup_daily_results')
      .select(DAILY_FIELDS)
      .order('submitted_at', { ascending: true })
    if (date) query = query.eq('challenge_date', date)
    const result = await query.range(from, from + 999)
    if (result.error) throw result.error
    const page = (result.data ?? []) as StoredLineupResult[]
    rows.push(...page)
    if (page.length < 1_000) return rows
  }
}

async function getChallengeResults(
  client: ReturnType<typeof createAdminClient>,
): Promise<HistoricalResult[]> {
  const rows: HistoricalResult[] = []
  for (let from = 0; ; from += 1_000) {
    const result = await client
      .from('lineup_challenge_results')
      .select('challenge_date,nickname,normalized_nickname,points,submitted_at')
      .order('submitted_at', { ascending: true })
      .range(from, from + 999)
    if (result.error) throw result.error
    const page = (result.data ?? []) as HistoricalResult[]
    rows.push(...page)
    if (page.length < 1_000) return rows
  }
}

function publicLeaderboard(results: StoredLineupResult[]) {
  return rankResults(results).map((result) => ({
    rank: result.rank,
    nickname: result.nickname,
    points: result.points,
    submittedAt: result.submitted_at,
  }))
}

function validRound(round: Record<string, unknown>): boolean {
  return (
    (round.outcome === 'correct' || round.outcome === 'gave-up') &&
    Number.isInteger(round.incorrectGuesses) &&
    Number(round.incorrectGuesses) >= 0 &&
    Number(round.incorrectGuesses) <= 50
  )
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
      const challenge = await getOrCreateLineupChallenge(client, today)
      return json(request, {
        date: challenge.challenge_date,
        expiresAt: nextUtcMidnight(),
        matchId: challenge.match_id,
        missingPlayerId: challenge.missing_player_id,
        rosterVersion: challenge.roster_version,
        attemptToken: await createLineupAttemptToken(today, installationId),
      })
    }

    if (request.method === 'GET' && action === 'leaderboard') {
      await getOrCreateLineupChallenge(client, today)
      const allResults = await getDailyResults(client)
      const todayResults = allResults.filter((row) => row.challenge_date === today)
      return json(request, {
        date: today,
        leaderboard: publicLeaderboard(todayResults),
        boards: buildDailyLeaderboardBoards(allResults, today),
      })
    }

    if (request.method === 'GET' && action === 'challenge-leaderboard') {
      return json(request, {
        date: today,
        boards: buildChallengeLeaderboardBoards(await getChallengeResults(client), today),
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

      const [allDailyResults, challengeResults] = await Promise.all([
        getDailyResults(client),
        getChallengeResults(client),
      ])
      return json(request, {
        eligible: true,
        date: today,
        nickname: ownResult.nickname,
        dailyBoards: buildDailyLeaderboardBoards(allDailyResults, today),
        challengeBoards: buildChallengeLeaderboardBoards(challengeResults, today),
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
      const candidate = {
        outcome: body.outcome,
        incorrectGuesses: body.incorrectGuesses,
      }
      if (!validRound(candidate)) {
        return json(request, { error: 'The submitted round statistics are invalid.' }, 400)
      }
      const participantHash = await verifyLineupAttemptToken(today, String(body.attemptToken ?? ''))
      if (!participantHash) return json(request, { error: 'The daily attempt token is invalid.' }, 401)

      await getOrCreateLineupChallenge(client, today)
      const incorrectGuesses = Number(body.incorrectGuesses)
      const points = calculateLineupScore(body.outcome as 'correct' | 'gave-up', incorrectGuesses)
      const inserted = await client.rpc('submit_locked_lineup_daily_result', {
        p_challenge_date: today,
        p_participant_hash: participantHash,
        p_nickname: body.nickname.trim(),
        p_points: points,
        p_outcome: body.outcome,
        p_incorrect_guesses: incorrectGuesses,
      })
      if (inserted.error) throw inserted.error
      if (inserted.data === 'nickname-used') {
        return json(request, { error: 'That nickname has already submitted today.' }, 409)
      }
      if (inserted.data === 'participant-used') {
        return json(request, { error: 'This browser has already submitted today.' }, 409)
      }

      const allResults = await getDailyResults(client)
      const todayResults = allResults.filter((row) => row.challenge_date === today)
      const ownResult = rankResults(todayResults).find((row) => row.participant_hash === participantHash)
      if (!ownResult) throw new Error('The saved lineup result could not be read back.')
      return json(request, {
        date: today,
        points: ownResult.points,
        rank: ownResult.rank,
        leaderboard: publicLeaderboard(todayResults),
        boards: buildDailyLeaderboardBoards(allResults, today),
      })
    }

    if (request.method === 'POST' && action === 'challenge-result') {
      const body = await request.json().catch(() => null) as Record<string, unknown> | null
      if (!body || !isValidDailyNickname(body.nickname) || !Array.isArray(body.rounds) || body.rounds.length !== 10) {
        return json(request, { error: 'A nickname and completed 10-round lineup game are required.' }, 400)
      }
      const rounds = body.rounds as Array<Record<string, unknown>>
      if (rounds.some((round) => !validRound(round))) {
        return json(request, { error: 'One or more rounds are invalid.' }, 400)
      }
      const publicRounds = rounds.map((round) => ({
        outcome: round.outcome,
        incorrectGuesses: Number(round.incorrectGuesses),
      }))
      const points = publicRounds.reduce(
        (sum, round) => sum + calculateLineupScore(round.outcome as 'correct' | 'gave-up', round.incorrectGuesses),
        0,
      )
      if (points > 1_000) return json(request, { error: 'The submitted score is invalid.' }, 400)
      const inserted = await client.from('lineup_challenge_results').insert({
        challenge_date: today,
        nickname: body.nickname.trim(),
        normalized_nickname: normalizeLeaderboardNickname(body.nickname),
        points,
        rounds: publicRounds,
      })
      if (inserted.error) throw inserted.error
      return json(request, {
        date: today,
        points,
        boards: buildChallengeLeaderboardBoards(await getChallengeResults(client), today),
      })
    }

    return json(request, { error: 'Unknown lineup-game action.' }, 404)
  } catch (error) {
    console.error(error)
    return json(request, { error: 'The lineup service is temporarily unavailable.' }, 500)
  }
})
