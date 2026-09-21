import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
export { rankDailyResults as rankResults } from './rules.ts'

export interface StoredChallenge {
  challenge_date: string
  player_id: string
  clue_seed: number
  roster_version: string
}

export interface StoredResult {
  id?: string
  challenge_date: string
  participant_hash: string
  nickname: string
  normalized_nickname?: string | null
  points: number
  outcome: 'correct' | 'gave-up'
  clues_used: number
  incorrect_guesses: number
  submitted_at: string
}

export interface StoredLineupChallenge {
  challenge_date: string
  match_id: string
  missing_player_id: string
  roster_version: string
}

export interface StoredLineupResult extends StoredResult {
  clue_incorrect_guess_counts: number[]
}

export interface StoredAttempt {
  id: string
  challenge_date: string
  nickname: string
  normalized_nickname: string
  participant_hashes: string[]
  status: 'in_progress' | 'resolved' | 'expired'
  revision: number
  progress: Record<string, unknown> | null
  outcome: 'correct' | 'gave-up' | null
  points: number | null
  result_id: string | null
  started_at: string
  updated_at: string
}

export function createAdminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) throw new Error('Supabase service credentials are missing.')
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function utcDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

export function nextUtcMidnight(date = new Date()): string {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1),
  ).toISOString()
}

export function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('origin') ?? ''
  const configured = Deno.env.get('DAILY_ALLOWED_ORIGIN') ?? ''
  const allowed = configured
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  const local = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)
  return {
    'Access-Control-Allow-Origin': local || allowed.includes(origin) ? origin : allowed[0] ?? '',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
    Vary: 'Origin',
  }
}

export function isOriginAllowed(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true
  const configured = (Deno.env.get('DAILY_ALLOWED_ORIGIN') ?? '')
    .split(',')
    .map((value) => value.trim())
  return (
    configured.includes(origin) ||
    /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)
  )
}

export function json(
  request: Request,
  body: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(request),
  })
}

async function hmacBytes(secret: string, value: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)),
  )
}

export async function hmacHex(secret: string, value: string): Promise<string> {
  const bytes = await hmacBytes(secret, value)
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function integerFrom(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) >>> 0) +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  )
}

function rotateFrom<T>(items: T[], startIndex: number): T[] {
  const offset = ((startIndex % items.length) + items.length) % items.length
  return [...items.slice(offset), ...items.slice(0, offset)]
}

export async function getOrCreateChallenge(
  client: SupabaseClient,
  date = utcDateKey(),
): Promise<StoredChallenge> {
  const existing = await client
    .from('daily_challenges')
    .select('challenge_date,player_id,clue_seed,roster_version')
    .eq('challenge_date', date)
    .maybeSingle()
  if (existing.error) throw existing.error
  if (existing.data) return existing.data as StoredChallenge

  const poolResult = await client
    .from('daily_player_pool')
    .select('player_id,roster_version,ranking')
    .eq('active', true)
    .order('ranking')
  if (poolResult.error) throw poolResult.error
  if (!poolResult.data?.length) throw new Error('The Normal daily player pool is empty.')

  const activeRosterVersions = new Set(poolResult.data.map((row) => row.roster_version as string))
  if (activeRosterVersions.size !== 1) {
    throw new Error('The Normal daily player pool has mixed active roster versions.')
  }
  const rosterVersion = poolResult.data[0].roster_version as string
  const selectionSecret = Deno.env.get('DAILY_SELECTION_SECRET')
  if (!selectionSecret || selectionSecret.length < 32) {
    throw new Error('DAILY_SELECTION_SECRET must contain at least 32 characters.')
  }
  const digest = await hmacBytes(selectionSecret, `${date}:${rosterVersion}`)
  const playerIndex = integerFrom(digest, 0) % poolResult.data.length
  const clueSeed = integerFrom(digest, 4) % 1_000_000
  const candidates = rotateFrom(poolResult.data, playerIndex)
    .map((row) => row.player_id as string)
  const reserved = await client.rpc('reserve_daily_challenge', {
    p_challenge_date: date,
    p_candidate_player_ids: candidates,
    p_clue_seed: clueSeed,
    p_roster_version: rosterVersion,
  }).single()
  if (reserved.error) throw reserved.error
  return reserved.data as StoredChallenge
}

