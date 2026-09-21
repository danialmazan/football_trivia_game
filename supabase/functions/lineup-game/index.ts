import {
  consumeRateLimit,
  createAdminClient,
  createLineupAttemptToken,
  createServerAttemptToken,
  getOrCreateLineupChallenge,
  isOriginAllowed,
  json,
  nextUtcMidnight,
  rankResults,
  utcDateKey,
  verifyLineupAttemptToken,
  verifyServerAttemptToken,
  type StoredAttempt,
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
  'id,challenge_date,participant_hash,nickname,normalized_nickname,points,outcome,clues_used,clue_incorrect_guess_counts,incorrect_guesses,submitted_at'

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
  const cluesUsed = Number(round.cluesUsed)
  const incorrectGuesses = Number(round.incorrectGuesses)
  const clueCounts = round.clueIncorrectGuessCounts
  return (
    (round.outcome === 'correct' || round.outcome === 'gave-up') &&
    Number.isInteger(round.incorrectGuesses) &&
    incorrectGuesses >= 0 &&
    incorrectGuesses <= 50 &&
    Number.isInteger(cluesUsed) &&
    cluesUsed >= 0 &&
    cluesUsed <= 2 &&
    Array.isArray(clueCounts) &&
    clueCounts.length === cluesUsed &&
    clueCounts.every((count, index) =>
      Number.isInteger(count) &&
      Number(count) >= 0 &&
      Number(count) <= incorrectGuesses &&
      (index === 0 || Number(count) >= Number(clueCounts[index - 1]))
    )
  )
}

const DEFAULT_PROGRESS = {
  cluesUsed: 0,
  clueIncorrectGuessCounts: [] as number[],
  incorrectGuesses: [] as string[],
  normalizedIncorrectGuesses: [] as string[],
}

function validProgress(value: unknown): value is typeof DEFAULT_PROGRESS {
  if (!value || typeof value !== 'object') return false
  const progress = value as Record<string, unknown>
  const cluesUsed = Number(progress.cluesUsed)
  return Number.isInteger(cluesUsed) && cluesUsed >= 0 && cluesUsed <= 2 &&
    Array.isArray(progress.clueIncorrectGuessCounts) && progress.clueIncorrectGuessCounts.length === cluesUsed &&
    Array.isArray(progress.incorrectGuesses) && Array.isArray(progress.normalizedIncorrectGuesses) &&
    progress.incorrectGuesses.length === progress.normalizedIncorrectGuesses.length &&
    progress.incorrectGuesses.length <= 50
}

async function completionResponse(
  client: ReturnType<typeof createAdminClient>,
  attempt: StoredAttempt,
) {
  const allResults = await getDailyResults(client)
  const dateResults = allResults.filter((row) => row.challenge_date === attempt.challenge_date)
  const ownResult = rankResults(dateResults).find((row) => row.id === attempt.result_id) ??
    rankResults(dateResults).find((row) => row.normalized_nickname === attempt.normalized_nickname)
  if (!ownResult) throw new Error('The saved lineup result could not be read back.')
  return {
    status: 'resolved', date: attempt.challenge_date, nickname: attempt.nickname,
    points: ownResult.points, rank: ownResult.rank,
    leaderboard: publicLeaderboard(dateResults),
    boards: buildDailyLeaderboardBoards(allResults, utcDateKey()),
  }
}

