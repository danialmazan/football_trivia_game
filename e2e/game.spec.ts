import { expect, test } from '@playwright/test'

const firstTenAnswers = [
  'Lionel Messi',
  'Toni Kroos',
  'Xavi',
  'Andrés Iniesta',
  'Cristiano Ronaldo',
  'Gerard Piqué',
  'Sergio Ramos',
  'Iker Casillas',
  'Dani Alves',
  'Manuel Neuer',
]

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0
  })
  await page.goto('/')
})

async function startGame(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /10-round challenge/i }).click()
  await page.getByRole('button', { name: /kick off/i }).click()
  await expect(page.getByRole('heading', { name: /know your three moves/i })).toBeVisible()
  await page.getByRole('button', { name: /let's go/i }).click()
}

test('enters the homepage in Player of the Day mode with a non-overlapping crest', async ({ page }) => {
  await expect(page.getByRole('button', { name: /^Player of the day/i })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText(/Five clues, hardest first.*no transfer gossip, no luck/i)).toHaveCount(0)
  await expect(page.getByLabel('Saved high scores')).toHaveCount(0)
  await expect(page.getByText(/Player of the day best|Normal best|Hardcore best|Lineup challenge best/i)).toHaveCount(0)

  for (const width of [1051, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    const boxes = await page.evaluate(() => {
      const rect = (selector: string) => {
        const element = document.querySelector(selector)
        if (!element) return null
        const box = element.getBoundingClientRect()
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom }
      }
      return { kicker: rect('.hero__kicker'), crest: rect('.hero__crest'), title: rect('.hero h1') }
    })
    expect(boxes.kicker).not.toBeNull()
    expect(boxes.crest).not.toBeNull()
    expect(boxes.title).not.toBeNull()
    for (const other of [boxes.kicker, boxes.title]) {
      expect(boxes.crest!.right <= other!.left || boxes.crest!.left >= other!.right || boxes.crest!.bottom <= other!.top || boxes.crest!.top >= other!.bottom).toBe(true)
    }
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  await page.evaluate(() => {
    const key = 'leo-guessi:football-trivia:v1'
    const saved = JSON.parse(window.localStorage.getItem(key) ?? '{}')
    saved.lastSettings = { ...saved.lastSettings, mode: 'lineup-challenge', pool: 'normal' }
    window.localStorage.setItem(key, JSON.stringify(saved))
  })
  await page.reload()
  await expect(page.getByRole('button', { name: /^Player of the day/i })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: /^Lineup of the day/i })).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: /^10-round challenge/i }).click()
  await expect(page.getByRole('button', { name: /^10-round challenge/i })).toHaveAttribute('aria-pressed', 'true')
})

