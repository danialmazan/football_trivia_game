begin;

select plan(10);

select has_function(
  'public', 'daily_answer_source_id', array['text'],
  'daily answer IDs can be matched across game namespaces'
);
select has_function(
  'public', 'reserve_daily_challenge', array['date', 'text[]', 'integer', 'text'],
  'player daily reservation function exists'
);
select has_function(
  'public', 'reserve_lineup_daily_challenge', array['date', 'text[]', 'integer', 'text'],
  'lineup daily reservation function exists'
);

select is(
  public.daily_answer_source_id('clarence-seedorf-4168'),
  public.daily_answer_source_id('tm-player-4168'),
  'player and lineup IDs resolve to the same source player'
);

insert into public.lineup_daily_challenges (
  challenge_date, match_id, missing_player_id, roster_version
)
select date '2098-01-01', match_id, 'tm-player-4168', roster_version
from public.lineup_daily_pool
where active and 'tm-player-4168' = any(starter_ids)
order by ranking
limit 1;

select is(
  (
    select player_id from public.reserve_daily_challenge(
      date '2098-01-31',
      array['clarence-seedorf-4168', 'kaka-3366'],
      1,
      (select roster_version from public.daily_player_pool where active order by ranking limit 1)
    )
  ),
  'kaka-3366',
  'an answer from exactly 30 days ago is excluded across daily modes'
);

select is(
  (
    select player_id from public.reserve_daily_challenge(
      date '2098-02-01',
      array['clarence-seedorf-4168', 'kaka-3366'],
      2,
      (select roster_version from public.daily_player_pool where active order by ranking limit 1)
    )
  ),
  'clarence-seedorf-4168',
  'the answer becomes eligible again on day 31'
);

insert into public.daily_challenges (
  challenge_date, player_id, clue_seed, roster_version
)
select date '2098-03-01', player_id, 3, roster_version
from public.daily_player_pool
where player_id = 'kaka-3366';

select isnt(
  (
    select missing_player_id from public.reserve_lineup_daily_challenge(
      date '2098-03-31',
      array[(
        select match_id from public.lineup_daily_pool
        where active and 'tm-player-3366' = any(starter_ids)
        order by ranking limit 1
      )],
      (
        select array_position(starter_ids, 'tm-player-3366') - 1
        from public.lineup_daily_pool
        where active and 'tm-player-3366' = any(starter_ids)
        order by ranking limit 1
      ),
      (select roster_version from public.lineup_daily_pool where active order by ranking limit 1)
    )
  ),
  'tm-player-3366',
  'lineup daily skips a player used by player daily within 30 days'
);

select is(
  (
    select missing_player_id from public.reserve_lineup_daily_challenge(
      date '2098-04-01',
      array[(
        select match_id from public.lineup_daily_pool
        where active and 'tm-player-3366' = any(starter_ids)
        order by ranking limit 1
      )],
      (
        select array_position(starter_ids, 'tm-player-3366') - 1
        from public.lineup_daily_pool
        where active and 'tm-player-3366' = any(starter_ids)
        order by ranking limit 1
      ),
      (select roster_version from public.lineup_daily_pool where active order by ranking limit 1)
    )
  ),
  'tm-player-3366',
  'lineup daily can use the player again on day 31'
);

insert into public.daily_challenges (
  challenge_date, player_id, clue_seed, roster_version
)
select date '2098-05-01', player_id, 4, roster_version
from public.daily_player_pool
where player_id = 'clarence-seedorf-4168';

select isnt(
  (
    select missing_player_id from public.reserve_lineup_daily_challenge(
      date '2098-05-01',
      array[(
        select match_id from public.lineup_daily_pool
        where active and 'tm-player-4168' = any(starter_ids)
        order by ranking limit 1
      )],
      (
        select array_position(starter_ids, 'tm-player-4168') - 1
        from public.lineup_daily_pool
        where active and 'tm-player-4168' = any(starter_ids)
        order by ranking limit 1
      ),
      (select roster_version from public.lineup_daily_pool where active order by ranking limit 1)
    )
  ),
  'tm-player-4168',
  'the two daily modes cannot reserve the same answer on one date'
);

select is(
  (
    select player_id from public.reserve_daily_challenge(
      date '2098-05-01',
      array['kaka-3366'],
      5,
      (select roster_version from public.daily_player_pool where active order by ranking limit 1)
    )
  ),
  'clarence-seedorf-4168',
  'an already-created daily challenge is preserved unchanged'
);

select * from finish();
rollback;
