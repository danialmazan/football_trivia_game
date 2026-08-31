import { POOL_LABELS } from './config'
import type { Pool } from './types'
import { translate, type Locale } from '../i18n'

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
  locale?: Locale
}

interface ChallengeShareDetails {
  points: number
  pool: Pool
  identified: number
  url: string
  locale?: Locale
}

interface LineupDailyShareDetails {
  points: number
  rank: number
  date: string
  url: string
  locale?: Locale
}

interface LineupChallengeShareDetails {
  points: number
  identified: number
  url: string
  locale?: Locale
}

export function getGameUrl(
  origin = window.location.origin,
  basePath = import.meta.env.BASE_URL,
): string {
  return new URL(basePath, `${origin.replace(/\/$/, '')}/`).toString()
}

export function getLocalizedGameUrl(locale: Locale): string {
  const url = new URL(getGameUrl())
  url.searchParams.set('lang', locale)
  return url.toString()
}

export function buildDailyShareData({
  points,
  rank,
  date,
  url,
  locale = 'en',
}: DailyShareDetails): ShareData {
  if (locale === 'es') return {
    title: 'Leo Guessi — Jugador del día',
    text: `He conseguido ${points}/100 en el Jugador del día de Leo Guessi — puesto #${rank} el ${date} UTC.`,
    url,
  }
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
  locale = 'en',
}: ChallengeShareDetails): ShareData {
  if (locale === 'es') return {
    title: 'Leo Guessi — Reto de 10 rondas',
    text: `He conseguido ${points.toLocaleString('es-ES')}/${(1_000).toLocaleString('es-ES')} en el reto de 10 rondas de Leo Guessi (${POOL_LABELS[pool]}) y he identificado ${identified}/10 jugadores.`,
    url,
  }
  return {
    title: 'Leo Guessi — 10-round challenge',
    text: `I scored ${points.toLocaleString('en-US')}/1,000 in Leo Guessi’s 10-round challenge (${POOL_LABELS[pool]}) and identified ${identified}/10 players.`,
    url,
  }
}

export function buildLineupDailyShareData({
  points,
  rank,
  date,
  url,
  locale = 'en',
}: LineupDailyShareDetails): ShareData {
  if (locale === 'es') return {
    title: 'Leo Guessi — Alineación del día',
    text: `He conseguido ${points}/100 en la Alineación del día de Leo Guessi — puesto #${rank} el ${date} UTC.`,
    url,
  }
  return {
    title: 'Leo Guessi — Lineup of the Day',
    text: `I scored ${points}/100 in Leo Guessi’s Lineup of the Day — rank #${rank} on ${date} UTC.`,
    url,
  }
}

export function buildLineupChallengeShareData({
  points,
  identified,
  url,
  locale = 'en',
}: LineupChallengeShareDetails): ShareData {
  if (locale === 'es') return {
    title: 'Leo Guessi — Reto de 10 alineaciones',
    text: `He conseguido ${points.toLocaleString('es-ES')}/${(1_000).toLocaleString('es-ES')} en el reto de 10 alineaciones de Leo Guessi y he identificado ${identified}/10 jugadores ausentes.`,
    url,
  }
  return {
    title: 'Leo Guessi — 10-round lineup challenge',
    text: `I scored ${points.toLocaleString('en-US')}/1,000 in Leo Guessi’s 10-round lineup challenge and identified ${identified}/10 missing players.`,
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