test('plays the shared daily player once and restores its leaderboard after reload', async ({ page }) => {
  const dailyDate = new Date().toISOString().slice(0, 10)
  const leaderboard = [
    {
      rank: 1,
      nickname: 'LeoFan',
      points: 100,
      submittedAt: '2026-07-29T10:00:00.000Z',
    },
    {
      rank: 2,
      nickname: 'AwayDays',
      points: 80,
      submittedAt: '2026-07-29T09:00:00.000Z',
    },
  ]
  const boards = {
    today: leaderboard.map((entry) => ({ ...entry, value: entry.points, gamesPlayed: 1 })),
    cumulative: leaderboard.map((entry) => ({ ...entry, value: entry.points, gamesPlayed: 1 })),
    average: [],
    best: leaderboard.map((entry) => ({ ...entry, value: entry.points, gamesPlayed: 1 })),
  }
  await page.route('**/api/functions/v1/daily-game**', async (route) => {
    const request = route.request()
    const action = new URL(request.url()).searchParams.get('action')
    if (action === 'challenge') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          date: dailyDate,
          expiresAt: '2099-07-30T00:00:00.000Z',
          playerId: 'lionel-messi-28003',
          clueSeed: 0,
          rosterVersion: 'test-roster',
          attemptToken: `${'a'.repeat(64)}.${'b'.repeat(64)}`,
        }),
      })
      return
    }
    if (action === 'result') {
      const body = request.postDataJSON()
      expect(body).toMatchObject({
        challengeDate: dailyDate,
        nickname: 'LeoFan',
        outcome: 'correct',
        cluesUsed: 1,
        incorrectGuesses: 0,
      })
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          date: dailyDate,
          points: 100,
          rank: 1,
          leaderboard,
          boards,
        }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ date: dailyDate, leaderboard, boards }),
    })
  })

  const dailyMode = page.locator('.choice-card').filter({ hasText: 'Player of the day' })
  await expect(dailyMode).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: /hardcore/i })).toBeDisabled()
  await expect(dailyMode).toContainText('A player each day. Same for everyone.')

  await page.getByRole('button', { name: /kick off/i }).click()
  await expect(page.getByRole('heading', { name: /one player. one shared fixture/i })).toBeVisible()
  await expect(page.getByText(/00:00:00 UTC/i)).toBeVisible()
  await page.getByRole('button', { name: /let's go/i }).click()
  await expect(page.getByText('1 / 1')).toBeVisible()

  await page.getByLabel(/guess now/i).fill('Lionel Messi')
  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page.getByRole('button', { name: /share your result/i })).toHaveCount(0)
  await page.getByLabel(/enter your nickname to save this result/i).fill('LeoFan')
  await expect(page.getByRole('button', { name: /share your result/i })).toHaveCount(0)
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        Reflect.set(window, '__sharedResult', data)
      },
    })
  })
  await page.getByRole('button', { name: /save score/i }).click()

  await expect(page.getByRole('heading', { name: /score saved/i })).toBeVisible()
  await expect(page.getByRole('table', { name: /today leaderboard/i })).toContainText('LeoFan')
  await expect(page.getByText(/rank #1/i)).toBeVisible()
  await page.getByRole('button', { name: /share your result/i }).click()
  const sharedResult = await page.evaluate(() => Reflect.get(window, '__sharedResult'))
  expect(sharedResult).toEqual({
    title: 'Leo Guessi — Player of the Day',
    text: `I scored 100/100 in Leo Guessi’s Player of the Day — rank #1 on ${dailyDate} UTC.`,
    url: 'http://127.0.0.1:4175/',
  })
  expect(JSON.stringify(sharedResult)).not.toContain('Lionel Messi')
  expect(JSON.stringify(sharedResult)).not.toContain('LeoFan')
  await expect(page.getByRole('status')).toHaveText('Shared.')

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async () => {
        throw { name: 'AbortError' }
      },
    })
  })
  await page.getByRole('button', { name: /share your result/i }).click()
  await expect(page.getByRole('status')).toBeEmpty()

  await page.reload()
  await page.getByRole('button', { name: /kick off/i }).click()
  await expect(page.getByRole('heading', { name: /score saved/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /share your result/i })).toBeVisible()
  await expect(page.getByRole('table', { name: /today leaderboard/i })).toContainText('AwayDays')
  await page.getByRole('button', { name: /back to home page/i }).click()
  await expect(page.getByText('Player of the day best')).toHaveCount(0)
  await expect(page.getByText('Your best player-of-the-day score')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /check the leaderboard/i })).toBeVisible()
})

