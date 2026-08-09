begin;

select plan(24);

select has_table('public', 'lineup_daily_pool', 'lineup daily pool exists');
select has_table('public', 'lineup_daily_challenges', 'lineup daily challenges exist');
select has_table('public', 'lineup_daily_results', 'lineup daily results exist');
select has_table('public', 'lineup_daily_nickname_claims', 'lineup nickname locks exist');
select has_table('public', 'lineup_challenge_results', 'lineup challenge history exists');
select has_table('public', 'lineup_daily_archives', 'lineup archives exist');
select has_function(
  'public', 'submit_locked_lineup_daily_result',
  array['date', 'text', 'text', 'smallint', 'text', 'smallint'],
  'atomic lineup daily submission exists'
);

select is(
  (select count(*)::integer from public.lineup_daily_pool where active),
  136,
  'active lineup pool contains exactly 136 matches'
);
select is(
  (select count(distinct roster_version)::integer from public.lineup_daily_pool where active),
  1,
  'active lineup pool has exactly one roster version'
);
select ok(
  (select active = false from public.lineup_daily_pool where match_id = 'tm-1067642'),
  'a retained pre-2005 pool row is inactive'
);
select ok(
  (select active = true from public.lineup_daily_pool where match_id = 'tm-53455'),
  'a 2005/06 pool row is active'
);
select is(
  (select count(*)::integer from public.lineup_daily_pool
   where cardinality(starter_ids) <> 22),
  0,
  'every pool match has 22 starters'
);
select is(
  (select count(*)::integer from public.lineup_daily_pool p
   where (select count(distinct starter_id) from unnest(p.starter_ids) starter_id) <> 22),
  0,
  'every pool match has 22 unique starters'
);

insert into public.lineup_daily_challenges (
  challenge_date, match_id, missing_player_id, roster_version
)
select date '2099-01-02', match_id, starter_ids[1], roster_version
from public.lineup_daily_pool where match_id = 'tm-1067642';

select is(
  (select match_id from public.lineup_daily_challenges where challenge_date = date '2099-01-02'),
  'tm-1067642',
  'historical challenge can still reference an inactive pool row'
);

select ok((select relrowsecurity from pg_class where oid = 'public.lineup_daily_pool'::regclass), 'lineup pool has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.lineup_daily_challenges'::regclass), 'lineup challenges have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.lineup_daily_results'::regclass), 'lineup daily results have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.lineup_daily_nickname_claims'::regclass), 'lineup nickname claims have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.lineup_challenge_results'::regclass), 'lineup challenge results have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.lineup_daily_archives'::regclass), 'lineup archives have RLS');

insert into public.lineup_daily_challenges (
  challenge_date, match_id, missing_player_id, roster_version
)
select date '2099-01-01', match_id, starter_ids[1], roster_version
from public.lineup_daily_pool order by ranking limit 1;

insert into public.daily_challenges (
  challenge_date, player_id, clue_seed, roster_version
)
select date '2099-01-01', player_id, 1, roster_version
from public.daily_player_pool order by ranking limit 1;

select matches(
  public.submit_locked_daily_result(
    date '2099-01-01', 'same-browser', 'Same Nick', 100, 'correct', 1, 0
  ),
  '^[0-9a-f-]{36}$',
  'the player daily accepts the shared browser and nickname'
);

select matches(
  public.submit_locked_lineup_daily_result(
    date '2099-01-01', 'same-browser', 'Same Nick', 80, 'correct', 1
  ),
  '^[0-9a-f-]{36}$',
  'the lineup nickname/browser can submit independently of player tables'
);

select is(
  (select count(*)::integer from public.daily_results where challenge_date = date '2099-01-01') +
  (select count(*)::integer from public.lineup_daily_results where challenge_date = date '2099-01-01'),
  2,
  'player and lineup daily results coexist for the same date and identity'
);

select is(
  public.submit_locked_lineup_daily_result(
    date '2099-01-01', 'same-browser', 'Other Nick', 100, 'correct', 0
  ),
  'participant-used',
  'a lineup browser is locked independently for the date'
);

select * from finish();
rollback;
