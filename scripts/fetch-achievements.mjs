import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const cacheRoot = process.env.FOOTBALL_DATA_CACHE ?? join(root, '.cache', 'football')
const manifestPath =
  process.env.FOOTBALL_CANDIDATE_MANIFEST ?? join(cacheRoot, 'candidates.json')
const outputDir = process.env.FOOTBALL_ACHIEVEMENTS_CACHE ?? join(cacheRoot, 'achievements')
const concurrency = Number(process.env.FOOTBALL_FETCH_CONCURRENCY ?? 6)

if (!existsSync(manifestPath)) {
  throw new Error(`Missing candidate manifest: ${manifestPath}. Run npm run data:manifest first.`)
}

const candidates = JSON.parse(readFileSync(manifestPath, 'utf8'))
mkdirSync(outputDir, { recursive: true })
let nextIndex = 0
let completed = 0

async function fetchWithRetry(candidate) {
  const outputPath = join(outputDir, `${candidate.sourcePlayerId}.html`)
  if (existsSync(outputPath) && readFileSync(outputPath, 'utf8').includes('Titles &amp; achievements')) {
    return
  }
  const url = `https://www.transfermarkt.com/${candidate.slug}/erfolge/spieler/${candidate.sourcePlayerId}`
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36',
      },
    })
    if (response.ok) {
      const html = await response.text()
      if (html.includes('Titles &amp; achievements')) {
        writeFileSync(outputPath, html)
        return
      }
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 750))
  }
  throw new Error(`Could not fetch achievements for ${candidate.displayName}`)
}

async function worker() {
  while (nextIndex < candidates.length) {
    const index = nextIndex
    nextIndex += 1
    const candidate = candidates[index]
    await fetchWithRetry(candidate)
    completed += 1
    if (completed % 100 === 0 || completed === candidates.length) {
      console.log(`Achievements: ${completed}/${candidates.length}`)
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()))
