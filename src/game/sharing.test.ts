import { describe, expect, it, vi } from 'vitest'
import {
  buildChallengeShareData,
  buildDailyShareData,
  deliverShare,
  getGameUrl,
} from './sharing'

const gameUrl = 'https://danielalmazan.com/football_trivia_game/'

describe('result sharing', () => {
  it('builds a spoiler-free Player of the Day result', () => {
    const data = buildDailyShareData({
      points: 80,
      rank: 3,
      date: '2026-07-31',
      url: gameUrl,
    })

    expect(data).toEqual({
      title: 'Leo Guessi — Player of the Day',
      text: 'I scored 80/100 in Leo Guessi’s Player of the Day — rank #3 on 2026-07-31 UTC.',
      url: gameUrl,
    })
    expect(data.text).not.toContain('Lionel Messi')
    expect(data.text).not.toContain('LeoFan')
  })

  it('summarises a leaderboard-eligible 10-round challenge', () => {
    expect(
      buildChallengeShareData({
        points: 1000,
        pool: 'hardcore',
        identified: 9,
        url: gameUrl,
      }),
    ).toEqual({
      title: 'Leo Guessi — 10-round challenge',
      text: 'I scored 1,000/1,000 in Leo Guessi’s 10-round challenge (Hardcore) and identified 9/10 players.',
      url: gameUrl,
    })
  })

  it('constructs a root URL from the current origin and deployment base path', () => {
    expect(getGameUrl('https://danielalmazan.com', '/football_trivia_game/')).toBe(gameUrl)
    expect(getGameUrl('http://127.0.0.1:4173/', '/')).toBe('http://127.0.0.1:4173/')
  })

  it('uses native sharing without touching the clipboard', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const writeText = vi.fn().mockResolvedValue(undefined)
    const data = buildDailyShareData({ points: 100, rank: 1, date: '2026-07-31', url: gameUrl })

    await expect(deliverShare(data, { share, clipboard: { writeText } })).resolves.toBe('shared')
    expect(share).toHaveBeenCalledWith(data)
    expect(writeText).not.toHaveBeenCalled()
  })

  it('copies only the link when native sharing is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const data = buildDailyShareData({ points: 100, rank: 1, date: '2026-07-31', url: gameUrl })

    await expect(deliverShare(data, { clipboard: { writeText } })).resolves.toBe('copied')
    expect(writeText).toHaveBeenCalledWith(gameUrl)
  })

  it('treats a cancelled share silently and reports a complete delivery failure', async () => {
    const cancelledShare = vi.fn().mockRejectedValue({ name: 'AbortError' })
    const writeText = vi.fn().mockResolvedValue(undefined)
    const data = buildDailyShareData({ points: 100, rank: 1, date: '2026-07-31', url: gameUrl })

    await expect(
      deliverShare(data, { share: cancelledShare, clipboard: { writeText } }),
    ).resolves.toBe('cancelled')
    expect(writeText).not.toHaveBeenCalled()

    await expect(
      deliverShare(data, {
        share: vi.fn().mockRejectedValue(new Error('Share failed')),
        clipboard: { writeText: vi.fn().mockRejectedValue(new Error('Copy failed')) },
      }),
    ).resolves.toBe('failed')
  })
})