export async function getOrCreateLineupChallenge(
  client: SupabaseClient,
  date = utcDateKey(),
): Promise<StoredLineupChallenge> {
  const fields = 'challenge_date,match_id,missing_player_id,roster_version'
  const existing = await client
    .from('lineup_daily_challenges')
    .select(fields)
    .eq('challenge_date', date)
    .maybeSingle()
  if (existing.error) throw existing.error
  if (existing.data) return existing.data as StoredLineupChallenge

  const poolResult = await client
    .from('lineup_daily_pool')
    .select('match_id,roster_version,ranking,starter_ids')
    .eq('active', true)
    .order('ranking')
  if (poolResult.error) throw poolResult.error
  if (!poolResult.data?.length) throw new Error('The lineup daily pool is empty.')

  const activeRosterVersions = new Set(poolResult.data.map((row) => row.roster_version as string))
  if (activeRosterVersions.size !== 1) {
    throw new Error('The lineup daily pool has mixed active roster versions.')
  }

  const rosterVersion = poolResult.data[0].roster_version as string
  const selectionSecret = Deno.env.get('DAILY_SELECTION_SECRET')
  if (!selectionSecret || selectionSecret.length < 32) {
    throw new Error('DAILY_SELECTION_SECRET must contain at least 32 characters.')
  }
  const digest = await hmacBytes(selectionSecret, `${date}:lineup:${rosterVersion}`)
  const matchIndex = integerFrom(digest, 0) % poolResult.data.length
  const orderedMatchIds = rotateFrom(poolResult.data, matchIndex)
    .map((row) => row.match_id as string)
  const starterOffset = integerFrom(digest, 4) % 22
  const reserved = await client.rpc('reserve_lineup_daily_challenge', {
    p_challenge_date: date,
    p_candidate_match_ids: orderedMatchIds,
    p_starter_offset: starterOffset,
    p_roster_version: rosterVersion,
  }).single()
  if (reserved.error) throw reserved.error
  return reserved.data as StoredLineupChallenge
}

export async function createAttemptToken(
  date: string,
  installationId: string,
): Promise<string> {
  const secret = Deno.env.get('DAILY_SELECTION_SECRET') ?? ''
  const participantHash = await hmacHex(secret, `${date}:${installationId}`)
  const signature = await hmacHex(secret, `${date}:${participantHash}`)
  return `${participantHash}.${signature}`
}

export async function verifyAttemptToken(
  date: string,
  token: string,
): Promise<string | null> {
  const [participantHash, signature, extra] = token.split('.')
  if (
    extra ||
    !/^[a-f0-9]{64}$/.test(participantHash ?? '') ||
    !/^[a-f0-9]{64}$/.test(signature ?? '')
  ) {
    return null
  }
  const secret = Deno.env.get('DAILY_SELECTION_SECRET') ?? ''
  const expected = await hmacHex(secret, `${date}:${participantHash}`)
  return timingSafeEqual(signature, expected) ? participantHash : null
}

export async function createLineupAttemptToken(
  date: string,
  installationId: string,
): Promise<string> {
  const secret = Deno.env.get('DAILY_SELECTION_SECRET') ?? ''
  const participantHash = await hmacHex(secret, `${date}:lineup:${installationId}`)
  const signature = await hmacHex(secret, `${date}:lineup:${participantHash}`)
  return `${participantHash}.${signature}`
}

export async function verifyLineupAttemptToken(
  date: string,
  token: string,
): Promise<string | null> {
  const [participantHash, signature, extra] = token.split('.')
  if (extra || !/^[a-f0-9]{64}$/.test(participantHash ?? '') || !/^[a-f0-9]{64}$/.test(signature ?? '')) {
    return null
  }
  const secret = Deno.env.get('DAILY_SELECTION_SECRET') ?? ''
  const expected = await hmacHex(secret, `${date}:lineup:${participantHash}`)
  return timingSafeEqual(signature, expected) ? participantHash : null
}

export async function createServerAttemptToken(
  family: 'player' | 'lineup',
  date: string,
  attemptId: string,
  participantHash: string,
): Promise<string> {
  const secret = Deno.env.get('DAILY_SELECTION_SECRET') ?? ''
  const signature = await hmacHex(secret, `${family}:${date}:${attemptId}:${participantHash}`)
  return `${attemptId}.${participantHash}.${signature}`
}

export async function verifyServerAttemptToken(
  family: 'player' | 'lineup',
  date: string,
  token: string,
): Promise<{ attemptId: string; participantHash: string } | null> {
  const [attemptId, participantHash, signature, extra] = token.split('.')
  if (
    extra ||
    !/^[0-9a-f-]{36}$/.test(attemptId ?? '') ||
    !/^[a-f0-9]{64}$/.test(participantHash ?? '') ||
    !/^[a-f0-9]{64}$/.test(signature ?? '')
  ) return null
  const secret = Deno.env.get('DAILY_SELECTION_SECRET') ?? ''
  const expected = await hmacHex(secret, `${family}:${date}:${attemptId}:${participantHash}`)
  return timingSafeEqual(signature, expected) ? { attemptId, participantHash } : null
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  let mismatch = 0
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return mismatch === 0
}

export async function consumeRateLimit(
  client: SupabaseClient,
  request: Request,
): Promise<boolean> {
  const secret = Deno.env.get('DAILY_SELECTION_SECRET') ?? ''
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const now = new Date()
  now.setUTCSeconds(0, 0)
  const windowStart = now.toISOString()
  const keyHash = await hmacHex(secret, `${windowStart}:${forwarded}`)
  const result = await client.rpc('consume_daily_rate_limit', {
    p_key_hash: keyHash,
    p_window_start: windowStart,
    p_limit: 60,
  })
  if (result.error) throw result.error
  return result.data === true
}