async function attemptPayload(
  attempt: StoredAttempt,
  challenge: Awaited<ReturnType<typeof getOrCreateLineupChallenge>>,
  participantHash: string,
) {
  return {
    status: 'in-progress', nickname: attempt.nickname, revision: attempt.revision,
    progress: attempt.progress, startedAt: attempt.started_at, updatedAt: attempt.updated_at,
    challenge: {
      date: challenge.challenge_date, expiresAt: nextUtcMidnight(),
      matchId: challenge.match_id, missingPlayerId: challenge.missing_player_id,
      rosterVersion: challenge.roster_version,
      attemptToken: await createServerAttemptToken('lineup', challenge.challenge_date, attempt.id, participantHash),
      attemptRevision: attempt.revision,
    },
  }
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

    if (request.method === 'POST' && action === 'start-attempt') {
      const body = await request.json().catch(() => null) as Record<string, unknown> | null
      const installationId = String(body?.installationId ?? '')
      if (!body || installationId.length < 8 || installationId.length > 128 || !isValidDailyNickname(body.nickname)) {
        return json(request, { error: 'A valid nickname and browser installation ID are required.' }, 400)
      }
      const challenge = await getOrCreateLineupChallenge(client, today)
      const participantHash = (await createLineupAttemptToken(today, installationId)).split('.')[0]
      const initialProgress = validProgress(body.localProgress) ? body.localProgress : DEFAULT_PROGRESS
      const started = await client.rpc('start_lineup_daily_attempt', {
        p_challenge_date: today, p_participant_hash: participantHash,
        p_nickname: String(body.nickname), p_progress: initialProgress,
        p_confirm_resume: body.confirmResume === true,
      })
      if (started.error) throw started.error
      const payload = started.data as { access: boolean; participantConflict?: boolean; attempt: StoredAttempt | null }
      if (payload.participantConflict) return json(request, { error: `This browser already started today's lineup as ${payload.attempt?.nickname ?? 'another nickname'}.` }, 409)
      if (!payload.attempt) return json(request, { error: 'That nickname is already locked today.' }, 409)
      if (payload.attempt.status !== 'in_progress') return json(request, await completionResponse(client, payload.attempt))
      if (!payload.access) return json(request, {
        status: 'resume-required', nickname: payload.attempt.nickname,
        startedAt: payload.attempt.started_at, updatedAt: payload.attempt.updated_at,
      })
      return json(request, await attemptPayload(payload.attempt, challenge, participantHash))
    }

    if (request.method === 'POST' && action === 'attempt-event') {
      const body = await request.json().catch(() => null) as Record<string, unknown> | null
      const challengeDate = String(body?.challengeDate ?? '')
      const verified = await verifyServerAttemptToken('lineup', challengeDate, String(body?.attemptToken ?? ''))
      if (!body || !verified) return json(request, { error: 'The lineup attempt token is invalid.' }, 401)
      const selected = await client.from('lineup_daily_attempts').select('*').eq('id', verified.attemptId).maybeSingle()
      if (selected.error) throw selected.error
      const attempt = selected.data as StoredAttempt | null
      if (!attempt || attempt.challenge_date !== challengeDate || !attempt.participant_hashes.includes(verified.participantHash)) {
        return json(request, { error: 'The lineup attempt token is invalid.' }, 401)
      }
      if (attempt.status !== 'in_progress') return json(request, await completionResponse(client, attempt))
      if (attempt.revision !== Number(body.revision)) {
        const challenge = await getOrCreateLineupChallenge(client, challengeDate)
        return json(request, { ...(await attemptPayload(attempt, challenge, verified.participantHash)), status: 'stale' }, 409)
      }
      const progress = validProgress(attempt.progress) ? structuredClone(attempt.progress) : structuredClone(DEFAULT_PROGRESS)
      const event = body.event as Record<string, unknown> | undefined
      if (!event || !['reveal-clue', 'incorrect-guess', 'correct', 'give-up'].includes(String(event.type))) {
        return json(request, { error: 'The lineup attempt event is invalid.' }, 400)
      }
      if (event.type === 'reveal-clue' && progress.cluesUsed < 2) {
        progress.clueIncorrectGuessCounts.push(progress.incorrectGuesses.length)
        progress.cluesUsed += 1
      }
      if (event.type === 'incorrect-guess') {
        const guess = String(event.guess ?? '').trim()
        const normalized = String(event.normalizedGuess ?? '').trim()
        if (!guess || !normalized || progress.incorrectGuesses.length >= 50) return json(request, { error: 'The guess is invalid.' }, 400)
        if (!progress.normalizedIncorrectGuesses.includes(normalized)) {
          progress.incorrectGuesses.push(guess)
          progress.normalizedIncorrectGuesses.push(normalized)
        }
      }
      const resolving = event.type === 'correct' || event.type === 'give-up'
      if (event.type === 'correct') {
        const challenge = await getOrCreateLineupChallenge(client, challengeDate)
        if (event.answerId !== challenge.missing_player_id) return json(request, { error: 'The resolved answer is invalid.' }, 400)
      }
      if (resolving) {
        const outcome = event.type === 'correct' ? 'correct' : 'gave-up'
        const points = calculateLineupScore(outcome, progress.incorrectGuesses.length, progress.cluesUsed, progress.clueIncorrectGuessCounts)
        const resolved = await client.rpc('resolve_lineup_daily_attempt', {
          p_attempt_id: attempt.id, p_expected_revision: attempt.revision,
          p_points: points, p_outcome: outcome, p_clues_used: progress.cluesUsed,
          p_clue_incorrect_guess_counts: progress.clueIncorrectGuessCounts,
          p_incorrect_guesses: progress.incorrectGuesses.length,
        })
        if (resolved.error) throw resolved.error
        const refreshed = await client.from('lineup_daily_attempts').select('*').eq('id', attempt.id).single()
        if (refreshed.error) throw refreshed.error
        if (resolved.data === 'stale') {
          const challenge = await getOrCreateLineupChallenge(client, challengeDate)
          return json(request, { ...(await attemptPayload(refreshed.data as StoredAttempt, challenge, verified.participantHash)), status: 'stale' }, 409)
        }
        return json(request, await completionResponse(client, refreshed.data as StoredAttempt))
      }
      const updated = await client.from('lineup_daily_attempts').update({
        progress, revision: attempt.revision + 1, updated_at: new Date().toISOString(),
      }).eq('id', attempt.id).eq('revision', attempt.revision).eq('status', 'in_progress').select('*').maybeSingle()
      if (updated.error) throw updated.error
      if (!updated.data) {
        const refreshed = await client.from('lineup_daily_attempts').select('*').eq('id', attempt.id).single()
        if (refreshed.error) throw refreshed.error
        if ((refreshed.data as StoredAttempt).status !== 'in_progress') return json(request, await completionResponse(client, refreshed.data as StoredAttempt))
        const challenge = await getOrCreateLineupChallenge(client, challengeDate)
        return json(request, { ...(await attemptPayload(refreshed.data as StoredAttempt, challenge, verified.participantHash)), status: 'stale' }, 409)
      }
      const challenge = await getOrCreateLineupChallenge(client, challengeDate)
      return json(request, await attemptPayload(updated.data as StoredAttempt, challenge, verified.participantHash))
    }

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
      const candidate = {
        outcome: body.outcome,
        cluesUsed: body.cluesUsed,
        clueIncorrectGuessCounts: body.clueIncorrectGuessCounts,
        incorrectGuesses: body.incorrectGuesses,
      }
      if (!validRound(candidate)) {
        return json(request, { error: 'The submitted round statistics are invalid.' }, 400)
      }
      const participantHash = await verifyLineupAttemptToken(challengeDate, String(body.attemptToken ?? ''))
      if (!participantHash) return json(request, { error: 'The daily attempt token is invalid.' }, 401)

      await getOrCreateLineupChallenge(client, challengeDate)
      const incorrectGuesses = Number(body.incorrectGuesses)
      const cluesUsed = Number(body.cluesUsed)
      const clueIncorrectGuessCounts = (body.clueIncorrectGuessCounts as number[]).map(Number)
      const points = calculateLineupScore(body.outcome as 'correct' | 'gave-up', incorrectGuesses, cluesUsed, clueIncorrectGuessCounts)
      const inserted = await client.rpc('submit_locked_lineup_daily_result', {
        p_challenge_date: challengeDate,
        p_participant_hash: participantHash,
        p_nickname: body.nickname.trim(),
        p_points: points,
        p_outcome: body.outcome,
        p_clues_used: cluesUsed,
        p_clue_incorrect_guess_counts: clueIncorrectGuessCounts,
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
      const ownResult = rankResults(todayResults).find((row) => row.participant_hash === participantHash)
      if (!ownResult) throw new Error('The saved lineup result could not be read back.')
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
      if (!body || !isValidDailyNickname(body.nickname) || !Array.isArray(body.rounds) || body.rounds.length !== 10) {
        return json(request, { error: 'A nickname and completed 10-round lineup game are required.' }, 400)
      }
      const rounds = body.rounds as Array<Record<string, unknown>>
      if (rounds.some((round) => !validRound(round))) {
        return json(request, { error: 'One or more rounds are invalid.' }, 400)
      }
      const publicRounds = rounds.map((round) => ({
        outcome: round.outcome,
        cluesUsed: Number(round.cluesUsed),
        clueIncorrectGuessCounts: (round.clueIncorrectGuessCounts as number[]).map(Number),
        incorrectGuesses: Number(round.incorrectGuesses),
      }))
      const points = publicRounds.reduce(
        (sum, round) => sum + calculateLineupScore(round.outcome as 'correct' | 'gave-up', round.incorrectGuesses, round.cluesUsed, round.clueIncorrectGuessCounts),
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
