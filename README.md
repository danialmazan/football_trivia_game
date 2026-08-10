# Leo Guessi

**Can you become the G.O.A.T. of player guessing?**

Leo Guessi is a browser-based football player and lineup guessing game covering the
top divisions of England, Spain, Italy, Germany, and France. Each round reveals
five progressively easier clues while the available score falls from 100 to 20.
The generated answer catalog and club badges are bundled with the project.
Player of the day, Lineup of the day, and both 10-round challenges use the online
leaderboard services; the remaining modes continue to work locally.

## Run locally

Node.js 20 or newer is required.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

The local modes work without configuration. To use either daily mode,
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
deno test supabase/functions/tests/daily-rules-test.ts --allow-env
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
spellings, and curated aliases are accepted. A one-word display name is expanded
when it would collide with a word in another player’s name—for example,
`Ronaldo Nazario` and `Cristiano Ronaldo`.

## Modes and pools

- **Player of the day:** one Normal-pool player and one clue seed shared by
  everyone from 00:00:00 UTC to the next UTC midnight. The first submission
  locks that normalized nickname for the day, regardless of browser.
- **10-round challenge:** ten repeat-free rounds, maximum 1,000 points. A
  nickname can submit unlimited games from any browser; matching nicknames
  share one history.
- **Lineup of the day:** one historical semifinal or final and one missing
  starter shared worldwide from 00:00:00 UTC to the next UTC midnight.
- **10-round lineup challenge:** ten distinct historical matches with an
  independently selected missing starter in each, maximum 1,000 points.
- **Endless:** no repeats until the selected pool is exhausted, then a clearly
  announced new cycle begins.
- **By decade or league:** ten rounds from a filter-specific roster. A player
  needs 50 appearances inside the chosen decade or league. Normal uses the top
  100 filtered players and Hardcore the top 300; ranking uses only UCL
  appearances and eligible titles attributable to that filter.

- **Normal:** the top 250 players with at least 50 Big-Five appearances in
  seasons starting in 1995 or later.
- **Hardcore:** the top 800 players, including all 250 Normal players.

Player of the day and Lineup of the day share a 30-day answer cooldown. A
footballer used as either daily answer cannot be selected by either daily mode
again until day 31; already-created daily challenges are never rewritten.

Main-pool players have at least 150 combined Big-Five league appearances, a
50-match club, a senior international cap, and at least one Big-Five appearance
in 1995–96 or later. Eligible appearances before 1995–96 remain in career clues
and totals, but only post-1995 UCL appearances, eligible title campaigns and
Big-Five appearances influence the main-pool ranking.

Autocomplete always searches the expanded eligible catalog, even in Normal
mode. A suggested player outside the active answer roster is a valid incorrect
guess rather than an unavailable name.

Lineup modes retain a 201-match compatibility archive, but only 136 matches are
playable today: 103 Champions League matches, 15 EURO matches, and 18 World
Cup matches. The active seasons are Champions League 2005/06–2025/26, EURO
2008–2024, and World Cup 2006–2026. Earlier archived rows remain available for
historical challenge/result references but are inactive in the daily pool.
Every starter is equally eligible; substitutes are included in lineup
autocomplete but never appear on the pitch. Each distinct wrong lineup guess
costs 20 points and Give up scores zero.

## Architecture

- `src/data`: football types, the generated snapshot, provenance, and validation.
- `src/game`: sport-neutral scoring and round state plus football eligibility,
  ranking, selection, matching, persistence, daily API access, and clue
  construction.
- `src/components`: accessible responsive screens and clue presentation.
- `scripts`: deterministic data generation and local asset bundling.
- `supabase`: additive database migrations, separate player and lineup APIs,
  midnight archives, and generated daily pools.
- `e2e`: desktop and mobile user-flow tests.

Scores, nickname preference, anonymous installation ID, both daily games, endless
totals, completed-but-unsubmitted challenges, and unfinished games use the football-only local-storage key
`leo-guessi:football-trivia:v1`. Existing v1 saves migrate additively and retain
personal records and unfinished challenges. Lineup state uses separate additive
fields so existing player saves are preserved.

## Deploy the daily service

The Supabase project needs the CLI, a linked project, and the values from
`supabase/.env.example`.

Before applying the migrations, record the existing totals in the Supabase SQL
editor and compare them again immediately afterwards:

```sql
select count(*) as daily_results from public.daily_results;
select count(*) as daily_challenges from public.daily_challenges;
select count(*) as daily_archives from public.daily_archives;
select count(*) as challenge_results from public.challenge_results;
```

The new migrations are additive: they retain the original result, challenge,
archive, and player rows; add normalized nickname history and challenge tables;
and add a new version of the 250-player daily roster. Deploy the database first,
then the two Edge Functions, and the Pages frontend last so every frontend
response shape is supported when it goes live.

```bash
npm run daily:pool
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase secrets set --env-file supabase/.env
supabase functions deploy daily-game
supabase functions deploy lineup-game
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

The cron function creates private, non-overwriting Player-of-the-Day reports at
`daily-leaderboards/YYYY-MM-DD.csv` in the
`daily-leaderboard-archives` Storage bucket. Inspect or download them through
the Supabase Storage dashboard. The database retains the original dated rows
and `daily_archives` records, including header-only files for days with no
submissions.
Lineup-of-the-Day reports are independently archived at
`lineup-daily-leaderboards/YYYY-MM-DD.csv` in the same private bucket and tracked
in `lineup_daily_archives`.

See [DATA_SOURCES.md](DATA_SOURCES.md) for the source and refresh methodology.
