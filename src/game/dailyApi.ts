import type {
  DailyChallenge,
  DailyResultResponse,
  DailyResultSubmission,
  LeaderboardEntry,
} from './types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

function endpoint(action: string): string {
  if (!supabaseUrl || !publishableKey) {
    throw new Error('Player of the day is not connected yet. Configure the online service and retry.')
  }
  return `${supabaseUrl}/functions/v1/daily-game?action=${encodeURIComponent(action)}`
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
  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null
  if (!response.ok) {
    throw new Error(payload?.error || 'The daily game service is unavailable. Please retry.')
  }
  if (!payload) throw new Error('The daily game service returned an empty response.')
  return payload
}

export function getDailyChallenge(installationId: string): Promise<DailyChallenge> {
  const url = new URL(endpoint('challenge'))
  url.searchParams.set('installationId', installationId)
  return request<DailyChallenge>(url.toString())
}

export function submitDailyResult(
  submission: DailyResultSubmission,
): Promise<DailyResultResponse> {
  return request<DailyResultResponse>(endpoint('result'), {
    method: 'POST',
    body: JSON.stringify(submission),
  })
}

export async function getDailyLeaderboard(): Promise<{
  date: string
  leaderboard: LeaderboardEntry[]
}> {
  return request(endpoint('leaderboard'))
}