test('gates the homepage leaderboard by today’s nickname and switches game and pool views', async ({ page }) => {
  const dailyBoards = {
    today: [{ rank: 1, nickname: 'LeoFan', value: 100, gamesPlayed: 1 }],
    cumulative: [{ rank: 1, nickname: 'LeoFan', value: 180, gamesPlayed: 2 }],
    average: [],
    best: [{ rank: 1, nickname: 'LeoFan', value: 100, gamesPlayed: 2 }],
  }
  const normalBoards = {
    today: [{ rank: 1, nickname: 'NormalLeader', value: 900, gamesPlayed: 1 }],
    gamesPlayed: [{ rank: 1, nickname: 'NormalLeader', value: 1, gamesPlayed: 1 }],
    average: [],
    best: [{ rank: 1, nickname: 'NormalLeader', value: 900, gamesPlayed: 1 }],
  }
  const hardcoreBoards = {
    today: [{ rank: 1, nickname: 'HardcoreLeader', value: 700, gamesPlayed: 1 }],
    gamesPlayed: [{ rank: 1, nickname: 'HardcoreLeader', value: 1, gamesPlayed: 1 }],
    average: [],
    best: [{ rank: 1, nickname: 'HardcoreLeader', value: 700, gamesPlayed: 1 }],
  }
  await page.route('**/api/functions/v1/daily-game**', async (route) => {
    const request = route.request()
    if (new URL(request.url()).searchParams.get('action') !== 'leaderboard-hub') {
      await route.fallback()
      return
    }
    const { nickname } = request.postDataJSON()
    if (nickname !== 'LeoFan') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ eligible: false, date: '2026-07-31' }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        eligible: true,
        date: '2026-07-31',
        nickname: 'LeoFan',
        dailyBoards,
        challengeBoards: { normal: normalBoards, hardcore: hardcoreBoards },
      }),
    })
  })

  await expect(page.getByText('Player of the day best')).toHaveCount(0)
  await expect(page.getByText('Your best player-of-the-day score')).toHaveCount(0)
  await page.getByRole('button', { name: /check the leaderboard/i }).click()
  await expect(page.getByRole('heading', { name: /check the leaderboard/i })).toBeVisible()
  await page.getByRole('button', { name: /guess the player/i }).click()
  await expect(page.getByLabel('Public nickname')).toHaveValue('')
  await expect(page.getByRole('button', { name: /share your result/i })).toHaveCount(0)

  await page.getByLabel('Public nickname').fill('Unknown')
  await page.getByRole('button', { name: /check the leaderboard/i }).click()
  await expect(page.getByText('Guess today’s Player of the Day to see this leaderboard!')).toBeVisible()
  await expect(page.getByLabel('Unlocked leaderboards')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /share your result/i })).toHaveCount(0)

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        Reflect.set(window, '__hubSharedResult', data)
      },
    })
  })
  await page.getByLabel('Public nickname').fill('LeoFan')
  await page.getByRole('button', { name: /check the leaderboard/i }).click()
  await expect(page.getByLabel('Unlocked leaderboards')).toBeVisible()
  await expect(page.getByRole('table', { name: /today leaderboard/i })).toContainText('LeoFan')
  await page.getByRole('button', { name: /share your result/i }).click()
  const hubSharedResult = await page.evaluate(() => Reflect.get(window, '__hubSharedResult'))
  expect(hubSharedResult).toEqual({
    title: 'Leo Guessi — Player of the Day',
    text: 'I scored 100/100 in Leo Guessi’s Player of the Day — rank #1 on 2026-07-31 UTC.',
    url: 'http://127.0.0.1:4175/',
  })
  expect(JSON.stringify(hubSharedResult)).not.toContain('LeoFan')

  await page.getByRole('tab', { name: '10-round challenge' }).click()
  await expect(page.getByRole('table', { name: /today leaderboard/i })).toContainText('NormalLeader')
  await expect(page.getByText(/shared 10-round records began/i)).toBeVisible()
  await page.getByRole('button', { name: 'Hardcore', exact: true }).click()
  await expect(page.getByRole('table', { name: /today leaderboard/i })).toContainText('HardcoreLeader')

  await page.getByRole('button', { name: /change nickname/i }).click()
  await expect(page.getByLabel('Public nickname')).toHaveValue('')
  await expect(page.getByLabel('Unlocked leaderboards')).toHaveCount(0)
  await page.getByRole('button', { name: /back to home page/i }).click()
  await expect(page.getByRole('heading', { name: /game format/i })).toBeVisible()
})

