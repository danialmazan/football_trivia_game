import type {
  DailyResultResponse,
  LeaderboardBoards,
  LeaderboardEntry,
  LineupChallengeResultResponse,
  LineupChallengeResultSubmission,
  LineupDailyChallenge,
  LineupDailyResultSubmission,
  DailyAttemptEvent,
  DailyAttemptResponse,
  LineupDailyProgress,
  LineupLeaderboardHubResponse,
} from './types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

function endpoint(action: string): string {
  if (!supabaseUrl || !publishableKey) {
    throw new Error('Lineup of the day is not connected yet. Configure the online service and retry.')
  }
  return `${supabaseUrl}/functions/v1/lineup-game?action=${encodeURIComponent(action)}`
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      apikey: publishableKey ?? '',
      Authorization: `Bearer ${publishableKey ?? ''}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null
  if (!response.ok && !(response.status === 409 && payload && 'status' in payload && payload.status === 'stale')) throw new Error(payload?.error || 'The lineup service is unavailable. Please retry.')
  if (!payload) throw new Error('The lineup service returned an empty response.')
  return payload
}

export function startLineupDailyAttempt(input: {
  installationId: string
  nickname: string
  confirmResume?: boolean
  localProgress?: LineupDailyProgress
}): Promise<DailyAttemptResponse<LineupDailyChallenge, LineupDailyProgress>> {
  return request(endpoint('start-attempt'), { method: 'POST', body: JSON.stringify(input) })
}

export function sendLineupDailyAttemptEvent(input: {
  challengeDate: string
  attemptToken: string
  revision: number
  event: DailyAttemptEvent
}): Promise<DailyAttemptResponse<LineupDailyChallenge, LineupDailyProgress>> {
  return request(endpoint('attempt-event'), { method: 'POST', body: JSON.stringify(input) })
}

export function getLineupDailyChallenge(installationId: string): Promise<LineupDailyChallenge> {
  const url = new URL(endpoint('challenge'))
  url.searchParams.set('installationId', installationId)
  return request(url.toString())
}

export function submitLineupDailyResult(submission: LineupDailyResultSubmission): Promise<DailyResultResponse> {
  return request(endpoint('result'), { method: 'POST', body: JSON.stringify(submission) })
}

export function expireLineupDailyResult(
  submission: LineupDailyResultSubmission,
): Promise<{ expired: true }> {
  return request<{ expired: true }>(endpoint('expire-result'), { method: 'POST', body: JSON.stringify(submission) })
}

export function getLineupDailyLeaderboard(): Promise<{ date: string; leaderboard: LeaderboardEntry[]; boards: LeaderboardBoards }> {
  return request(endpoint('leaderboard'))
}

export function submitLineupChallengeResult(submission: LineupChallengeResultSubmission): Promise<LineupChallengeResultResponse> {
  return request(endpoint('challenge-result'), { method: 'POST', body: JSON.stringify(submission) })
}

export function getLineupChallengeLeaderboard(): Promise<{ date: string; boards: LeaderboardBoards }> {
  return request(endpoint('challenge-leaderboard'))
}

export function getLineupLeaderboardHub(nickname: string): Promise<LineupLeaderboardHubResponse> {
  return request(endpoint('leaderboard-hub'), { method: 'POST', body: JSON.stringify({ nickname }) })
}
