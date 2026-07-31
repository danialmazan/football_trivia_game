import { POOL_LABELS } from './config'
import type { Pool } from './types'

export type ShareDeliveryStatus = 'shared' | 'copied' | 'cancelled' | 'failed'

export interface SharingBrowser {
  share?: (data: ShareData) => Promise<void>
  clipboard?: {
    writeText: (text: string) => Promise<void>
  }
}

interface DailyShareDetails {
  points: number
  rank: number
  date: string
  url: string
}

interface ChallengeShareDetails {
  points: number
  pool: Pool
  identified: number
  url: string
}

export function getGameUrl(
  origin = window.location.origin,
  basePath = import.meta.env.BASE_URL,
): string {
  return new URL(basePath, `${origin.replace(/\/$/, '')}/`).toString()
}

export function buildDailyShareData({
  points,
  rank,
  date,
  url,
}: DailyShareDetails): ShareData {
  return {
    title: 'Leo Guessi — Player of the Day',
    text: `I scored ${points}/100 in Leo Guessi’s Player of the Day — rank #${rank} on ${date} UTC.`,
    url,
  }
}

export function buildChallengeShareData({
  points,
  pool,
  identified,
  url,
}: ChallengeShareDetails): ShareData {
  return {
    title: 'Leo Guessi — 10-round challenge',
    text: `I scored ${points.toLocaleString('en-US')}/1,000 in Leo Guessi’s 10-round challenge (${POOL_LABELS[pool]}) and identified ${identified}/10 players.`,
    url,
  }
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  )
}

export async function deliverShare(
  data: ShareData,
  browser: SharingBrowser = navigator,
): Promise<ShareDeliveryStatus> {
  if (browser.share) {
    try {
      await browser.share(data)
      return 'shared'
    } catch (error) {
      if (isAbortError(error)) return 'cancelled'
    }
  }

  try {
    await browser.clipboard?.writeText(data.url ?? '')
    return browser.clipboard ? 'copied' : 'failed'
  } catch {
    return 'failed'
  }
}
