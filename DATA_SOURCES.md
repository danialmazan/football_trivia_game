# Player data provenance

## Runtime snapshot

`src/data/players.json` is a generated local snapshot verified on
**2026-07-27**. It contains exactly 800 eligible players; the first 250 form the
Normal pool. The browser does not contact a statistics service.

The primary source is the public CC0
[Football Datasets collection](https://www.kaggle.com/datasets/xfkzujqjvx97n/football-datasets).
The build uses its player-performance, player-profile, national-performance,
team-season, and team-detail exports. Transfermarkt's public player achievement
pages supplement campaign-level competition winners. The collection's
senior-national-team exports determine the primary team and cap count. Every
generated player stores its source URLs, a provenance note, source player ID,
and verification date.

Club badges come from the team-detail export. The otherwise unavailable
historical CD Logroñés badge is the public-domain mark from
[Wikimedia Commons](https://commons.wikimedia.org/wiki/File:CD_Logro%C3%B1%C3%A9s.png).
All 189 required badges are bundled under `public/club-badges`.

## Eligibility and counting

Only league rows from these five competition IDs are counted:

- `GB1` — Premier League
- `ES1` — La Liga
- `IT1` — Serie A
- `L1` — Bundesliga
- `FR1` — Ligue 1

The generator requires 150 combined league appearances, at least one 50-match
club, at least one senior international cap, and a Big-Five season beginning in
1995 or later. A qualifying player's full available Big-Five career is counted,
including earlier seasons. Lower divisions, cups, UEFA competition appearances,
and non-Big-Five clubs are excluded from league totals.

Champions League main-tournament appearances use competition ID `CL` and exclude
qualifiers. The recognition score is:

```text
1 × Champions League appearance
+ 40 × European Cup / Champions League title
+ 25 × UEFA Cup / Europa League or Cup Winners' Cup title
+ 15 × Big-Five domestic league title
+ 50 × senior World Cup title
+ 30 × senior continental national-team title
```

A title is credited only when an achievement row names the player in the winning
campaign. Qualifiers, domestic cups, super cups, Nations League, Olympics, Club
World Cup, and individual awards are not mapped. Ranking ties use Big-Five
appearances and then the numeric source player ID.

## Refresh

The committed snapshot is sufficient to run the game. A refresh is a maintainer
task requiring local copies of the source exports:

```bash
FOOTBALL_PERFORMANCES_CSV=/path/player_performances.csv \
FOOTBALL_PROFILES_CSV=/path/player_profiles.csv \
FOOTBALL_NATIONAL_PERFORMANCES_CSV=/path/player_national_performances.csv \
FOOTBALL_NATIONAL_TEAMS_CSV_GZ=/path/national_teams.csv.gz \
npm run data:manifest

npm run data:achievements

FOOTBALL_PERFORMANCES_CSV=/path/player_performances.csv \
FOOTBALL_PROFILES_CSV=/path/player_profiles.csv \
FOOTBALL_NATIONAL_PERFORMANCES_CSV=/path/player_national_performances.csv \
FOOTBALL_NATIONAL_TEAMS_CSV_GZ=/path/national_teams.csv.gz \
npm run data:refresh

FOOTBALL_TEAM_DETAILS_CSV=/path/team_details.csv npm run data:badges
npm run data:validate
npm test
npm run build
```

`FOOTBALL_DATA_CACHE` may be set instead of individual cache paths. Achievement
pages are cached so a ranking refresh is reviewable and repeatable.

Validation fails if either pool is undersized or malformed. It checks exact
250/800 counts, the Normal subset invariant, era overlap, appearance thresholds,
senior-team representation, title records, deterministic ranking order, five
clues, and every required badge.
