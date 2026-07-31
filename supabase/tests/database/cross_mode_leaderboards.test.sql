begin;

select plan(8);

select has_column(
  'public',
  'daily_results',
  'normalized_nickname',
  'daily history has a normalized nickname'
);
select has_table('public', 'daily_nickname_claims', 'daily nickname locks exist');
select has_table('public', 'challenge_results', 'challenge history exists');
select has_function(
  'public',
  'normalize_leaderboard_nickname',
  array['text'],
  'nickname normalization function exists'
);
select has_function(
  'public',
  'submit_locked_daily_result',
  array['date', 'text', 'text', 'smallint', 'text', 'smallint', 'smallint'],
  'atomic daily submission function exists'
);
select is(
  public.normalize_leaderboard_nickname('  Dani   FC '),
  'dani fc',
  'nickname normalization is case-insensitive and collapses whitespace'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.daily_nickname_claims'::regclass),
  'daily nickname locks have RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.challenge_results'::regclass),
  'challenge results have RLS enabled'
);

select * from finish();
rollback;