test('keeps secondary formats collapsed and plays the shared lineup daily with bench autocomplete', async ({ page }) => {
  const dailyDate = new Date().toISOString().slice(0, 10)
  const boards = {
    today: [{ rank: 1, nickname: 'ShapeReader', value: 20, gamesPlayed: 1 }],
    cumulative: [{ rank: 1, nickname: 'ShapeReader', value: 20, gamesPlayed: 1 }],
    average: [],
    best: [{ rank: 1, nickname: 'ShapeReader', value: 20, gamesPlayed: 1 }],
  }
  await page.route('**/api/functions/v1/lineup-game**', async (route) => {
    const request = route.request()
    const action = new URL(request.url()).searchParams.get('action')
    if (action === 'challenge') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        date: dailyDate,
        expiresAt: '2099-08-06T00:00:00.000Z',
        matchId: 'tm-53455',
        missingPlayerId: 'tm-player-3366',
        rosterVersion: 'lineups-test',
        attemptToken: `${'c'.repeat(64)}.${'d'.repeat(64)}`,
      }) })
      return
    }
    if (action === 'result') {
      expect(request.postDataJSON()).toMatchObject({
        challengeDate: dailyDate,
        nickname: 'ShapeReader',
        outcome: 'correct',
        cluesUsed: 2,
        clueIncorrectGuessCounts: [1, 1],
        incorrectGuesses: 1,
      })
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        date: dailyDate,
        points: 20,
        rank: 1,
        leaderboard: [{ rank: 1, nickname: 'ShapeReader', points: 20, submittedAt: '2026-08-05T12:00:00Z' }],
        boards,
      }) })
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ date: dailyDate, leaderboard: [], boards }) })
  })

  await expect(page.getByRole('button', { name: /^Endless mode/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^By decade or league/i })).toHaveCount(0)
  const more = page.getByRole('button', { name: /more game formats/i })
  await expect(more).toHaveAttribute('aria-expanded', 'false')
  await more.click()
  await expect(page.getByRole('button', { name: /^Endless mode/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /^By decade or league/i })).toBeVisible()

  await page.getByRole('button', { name: /^Lineup of the day/i }).click()
  await expect(page.getByText('historic matches available')).toBeVisible()
  await expect(page.locator('.roster-count strong')).toHaveText('136')
  await expect(page.getByRole('button', { name: /^Hardcore/i })).toHaveCount(0)
  await page.getByRole('button', { name: /kick off/i }).click()
  await expect(page.getByRole('heading', { name: /read the shape/i })).toBeVisible()
  await page.getByRole('button', { name: /let's go/i }).click()

  await expect(page.getByRole('heading', { name: /AC Milan.*FC Barcelona/i })).toBeVisible()
  await expect(page.getByTestId('lineup-competition-label')).toHaveText('2005/06 - UCL Semi-Final - First leg')
  await expect(page.getByLabel(/AC Milan and FC Barcelona starting lineups/i)).toBeVisible()
  await expect(page.getByLabel(/missing AC Milan starter/i)).toBeVisible()
  await expect(page.getByText(/CEST \(Europe\/Rome\)/)).toBeVisible()

  const input = page.getByLabel(/who is missing/i)
  await input.fill('Kal')
  await expect(page.getByRole('option', { name: /Zeljko Kalac/i })).toBeVisible()
  await page.getByRole('option', { name: /Zeljko Kalac/i }).click()
  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page.getByTestId('lineup-available-score')).toHaveText('80')
  await input.fill('Zeljko Kalac')
  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page.getByTestId('lineup-available-score')).toHaveText('80')
  await expect(page.getByRole('status')).toContainText('Already guessed')

  await page.getByRole('button', { name: /get nationality clue.*max 40 pts/i }).click()
  await expect(page.getByTestId('lineup-primary-clue')).toHaveText(/NationalityBrazil/i)
  await expect(page.getByTestId('lineup-available-score')).toHaveText('40')
  await page.getByRole('button', { name: /get initials clue.*max 20 pts/i }).click()
  await expect(page.getByTestId('lineup-initials-clue')).toHaveText(/Player initialsR\.I\.d\.S\.L\./i)
  await expect(page.getByTestId('lineup-available-score')).toHaveText('20')

  await input.fill('Ric')
  await expect(page.getByRole('option', { name: /Ricardo Izecson dos Santos Leite/i })).toBeVisible()
  await input.fill('Kaká')
  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page.getByTestId('lineup-answer-reveal')).toContainText('Ricardo Izecson dos Santos Leite')
  await expect(page.getByRole('button', { name: /share your result/i })).toHaveCount(0)
  await page.getByLabel(/enter your nickname to save this result/i).fill('ShapeReader')
  await page.getByRole('button', { name: /save score/i }).click()
  await expect(page.getByRole('heading', { name: /lineup score saved/i })).toBeVisible()
  await expect(page.getByRole('table', { name: /today leaderboard/i })).toContainText('ShapeReader')
  await expect(page.getByRole('button', { name: /share your result/i })).toBeVisible()
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => Reflect.set(window, '__lineupDailyShared', data),
    })
  })
  await page.getByRole('button', { name: /share your result/i }).click()
  expect(await page.evaluate(() => Reflect.get(window, '__lineupDailyShared'))).toEqual({
    title: 'Leo Guessi — Lineup of the Day',
    text: `I scored 20/100 in Leo Guessi’s Lineup of the Day — rank #1 on ${dailyDate} UTC.`,
    url: 'http://127.0.0.1:4175/',
  })
})

