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
  await page.getByRole('button', { name: /kick off/i }).click()
  await expect(page.getByRole('heading', { name: /know your three moves/i })).toBeVisible()
  await page.getByRole('button', { name: /let's go/i }).click()
}

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
