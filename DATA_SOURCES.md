# Player data provenance

## Runtime snapshot

`src/data/players.json` is a generated local answer snapshot verified on
**2026-07-31**. It contains 1,473 players: the main-game roster contains exactly
800 Hardcore players and its first 250 form the Normal pool; additional players
support the filtered games. `src/data/playerSearch.json` contains 3,125 eligible
autocomplete players, including every answer player. The browser does not
contact a statistics service.

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
All 225 required badges are bundled under `public/club-badges`.

## Eligibility and counting

Only league rows from these five competition IDs are counted:

- `GB1` — Premier League
- `ES1` — La Liga
- `IT1` — Serie A
- `L1` — Bundesliga
- `FR1` — Ligue 1

The main-game generator requires 150 combined Big-Five league appearances, at
least one 50-match club, at least one senior international cap, and a Big-Five
season beginning in 1995 or later. Normal additionally requires at least 50
Big-Five league appearances in seasons beginning in 1995 or later. A qualifying
player's full available Big-Five career is counted for clues, including earlier
seasons. Lower divisions, cups, UEFA competition appearances, and non-Big-Five
clubs are excluded from league totals.

Each decade or league filter is independently ranked and contains exactly the
top 100 Normal players and top 300 Hardcore players. A player needs at least 50
Big-Five league appearances inside that selected decade or league. Those games
always last 10 rounds.

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
World Cup, and individual awards are not mapped. For the main Normal and
Hardcore rosters, recognition uses only Champions League appearances and title
campaigns from seasons beginning in 1995 or later; ranking ties use post-1995
Big-Five appearances and then the numeric source player ID.

Filtered rankings use only evidence from the selected slice. Decades count
Champions League appearances and eligible title campaigns inside the decade,
then decade appearances. League filters count Champions League appearances and
eligible club titles earned at clubs from that league, excluding national-team
titles, then appearances in the selected league.

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

Validation fails if a pool is undersized or malformed. It checks exact 250/800
main counts, exact 100/300 counts for every filter, the Normal subset invariant,
post-1995 and slice-specific thresholds, senior-team representation, title
records, deterministic ranking order, five clues, name uniqueness, autocomplete
coverage, and every required badge.

## Historical lineup snapshot

`src/data/lineupMatches.json` and `src/data/lineupSearch.json` are versioned
runtime snapshots generated on **2026-08-05**. The match snapshot contains 201
semifinal/final fixtures:

- 153 UEFA Champions League matches from 1995/96 through 2025/26. Every season
  contributes both semifinal legs and the final except 2019/20, whose Lisbon
  semifinals were single-leg matches.
- 24 EURO matches from 1996 through 2024.
- 24 FIFA World Cup matches from 1998 through 2026.

The primary source for fixture metadata, formations, starters, substitutes, and
shirt numbers is each public Transfermarkt match sheet. Every match retains its
match-sheet and competition-season URLs plus its verification date. Player names
are expanded from the CC0
[Transfermarkt datasets](https://github.com/dcaribou/transfermarkt-datasets)
player table where available. The 2,048-player autocomplete snapshot is the
union of all starters and registered substitutes in the included match sheets.

Pitch coordinates are the source formation coordinates normalized to the game's
0–100 pitch system. Kickoff values are source-local times. The IANA timezone is
derived from the named venue's location and retained instead of a fixed UTC
offset so historical daylight-saving rules remain valid.

Refresh the committed snapshots with:

```bash
npm run lineups:build
npm run lineups:validate
```

The builder caches source pages under the ignored `.cache/football/lineups`
directory and requires its cached CC0 `players.csv.gz` source or
`LINEUP_PLAYERS_CSV_GZ`. Validation enforces the exact 153/24/24 competition
counts, the 2019/20 single-leg exception, unique match IDs, two teams, 11 unique
starters per team, non-empty registered benches, formations, coordinates,
complete metadata, valid IANA zones, provenance URLs, and full autocomplete
coverage. The same build emits the versioned server-side daily pool migration.
