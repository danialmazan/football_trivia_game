begin;

select plan(10);

select has_table('public', 'daily_player_pool', 'daily player pool exists');
select has_table('public', 'daily_challenges', 'daily challenges table exists');
select has_table('public', 'daily_results', 'daily results table exists');
select has_table('public', 'daily_archives', 'daily archives table exists');

select is(
  (select count(*)::integer from public.daily_player_pool where active),
  250,
  'the active daily pool contains exactly the Normal 250'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.daily_player_pool'::regclass),
  'daily player pool has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.daily_challenges'::regclass),
  'daily challenges have RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.daily_results'::regclass),
  'daily results have RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.daily_archives'::regclass),
  'daily archives have RLS enabled'
);

select is(
  (select public from storage.buckets where id = 'daily-leaderboard-archives'),
  false,
  'the archive bucket is private'
);

select * from finish();
rollback;