test('gates the lineup leaderboard share by verified daily nickname', async ({ page }) => {
  const dailyBoards = {
    today: [{ rank: 1, nickname: 'ShapeReader', value: 20, gamesPlayed: 1 }],
    cumulative: [{ rank: 1, nickname: 'ShapeReader', value: 20, gamesPlayed: 1 }],
    average: [],
    best: [{ rank: 1, nickname: 'ShapeReader', value: 20, gamesPlayed: 1 }],
  }
  await page.route('**/api/functions/v1/lineup-game**', async (route) => {
    const request = route.request()
    if (new URL(request.url()).searchParams.get('action') !== 'leaderboard-hub') {
      await route.fallback()
      return
    }
    const { nickname } = request.postDataJSON()
    if (nickname !== 'ShapeReader') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ eligible: false, date: '2026-08-05' }) })
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      eligible: true,
      date: '2026-08-05',
      nickname,
      dailyBoards,
      challengeBoards: dailyBoards,
    }) })
  })

  await page.getByRole('button', { name: /check the leaderboard/i }).click()
  await page.getByRole('button', { name: /guess the lineup/i }).click()
  await page.getByLabel('Public nickname').fill('Unknown')
  await page.getByRole('button', { name: /check the leaderboard/i }).click()
  await expect(page.getByText(/Guess today’s Lineup of the Day/i)).toBeVisible()
  await expect(page.getByLabel('Unlocked leaderboards')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /share your result/i })).toHaveCount(0)

  await page.getByLabel('Public nickname').fill('ShapeReader')
  await page.getByRole('button', { name: /check the leaderboard/i }).click()
  await expect(page.getByLabel('Unlocked leaderboards')).toBeVisible()
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => Reflect.set(window, '__lineupHubShared', data),
    })
  })
  await page.getByRole('button', { name: /share your result/i }).click()
  expect(await page.evaluate(() => Reflect.get(window, '__lineupHubShared'))).toEqual({
    title: 'Leo Guessi — Lineup of the Day',
    text: 'I scored 20/100 in Leo Guessi’s Lineup of the Day — rank #1 on 2026-08-05 UTC.',
    url: 'http://127.0.0.1:4175/',
  })
})

