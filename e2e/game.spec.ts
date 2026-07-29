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
  await page.getByRole('button', { name: /ten-round challenge/i }).click()
  await page.getByRole('button', { name: /kick off/i }).click()
  await expect(page.getByRole('heading', { name: /know your three moves/i })).toBeVisible()
  await page.getByRole('button', { name: /let's go/i }).click()
}

test('plays the shared daily player once and restores its leaderboard after reload', async ({ page }) => {
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
  await page.route('**/api/functions/v1/daily-game**', async (route) => {
    const request = route.request()
    const action = new URL(request.url()).searchParams.get('action')
    if (action === 'challenge') {
      await route.fulfill({
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
      })
      return
    }
    if (action === 'result') {
      const body = request.postDataJSON()
      expect(body).toMatchObject({
        challengeDate: '2026-07-29',
        nickname: 'LeoFan',
        outcome: 'correct',
        cluesUsed: 1,
        incorrectGuesses: 0,
      })
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          date: '2026-07-29',
          points: 100,
          rank: 1,
          leaderboard,
        }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ date: '2026-07-29', leaderboard }),
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
  await page.getByLabel(/join today’s leaderboard/i).fill('LeoFan')
  await page.getByRole('button', { name: /submit score/i }).click()

  await expect(page.getByRole('heading', { name: /score submitted/i })).toBeVisible()
  await expect(page.getByRole('table', { name: /daily leaderboard/i })).toContainText('LeoFan')
  await expect(page.getByText(/rank #1/i)).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: /kick off/i }).click()
  await expect(page.getByRole('heading', { name: /score submitted/i })).toBeVisible()
  await expect(page.getByRole('table', { name: /daily leaderboard/i })).toContainText('AwayDays')
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
  await page.getByRole('button', { name: /ten-round challenge/i }).click()
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

test('completes ten rounds and persists a high score', async ({ page }) => {
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

  await page.reload()
  await expect(page.getByText('Normal best').locator('..')).toContainText('1000')
})
