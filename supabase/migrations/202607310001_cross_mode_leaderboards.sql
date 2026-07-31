create or replace function public.normalize_leaderboard_nickname(value text)
returns text
language sql
immutable
strict
set search_path = public
as $$
  select lower(regexp_replace(btrim(value), '[[:space:]]+', ' ', 'g'));
$$;

alter table public.daily_results
  add column if not exists normalized_nickname text;

update public.daily_results
set normalized_nickname = public.normalize_leaderboard_nickname(nickname)
where normalized_nickname is null;

create index if not exists daily_results_nickname_history_idx
  on public.daily_results (normalized_nickname, challenge_date);

create table public.daily_nickname_claims (
  challenge_date date not null references public.daily_challenges(challenge_date),
  normalized_nickname text not null,
  display_nickname text not null,
  daily_result_id uuid references public.daily_results(id),
  claimed_at timestamptz not null default now(),
  primary key (challenge_date, normalized_nickname)
);

insert into public.daily_nickname_claims (
  challenge_date,
  normalized_nickname,
  display_nickname,
  daily_result_id,
  claimed_at
)
select distinct on (challenge_date, normalized_nickname)
  challenge_date,
  normalized_nickname,
  nickname,
  id,
  submitted_at
from public.daily_results
where normalized_nickname is not null
order by challenge_date, normalized_nickname, points desc, submitted_at asc
on conflict (challenge_date, normalized_nickname) do nothing;

create or replace function public.submit_locked_daily_result(
  p_challenge_date date,
  p_participant_hash text,
  p_nickname text,
  p_points smallint,
  p_outcome text,
  p_clues_used smallint,
  p_incorrect_guesses smallint
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := public.normalize_leaderboard_nickname(p_nickname);
  inserted_id uuid;
begin
  if exists (
    select 1 from public.daily_results
    where challenge_date = p_challenge_date
      and participant_hash = p_participant_hash
  ) then
    return 'participant-used';
  end if;

  insert into public.daily_nickname_claims (
    challenge_date,
    normalized_nickname,
    display_nickname
  ) values (
    p_challenge_date,
    normalized,
    btrim(p_nickname)
  )
  on conflict (challenge_date, normalized_nickname) do nothing;

  if not found then
    return 'nickname-used';
  end if;

  insert into public.daily_results (
    challenge_date,
    participant_hash,
    nickname,
    normalized_nickname,
    points,
    outcome,
    clues_used,
    incorrect_guesses
  ) values (
    p_challenge_date,
    p_participant_hash,
    btrim(p_nickname),
    normalized,
    p_points,
    p_outcome,
    p_clues_used,
    p_incorrect_guesses
  )
  returning id into inserted_id;

  update public.daily_nickname_claims
  set daily_result_id = inserted_id
  where challenge_date = p_challenge_date
    and normalized_nickname = normalized;

  return inserted_id::text;
end;
$$;

create table public.challenge_results (
  id uuid primary key default gen_random_uuid(),
  challenge_date date not null,
  pool text not null check (pool in ('normal', 'hardcore')),
  nickname text not null check (
    char_length(btrim(nickname)) between 1 and 24
    and nickname !~ '[[:cntrl:]]'
  ),
  normalized_nickname text not null,
  points smallint not null check (points between 0 and 1000),
  rounds jsonb not null check (jsonb_array_length(rounds) = 10),
  submitted_at timestamptz not null default now()
);

create index challenge_results_today_idx
  on public.challenge_results (challenge_date, pool, points desc, submitted_at asc);
create index challenge_results_history_idx
  on public.challenge_results (pool, normalized_nickname, challenge_date);

alter table public.daily_nickname_claims enable row level security;
alter table public.challenge_results enable row level security;

revoke all on public.daily_nickname_claims from anon, authenticated;
revoke all on public.challenge_results from anon, authenticated;
revoke all on function public.normalize_leaderboard_nickname(text)
  from public, anon, authenticated;
revoke all on function public.submit_locked_daily_result(
  date, text, text, smallint, text, smallint, smallint
) from public, anon, authenticated;

grant execute on function public.normalize_leaderboard_nickname(text) to service_role;
grant execute on function public.submit_locked_daily_result(
  date, text, text, smallint, text, smallint, smallint
) to service_role;