test('plays ten distinct lineup matches and submits the lineup challenge', async ({ page }) => {
  const boards = {
    today: [{ rank: 1, nickname: 'Tactics', value: 0, gamesPlayed: 1 }],
    gamesPlayed: [{ rank: 1, nickname: 'Tactics', value: 1, gamesPlayed: 1 }],
    average: [],
    best: [{ rank: 1, nickname: 'Tactics', value: 0, gamesPlayed: 1 }],
  }
  await page.route('**/api/functions/v1/lineup-game**', async (route) => {
    const request = route.request()
    expect(new URL(request.url()).searchParams.get('action')).toBe('challenge-result')
    const body = request.postDataJSON()
    expect(body.nickname).toBe('Tactics')
    expect(body.rounds).toHaveLength(10)
    expect(body.rounds.every((round: { outcome: string }) => round.outcome === 'gave-up')).toBe(true)
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ date: '2026-08-05', points: 0, boards }) })
  })

  await page.getByRole('button', { name: /^10-round lineup challenge/i }).click()
  await page.getByRole('button', { name: /kick off/i }).click()
  await page.getByRole('button', { name: /let's go/i }).click()
  const matches = new Set<string>()
  for (let round = 0; round < 10; round += 1) {
    matches.add(await page.locator('.lineup-match-card h1').innerText())
    await page.getByRole('button', { name: /give up and reveal/i }).click()
    await expect(page.getByTestId('lineup-answer-reveal')).toBeVisible()
    await page.getByRole('button', { name: round === 9 ? /see final results/i : /next lineup/i }).click()
  }
  expect(matches.size).toBe(10)
  await expect(page.getByRole('heading', { name: /ten teamsheets completed/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /share your result/i })).toHaveCount(0)
  await page.getByLabel('Public nickname').fill('Tactics')
  await page.getByRole('button', { name: /save score & view boards/i }).click()
  await expect(page.getByText('Lineup history updated.')).toBeVisible()
  await expect(page.getByRole('table', { name: /lineup round results/i }).getByRole('row')).toHaveCount(11)
  await expect(page.getByRole('table', { name: /today leaderboard/i })).toContainText('Tactics')
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => Reflect.set(window, '__lineupChallengeShared', data),
    })
  })
  await page.getByRole('button', { name: /share your result/i }).click()
  expect(await page.evaluate(() => Reflect.get(window, '__lineupChallengeShared'))).toEqual({
    title: 'Leo Guessi — 10-round lineup challenge',
    text: 'I scored 0/1,000 in Leo Guessi’s 10-round lineup challenge and identified 0/10 missing players.',
    url: 'http://127.0.0.1:4175/',
  })
})

test('keeps the portrait lineup pitch inside a 390px viewport without autofocus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: /^10-round lineup challenge/i }).click()
  await page.getByRole('button', { name: /kick off/i }).click()
  await page.getByRole('button', { name: /let's go/i }).click()
  const bounds = await page.locator('.lineup-pitch').boundingBox()
  expect(bounds).not.toBeNull()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390)
  await expect(page.getByLabel(/who is missing/i)).not.toBeFocused()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBe(0)
})

test('keeps daily errors inside the guide and leaves local modes available', async ({ page }) => {
  await page.route('**/api/functions/v1/daily-game**', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Daily service is offline for maintenance.' }),
    }),
  )

  await page.getByRole('button', { name: /kick off/i }).click()
  await page.getByRole('button', { name: /let's go/i }).click()
  await expect(page.getByRole('alert')).toHaveText('Daily service is offline for maintenance.')
  await page.getByRole('button', { name: /back/i }).click()
  await page.getByRole('button', { name: /10-round challenge/i }).click()
  await expect(page.getByRole('button', { name: /hardcore/i })).toBeEnabled()
})

