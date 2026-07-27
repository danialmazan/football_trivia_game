# Leo Guessi

**Can you become the G.O.A.T. of player guessing?**

Leo Guessi is a local, browser-based football player guessing game covering the
top divisions of England, Spain, Italy, Germany, and France. Each round reveals
five progressively easier clues while the available score falls from 100 to 20.
The browser makes no statistics requests: the 800-player snapshot and 189 club
badges are bundled with the project.

## Run locally

Node.js 20 or newer is required.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Verify

```bash
npm test
npm run data:validate
npm run build
npm run test:e2e
```

Install Playwright's Chromium once if needed:

```bash
npx playwright install chromium
```

## Rules

The five clues are:

1. A randomly selected Big-Five club with at least 50 league appearances, plus
   every decade of the player's complete Big-Five career.
2. The senior national team for which the player has the most caps.
3. Up to four exact club and national-team title groups. A titleless player
   receives Champions League appearances and senior caps instead.
4. Broad position and primary role.
5. Common-name initials.

The bases are 100, 80, 60, 40, and 20 points. Each distinct incorrect guess
costs a cumulative 10 points. Empty, duplicated, invalid, or genuinely ambiguous
answers are not penalized.

Full names, unique surnames, common football names, mononyms, accent-insensitive
spellings, and curated aliases are accepted. Ambiguous names such as `Ronaldo`
require a more specific answer.

## Modes and pools

- **Challenge:** ten repeat-free rounds, maximum 1,000 points.
- **Endless:** no repeats until the selected pool is exhausted, then a clearly
  announced new cycle begins.
- **Practice:** an endless session filtered by the player's busiest eligible
  decade or by a league in which the player made at least 50 appearances. A
  league practice round always uses a Clue 1 club from that league.
- **Normal:** the top 250 players in the deterministic recognition ranking.
- **Hardcore:** the top 800 players, including all 250 Normal players.

Every player has at least 150 combined Big-Five league appearances, a 50-match
club, a senior international cap, and at least one Big-Five appearance in
1995–96 or later. Eligible appearances before 1995–96 remain part of the career
total.

## Architecture

- `src/data`: football types, the generated snapshot, provenance, and validation.
- `src/game`: sport-neutral scoring and round state plus football eligibility,
  ranking, selection, matching, persistence, and clue construction.
- `src/components`: accessible responsive screens and clue presentation.
- `scripts`: deterministic data generation and local asset bundling.
- `e2e`: desktop and mobile user-flow tests.

Scores, preferences, endless totals, and unfinished games use the football-only
local-storage key `leo-guessi:football-trivia:v1`.

See [DATA_SOURCES.md](DATA_SOURCES.md) for the source and refresh methodology.
