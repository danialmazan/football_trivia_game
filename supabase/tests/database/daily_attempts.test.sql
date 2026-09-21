begin;

select plan(22);

select has_table('public', 'daily_attempts', 'player daily attempts exist');
select has_table('public', 'lineup_daily_attempts', 'lineup daily attempts exist');
select has_function('public', 'start_daily_attempt', array['date', 'text', 'text', 'jsonb', 'boolean'], 'player attempt start is atomic');
select has_function('public', 'start_lineup_daily_attempt', array['date', 'text', 'text', 'jsonb', 'boolean'], 'lineup attempt start is atomic');
select has_function('public', 'resolve_daily_attempt', array['uuid', 'integer', 'smallint', 'text', 'smallint', 'smallint'], 'player resolution is atomic');
select has_function('public', 'resolve_lineup_daily_attempt', array['uuid', 'integer', 'smallint', 'text', 'smallint', 'smallint[]', 'smallint'], 'lineup resolution is atomic');
select has_function('public', 'expire_open_daily_attempts', array['date'], 'player expiry exists');
select has_function('public', 'expire_open_lineup_daily_attempts', array['date'], 'lineup expiry exists');
select ok((select relrowsecurity from pg_class where oid = 'public.daily_attempts'::regclass), 'player attempts have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.lineup_daily_attempts'::regclass), 'lineup attempts have RLS');
select is(
  (select count(*)::integer from public.daily_attempts where result_id is not null),
  (select count(*)::integer from public.daily_results),
  'historical player results are backfilled'
);
select is(
  (select count(*)::integer from public.lineup_daily_attempts where result_id is not null),
  (select count(*)::integer from public.lineup_daily_results),
  'historical lineup results are backfilled'
);

insert into public.daily_challenges (challenge_date, player_id, clue_seed, roster_version)
select date '2099-12-01', player_id, 1, roster_version
from public.daily_player_pool order by ranking limit 1;

select is(
  public.start_daily_attempt(date '2099-12-01', 'browser-a', 'Dani FC',
    '{"clueLevel":1,"incorrectGuesses":[],"normalizedIncorrectGuesses":[]}'::jsonb, false)->>'access',
  'true', 'first player start owns the attempt'
);
select is(
  public.start_daily_attempt(date '2099-12-01', 'browser-b', '  DANI   FC ',
    '{"clueLevel":1,"incorrectGuesses":[],"normalizedIncorrectGuesses":[]}'::jsonb, false)->>'access',
  'false', 'normalized nickname requires cross-browser confirmation'
);
select is(
  public.start_daily_attempt(date '2099-12-01', 'browser-b', 'dani fc',
    '{"clueLevel":1,"incorrectGuesses":[],"normalizedIncorrectGuesses":[]}'::jsonb, true)->>'access',
  'true', 'confirmed browser joins the same attempt'
);
select is(
  cardinality((select participant_hashes from public.daily_attempts where challenge_date = date '2099-12-01')),
  2, 'both player browsers are recorded'
);
select matches(
  public.resolve_daily_attempt(
    (select id from public.daily_attempts where challenge_date = date '2099-12-01'),
    0, 0, 'correct', 5, 20
  ), '^[0-9a-f-]{36}$', 'zero-point correct player result resolves atomically'
);
select is(
  (select status from public.daily_attempts where challenge_date = date '2099-12-01'),
  'resolved', 'player attempt is resolved'
);
select ok(
  (select progress is null from public.daily_attempts where challenge_date = date '2099-12-01'),
  'resolved progress is cleared'
);

insert into public.lineup_daily_challenges (challenge_date, match_id, missing_player_id, roster_version)
select date '2099-12-01', match_id, starter_ids[1], roster_version
from public.lineup_daily_pool where active order by ranking limit 1;

select is(
  public.start_lineup_daily_attempt(date '2099-12-01', 'lineup-browser', 'Lineup Dani',
    '{"cluesUsed":0,"clueIncorrectGuessCounts":[],"incorrectGuesses":[],"normalizedIncorrectGuesses":[]}'::jsonb, false)->>'access',
  'true', 'lineup attempt starts independently'
);
select is(
  public.expire_open_lineup_daily_attempts(date '2100-01-01'),
  1, 'midnight expiry resolves the open lineup attempt'
);
select is(
  (select points from public.lineup_daily_results where challenge_date = date '2099-12-01'),
  0::smallint, 'expired lineup result is recorded with zero points'
);

select * from finish();
rollback;