test('gives independent browsers the same daily player and clue set', async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()])
  const pages = await Promise.all(contexts.map((context) => context.newPage()))
  try {
    await Promise.all(
      pages.map(async (dailyPage) => {
        await dailyPage.addInitScript(() => {
          Math.random = () => 0.999
        })
        await dailyPage.route('**/api/functions/v1/daily-game**', (route) =>
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              date: '2026-07-29',
              expiresAt: '2099-07-30T00:00:00.000Z',
              playerId: 'lionel-messi-28003',
              clueSeed: 0,
              rosterVersion: 'test-roster',
              attemptToken: `${'a'.repeat(64)}.${'b'.repeat(64)}`,
            }),
          }),
        )
        await dailyPage.goto('/')
        await dailyPage.getByRole('button', { name: /kick off/i }).click()
        await dailyPage.getByRole('button', { name: /let's go/i }).click()
      }),
    )

    const [firstClue, secondClue] = await Promise.all(
      pages.map((dailyPage) => dailyPage.locator('.clue-card').first().innerText()),
    )
    expect(secondClue).toBe(firstClue)
    await Promise.all(pages.map((dailyPage) => expect(dailyPage.getByText('1 / 1')).toBeVisible()))
  } finally {
    await Promise.all(contexts.map((context) => context.close()))
  }
})

test('starts a Normal challenge, deducts misses, reveals clues and accepts the answer', async ({ page }) => {
  await startGame(page)
  await expect(page.getByText('1 / 10')).toBeVisible()
  await expect(page.getByTestId('available-score')).toHaveText('100')
  await expect(page.locator('.scorebar-points')).toHaveText(/for100PTS/i)
  await expect(page.getByText('Previous guesses')).toHaveCount(0)

  await page.getByLabel(/guess now/i).fill('David Beckham')
  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page.getByTestId('available-score')).toHaveText('90')
  await expect(page.locator('.previous-guesses-inline')).toHaveText('David Beckham.')

  await page.getByRole('button', { name: /next clue/i }).click()
  await expect(page.getByTestId('available-score')).toHaveText('70')

  await page.getByLabel(/guess now/i).fill('Lionel Messi')
  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page.getByTestId('answer-reveal')).toContainText('Lionel Messi')
  await expect(page.getByTestId('answer-reveal')).toContainText('70')
})

test('does not summon the keyboard by focusing the guess input on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await startGame(page)
  const input = page.getByLabel(/guess now/i)
  await expect(input).not.toBeFocused()
  await input.fill('David Beckham')
  await expect(input).toBeFocused()
  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(input).not.toBeFocused()
  await page.getByRole('button', { name: /next clue/i }).click()
  await expect(input).not.toBeFocused()
})

test('suggests in-scope players after three contiguous matching characters', async ({ page }) => {
  await startGame(page)
  const input = page.getByLabel(/guess now/i)

  await input.fill('Be')
  await expect(page.getByRole('listbox', { name: 'Player suggestions' })).toHaveCount(0)

  await input.fill('Bec')
  const suggestions = page.getByRole('listbox', { name: 'Player suggestions' })
  await expect(suggestions).toBeVisible()
  await expect(suggestions.getByRole('option', { name: /David Beckham/ })).toBeVisible()

  await input.press('ArrowDown')
  await input.press('Enter')
  await expect(input).toHaveValue('David Beckham')
  await expect(suggestions).toHaveCount(0)
})

test('giving up reveals the answer and scores zero', async ({ page }) => {
  await startGame(page)
  await page.getByRole('button', { name: 'Give up' }).click()
  await expect(page.getByTestId('answer-reveal')).toContainText('Lionel Messi')
  await expect(page.getByTestId('answer-reveal')).toContainText('0')
  await expect(page.getByRole('button', { name: /next player/i })).toBeVisible()
  await expect(page.getByText(/review all five clues/i)).toBeVisible()
})

