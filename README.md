# Leo Guessi

**Can you become the G.O.A.T. of player guessing?**

Leo Guessi is a browser-based football player guessing game covering the
top divisions of England, Spain, Italy, Germany, and France. Each round reveals
five progressively easier clues while the available score falls from 100 to 20.
The 800-player snapshot and 189 club badges are bundled with the project. Only
Player of the day uses an online service, for its shared UTC fixture and
leaderboard.

## Run locally

Node.js 20 or newer is required.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

The three local modes work without configuration. To use Player of the day,
copy `.env.example` to `.env.local` and supply the connected Supabase project
URL and publishable key.

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

With Deno, Docker, and the Supabase CLI installed, verify the online layer:

```bash
deno test supabase/functions/tests/ --allow-env
supabase start
supabase test db
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

- **Player of the day:** one Normal-pool player and one clue seed shared by
  everyone from 00:00:00 UTC to the next UTC midnight. A browser can submit one
  scored result and public nickname per day.
- **Challenge:** ten repeat-free rounds, maximum 1,000 points.
- **Endless:** no repeats until the selected pool is exhausted, then a clearly
  announced new cycle begins.
- **Practice by decade or league:** an endless session filtered by the player's
  busiest eligible decade or by a league in which the player made at least 50
  appearances. A league practice round always uses a Clue 1 club from that
  league.
- **Normal:** the top 250 players in the deterministic recognition ranking.
- **Hardcore:** the top 800 players, including all 250 Normal players.

Every player has at least 150 combined Big-Five league appearances, a 50-match
club, a senior international cap, and at least one Big-Five appearance in
1995–96 or later. Eligible appearances before 1995–96 remain part of the career
total.

## Architecture

- `src/data`: football types, the generated snapshot, provenance, and validation.
- `src/game`: sport-neutral scoring and round state plus football eligibility,
  ranking, selection, matching, persistence, daily API access, and clue
  construction.
- `src/components`: accessible responsive screens and clue presentation.
- `scripts`: deterministic data generation and local asset bundling.
- `supabase`: database migrations, the shared daily API, the midnight archive
  function, and the generated 250-player Normal pool.
- `e2e`: desktop and mobile user-flow tests.

Scores, preferences, anonymous installation ID, daily progress, endless totals,
and unfinished games use the football-only local-storage key
`leo-guessi:football-trivia:v1`. Existing v1 saves migrate additively and retain
personal records and unfinished challenges.

## Deploy the daily service

The Supabase project needs the CLI, a linked project, and the values from
`supabase/.env.example`.

```bash
npm run daily:pool
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase secrets set --env-file supabase/.env
supabase functions deploy daily-game
supabase functions deploy daily-maintenance
```

Create the secrets used by the `00:00 UTC` database cron invocation in the
Supabase SQL editor:

```sql
select vault.create_secret(
  'https://YOUR_PROJECT_REF.supabase.co',
  'leo_guessi_project_url'
);
select vault.create_secret(
  'YOUR_PUBLISHABLE_KEY',
  'leo_guessi_publishable_key'
);
select vault.create_secret(
  'THE_SAME_DAILY_MAINTENANCE_SECRET',
  'leo_guessi_maintenance_secret'
);
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as GitHub Actions
repository variables before the Pages build. The service-role key and selection
secrets never belong in GitHub Pages or any `VITE_` variable.

The cron function creates private, non-overwriting objects at
`daily-leaderboards/YYYY-MM-DD.csv` in the
`daily-leaderboard-archives` Storage bucket. Inspect or download them through
the Supabase Storage dashboard. The database retains the original dated rows
and `daily_archives` records, including header-only files for days with no
submissions.

See [DATA_SOURCES.md](DATA_SOURCES.md) for the source and refresh methodology.
