create or replace function public.daily_answer_source_id(p_answer_id text)
returns text
language sql
immutable
strict
set search_path = public
as $$
  select substring(p_answer_id from '([0-9]+)$');
$$;

revoke all on function public.daily_answer_source_id(text)
  from public, anon, authenticated;

create or replace function public.reserve_daily_challenge(
  p_challenge_date date,
  p_candidate_player_ids text[],
  p_clue_seed integer,
  p_roster_version text
)
returns table (
  challenge_date date,
  player_id text,
  clue_seed integer,
  roster_version text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate_player_id text;
  stored public.daily_challenges%rowtype;
begin
  if p_challenge_date is null
    or coalesce(cardinality(p_candidate_player_ids), 0) = 0
    or p_clue_seed is null
    or p_clue_seed not between 0 and 999999
    or nullif(btrim(p_roster_version), '') is null then
    raise exception 'A challenge date and candidate players are required.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('leo-guessi-daily-answer-cooldown', 0));

  select challenge.* into stored
  from public.daily_challenges challenge
  where challenge.challenge_date = p_challenge_date;
  if found then
    return query select stored.challenge_date, stored.player_id, stored.clue_seed, stored.roster_version;
    return;
  end if;

  foreach candidate_player_id in array p_candidate_player_ids loop
    if exists (
      select 1 from public.daily_player_pool pool
      where pool.player_id = candidate_player_id
        and pool.active
        and pool.roster_version = p_roster_version
    ) and not exists (
      select 1 from public.daily_challenges previous
      where previous.player_id = candidate_player_id
        and previous.challenge_date >= p_challenge_date - 30
        and previous.challenge_date < p_challenge_date
    ) and not exists (
      select 1 from public.lineup_daily_challenges previous
      where public.daily_answer_source_id(previous.missing_player_id) =
            public.daily_answer_source_id(candidate_player_id)
        and previous.challenge_date >= p_challenge_date - 30
        and previous.challenge_date <= p_challenge_date
    ) then
      insert into public.daily_challenges (
        challenge_date, player_id, clue_seed, roster_version
      ) values (
        p_challenge_date, candidate_player_id, p_clue_seed, p_roster_version
      ) returning * into stored;
      return query select stored.challenge_date, stored.player_id, stored.clue_seed, stored.roster_version;
      return;
    end if;
  end loop;

  raise exception 'No daily player is eligible after applying the 30-day answer cooldown.';
end;
$$;

revoke all on function public.reserve_daily_challenge(date, text[], integer, text)
  from public, anon, authenticated;
grant execute on function public.reserve_daily_challenge(date, text[], integer, text)
  to service_role;

create or replace function public.reserve_lineup_daily_challenge(
  p_challenge_date date,
  p_candidate_match_ids text[],
  p_starter_offset integer,
  p_roster_version text
)
returns table (
  challenge_date date,
  match_id text,
  missing_player_id text,
  roster_version text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate_match_id text;
  candidate_match public.lineup_daily_pool%rowtype;
  candidate_player_id text;
  starter_index integer;
  stored public.lineup_daily_challenges%rowtype;
begin
  if p_challenge_date is null
    or coalesce(cardinality(p_candidate_match_ids), 0) = 0
    or p_starter_offset is null
    or p_starter_offset not between 0 and 21
    or nullif(btrim(p_roster_version), '') is null then
    raise exception 'A challenge date and candidate matches are required.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('leo-guessi-daily-answer-cooldown', 0));

  select challenge.* into stored
  from public.lineup_daily_challenges challenge
  where challenge.challenge_date = p_challenge_date;
  if found then
    return query select stored.challenge_date, stored.match_id, stored.missing_player_id, stored.roster_version;
    return;
  end if;

  foreach candidate_match_id in array p_candidate_match_ids loop
    select pool.* into candidate_match
    from public.lineup_daily_pool pool
    where pool.match_id = candidate_match_id
      and pool.active
      and pool.roster_version = p_roster_version;
    if not found then continue; end if;

    for starter_index in 0..cardinality(candidate_match.starter_ids) - 1 loop
      candidate_player_id := candidate_match.starter_ids[
        1 + (p_starter_offset + starter_index) % cardinality(candidate_match.starter_ids)
      ];
      if not exists (
        select 1 from public.lineup_daily_challenges previous
        where previous.missing_player_id = candidate_player_id
          and previous.challenge_date >= p_challenge_date - 30
          and previous.challenge_date < p_challenge_date
      ) and not exists (
        select 1 from public.daily_challenges previous
        where public.daily_answer_source_id(previous.player_id) =
              public.daily_answer_source_id(candidate_player_id)
          and previous.challenge_date >= p_challenge_date - 30
          and previous.challenge_date <= p_challenge_date
      ) then
        insert into public.lineup_daily_challenges (
          challenge_date, match_id, missing_player_id, roster_version
        ) values (
          p_challenge_date, candidate_match.match_id, candidate_player_id, p_roster_version
        ) returning * into stored;
        return query select stored.challenge_date, stored.match_id, stored.missing_player_id, stored.roster_version;
        return;
      end if;
    end loop;
  end loop;

  raise exception 'No lineup answer is eligible after applying the 30-day answer cooldown.';
end;
$$;

revoke all on function public.reserve_lineup_daily_challenge(date, text[], integer, text)
  from public, anon, authenticated;
grant execute on function public.reserve_lineup_daily_challenge(date, text[], integer, text)
  to service_role;
