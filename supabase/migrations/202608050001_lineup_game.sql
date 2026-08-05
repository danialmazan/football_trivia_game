create table public.lineup_daily_pool (
  match_id text primary key,
  roster_version text not null,
  ranking integer not null unique check (ranking > 0),
  starter_ids text[] not null check (cardinality(starter_ids) = 22),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (array_position(starter_ids, null) is null)
);

create table public.lineup_daily_challenges (
  challenge_date date primary key,
  match_id text not null references public.lineup_daily_pool(match_id),
  missing_player_id text not null,
  roster_version text not null,
  created_at timestamptz not null default now()
);

create table public.lineup_daily_results (
  id uuid primary key default gen_random_uuid(),
  challenge_date date not null references public.lineup_daily_challenges(challenge_date),
  participant_hash text not null,
  nickname text not null check (
    char_length(btrim(nickname)) between 1 and 24
    and nickname !~ '[[:cntrl:]]'
  ),
  normalized_nickname text not null,
  points smallint not null check (points between 0 and 100),
  outcome text not null check (outcome in ('correct', 'gave-up')),
  incorrect_guesses smallint not null check (incorrect_guesses between 0 and 50),
  submitted_at timestamptz not null default now(),
  unique (challenge_date, participant_hash)
);

create table public.lineup_daily_nickname_claims (
  challenge_date date not null references public.lineup_daily_challenges(challenge_date),
  normalized_nickname text not null,
  display_nickname text not null,
  daily_result_id uuid references public.lineup_daily_results(id),
  claimed_at timestamptz not null default now(),
  primary key (challenge_date, normalized_nickname)
);

create table public.lineup_challenge_results (
  id uuid primary key default gen_random_uuid(),
  challenge_date date not null,
  nickname text not null check (
    char_length(btrim(nickname)) between 1 and 24
    and nickname !~ '[[:cntrl:]]'
  ),
  normalized_nickname text not null,
  points smallint not null check (points between 0 and 1000),
  rounds jsonb not null check (jsonb_typeof(rounds) = 'array' and jsonb_array_length(rounds) = 10),
  submitted_at timestamptz not null default now()
);

create table public.lineup_daily_archives (
  challenge_date date primary key references public.lineup_daily_challenges(challenge_date),
  object_path text not null unique,
  row_count integer not null check (row_count >= 0),
  created_at timestamptz not null default now()
);

create index lineup_daily_results_today_idx
  on public.lineup_daily_results (challenge_date, points desc, submitted_at asc);
create index lineup_daily_results_history_idx
  on public.lineup_daily_results (normalized_nickname, challenge_date);
create index lineup_challenge_results_today_idx
  on public.lineup_challenge_results (challenge_date, points desc, submitted_at asc);
create index lineup_challenge_results_history_idx
  on public.lineup_challenge_results (normalized_nickname, challenge_date);

create or replace function public.submit_locked_lineup_daily_result(
  p_challenge_date date,
  p_participant_hash text,
  p_nickname text,
  p_points smallint,
  p_outcome text,
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
    select 1 from public.lineup_daily_results
    where challenge_date = p_challenge_date
      and participant_hash = p_participant_hash
  ) then
    return 'participant-used';
  end if;

  insert into public.lineup_daily_nickname_claims (
    challenge_date, normalized_nickname, display_nickname
  ) values (
    p_challenge_date, normalized, btrim(p_nickname)
  ) on conflict (challenge_date, normalized_nickname) do nothing;

  if not found then return 'nickname-used'; end if;

  insert into public.lineup_daily_results (
    challenge_date, participant_hash, nickname, normalized_nickname,
    points, outcome, incorrect_guesses
  ) values (
    p_challenge_date, p_participant_hash, btrim(p_nickname), normalized,
    p_points, p_outcome, p_incorrect_guesses
  ) returning id into inserted_id;

  update public.lineup_daily_nickname_claims
  set daily_result_id = inserted_id
  where challenge_date = p_challenge_date and normalized_nickname = normalized;

  return inserted_id::text;
end;
$$;

alter table public.lineup_daily_pool enable row level security;
alter table public.lineup_daily_challenges enable row level security;
alter table public.lineup_daily_results enable row level security;
alter table public.lineup_daily_nickname_claims enable row level security;
alter table public.lineup_challenge_results enable row level security;
alter table public.lineup_daily_archives enable row level security;

revoke all on public.lineup_daily_pool from anon, authenticated;
revoke all on public.lineup_daily_challenges from anon, authenticated;
revoke all on public.lineup_daily_results from anon, authenticated;
revoke all on public.lineup_daily_nickname_claims from anon, authenticated;
revoke all on public.lineup_challenge_results from anon, authenticated;
revoke all on public.lineup_daily_archives from anon, authenticated;
revoke all on function public.submit_locked_lineup_daily_result(
  date, text, text, smallint, text, smallint
) from public, anon, authenticated;

grant execute on function public.submit_locked_lineup_daily_result(
  date, text, text, smallint, text, smallint
) to service_role;