test('persists and resumes an unfinished game under the football save', async ({ page }) => {
  await startGame(page)
  await page.getByLabel(/guess now/i).fill('David Beckham')
  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page.getByTestId('available-score')).toHaveText('90')

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Exit' }).click()
  await expect(page.getByRole('button', { name: /continue unfinished/i })).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: /continue unfinished/i }).click()
  await expect(page.getByTestId('available-score')).toHaveText('90')
  await expect(page.locator('.previous-guesses-inline')).toContainText('David Beckham')
})

test('completes ten rounds, submits its nickname and persists a high score', async ({ page }) => {
  let resultAttempts = 0
  const challengeBoards = {
    today: [{ rank: 1, nickname: 'LeoFan', value: 1000, gamesPlayed: 1 }],
    gamesPlayed: [{ rank: 1, nickname: 'LeoFan', value: 1, gamesPlayed: 1 }],
    average: [],
    best: [{ rank: 1, nickname: 'LeoFan', value: 1000, gamesPlayed: 1 }],
  }
  await page.route('**/api/functions/v1/daily-game**', async (route) => {
    const request = route.request()
    if (new URL(request.url()).searchParams.get('action') !== 'challenge-result') {
      await route.fallback()
      return
    }
    expect(request.postDataJSON()).toMatchObject({
      nickname: 'LeoFan',
      pool: 'normal',
      rounds: Array.from({ length: 10 }, () => ({
        outcome: 'correct',
        cluesUsed: 1,
        incorrectGuesses: 0,
      })),
    })
    resultAttempts += 1
    if (resultAttempts === 1) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Could not save this game yet.' }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        date: new Date().toISOString().slice(0, 10),
        pool: 'normal',
        points: 1000,
        boards: challengeBoards,
      }),
    })
  })
  await startGame(page)
  for (const [index, answer] of firstTenAnswers.entries()) {
    await page.getByLabel(/guess now/i).fill(answer)
    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(page.getByTestId('answer-reveal')).toContainText('100')
    await page.getByRole('button', { name: index === 9 ? /see final results/i : /next player/i }).click()
  }

  await expect(page.getByText("That’s the final whistle.")).toBeVisible()
  await expect(page.getByText('/ 1000')).toBeVisible()
  await expect(page.getByText('New personal best.')).toBeVisible()
  await expect(page.getByRole('button', { name: /switch player pool/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /back to home page/i })).toBeVisible()
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toBe('Return home without submitting this score to the leaderboard?')
    await dialog.dismiss()
  })
  await page.getByRole('button', { name: /leo guessi/i }).click()
  await expect(page.getByText("That’s the final whistle.")).toBeVisible()
  await expect(page.getByRole('button', { name: /share your result/i })).toHaveCount(0)
  await page.getByLabel('Public nickname').fill('LeoFan')
  await expect(page.getByRole('button', { name: /share your result/i })).toHaveCount(0)
  await page.getByRole('button', { name: /save score & view boards/i }).click()
  await expect(page.getByRole('alert')).toHaveText('Could not save this game yet.')
  await expect(page.getByRole('button', { name: /share your result/i })).toHaveCount(0)
  await page.getByRole('button', { name: /save score & view boards/i }).click()
  await expect(page.getByRole('heading', { name: /now share your result/i })).toBeVisible()
  await expect(page.getByRole('table', { name: /today leaderboard/i })).toContainText('LeoFan')

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          Reflect.set(window, '__copiedLink', text)
        },
      },
    })
  })
  await page.getByRole('button', { name: /share your result/i }).click()
  await expect(page.getByRole('status')).toHaveText('Link copied.')
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__copiedLink'))).toBe(
    'http://127.0.0.1:4175/',
  )

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error('Clipboard unavailable')
        },
      },
    })
  })
  await page.getByRole('button', { name: /share your result/i }).click()
  await expect(page.getByRole('status')).toHaveText(
    'Couldn’t share or copy the link. Copy it from your address bar.',
  )

  await page.getByRole('button', { name: /back to home page/i }).click()
  await expect(page.getByText('Normal best')).toHaveCount(0)
  await expect(page.getByText('Your best 10-round score')).toHaveCount(0)
})
