create table public.daily_attempts (
  id uuid primary key default gen_random_uuid(),
  challenge_date date not null references public.daily_challenges(challenge_date),
  nickname text not null check (
    char_length(btrim(nickname)) between 1 and 24 and nickname !~ '[[:cntrl:]]'
  ),
  normalized_nickname text not null,
  participant_hashes text[] not null check (cardinality(participant_hashes) > 0),
  status text not null default 'in_progress' check (status in ('in_progress', 'resolved', 'expired')),
  revision integer not null default 0 check (revision >= 0),
  progress jsonb,
  outcome text check (outcome in ('correct', 'gave-up')),
  points smallint check (points between 0 and 100),
  result_id uuid references public.daily_results(id),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  start_time_inferred boolean not null default false,
  unique (challenge_date, normalized_nickname)
);

create table public.lineup_daily_attempts (
  id uuid primary key default gen_random_uuid(),
  challenge_date date not null references public.lineup_daily_challenges(challenge_date),
  nickname text not null check (
    char_length(btrim(nickname)) between 1 and 24 and nickname !~ '[[:cntrl:]]'
  ),
  normalized_nickname text not null,
  participant_hashes text[] not null check (cardinality(participant_hashes) > 0),
  status text not null default 'in_progress' check (status in ('in_progress', 'resolved', 'expired')),
  revision integer not null default 0 check (revision >= 0),
  progress jsonb,
  outcome text check (outcome in ('correct', 'gave-up')),
  points smallint check (points between 0 and 100),
  result_id uuid references public.lineup_daily_results(id),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  start_time_inferred boolean not null default false,
  unique (challenge_date, normalized_nickname)
);

create index daily_attempts_status_date_idx on public.daily_attempts (status, challenge_date);
create index lineup_daily_attempts_status_date_idx on public.lineup_daily_attempts (status, challenge_date);

alter table public.daily_attempts enable row level security;
alter table public.lineup_daily_attempts enable row level security;
revoke all on public.daily_attempts from anon, authenticated;
revoke all on public.lineup_daily_attempts from anon, authenticated;

insert into public.daily_attempts (
  challenge_date, nickname, normalized_nickname, participant_hashes, status,
  progress, outcome, points, result_id, started_at, updated_at, resolved_at,
  start_time_inferred
)
select challenge_date, nickname, normalized_nickname, array[participant_hash],
  'resolved', null, outcome, points, id, submitted_at, submitted_at, submitted_at, true
from public.daily_results
on conflict (challenge_date, normalized_nickname) do nothing;

insert into public.lineup_daily_attempts (
  challenge_date, nickname, normalized_nickname, participant_hashes, status,
  progress, outcome, points, result_id, started_at, updated_at, resolved_at,
  start_time_inferred
)
select challenge_date, nickname, normalized_nickname, array[participant_hash],
  'resolved', null, outcome, points, id, submitted_at, submitted_at, submitted_at, true
from public.lineup_daily_results
on conflict (challenge_date, normalized_nickname) do nothing;

create or replace function public.start_daily_attempt(
  p_challenge_date date,
  p_participant_hash text,
  p_nickname text,
  p_progress jsonb,
  p_confirm_resume boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := public.normalize_leaderboard_nickname(p_nickname);
  existing public.daily_attempts%rowtype;
  owns_attempt boolean;
begin
  select * into existing from public.daily_attempts
  where challenge_date = p_challenge_date and p_participant_hash = any(participant_hashes)
  for update;
  if found and existing.normalized_nickname <> normalized then
    return jsonb_build_object('access', false, 'participantConflict', true, 'attempt', to_jsonb(existing));
  end if;

  select * into existing from public.daily_attempts
  where challenge_date = p_challenge_date and normalized_nickname = normalized
  for update;

  if found then
    owns_attempt := p_participant_hash = any(existing.participant_hashes);
    if existing.status = 'in_progress' and not owns_attempt and p_confirm_resume then
      update public.daily_attempts
      set participant_hashes = array_append(participant_hashes, p_participant_hash),
          updated_at = now()
      where id = existing.id
      returning * into existing;
      owns_attempt := true;
    end if;
    return jsonb_build_object(
      'access', owns_attempt,
      'attempt', to_jsonb(existing)
    );
  end if;

  insert into public.daily_nickname_claims (
    challenge_date, normalized_nickname, display_nickname
  ) values (p_challenge_date, normalized, btrim(p_nickname))
  on conflict (challenge_date, normalized_nickname) do nothing;
  if not found then
    select * into existing from public.daily_attempts
    where challenge_date = p_challenge_date and normalized_nickname = normalized;
    return jsonb_build_object('access', false, 'attempt', to_jsonb(existing));
  end if;

  insert into public.daily_attempts (
    challenge_date, nickname, normalized_nickname, participant_hashes, progress
  ) values (
    p_challenge_date, btrim(p_nickname), normalized, array[p_participant_hash], p_progress
  ) returning * into existing;
  return jsonb_build_object('access', true, 'attempt', to_jsonb(existing));
end;
$$;

create or replace function public.start_lineup_daily_attempt(
  p_challenge_date date,
  p_participant_hash text,
  p_nickname text,
  p_progress jsonb,
  p_confirm_resume boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := public.normalize_leaderboard_nickname(p_nickname);
  existing public.lineup_daily_attempts%rowtype;
  owns_attempt boolean;
begin
  select * into existing from public.lineup_daily_attempts
  where challenge_date = p_challenge_date and p_participant_hash = any(participant_hashes)
  for update;
  if found and existing.normalized_nickname <> normalized then
    return jsonb_build_object('access', false, 'participantConflict', true, 'attempt', to_jsonb(existing));
  end if;

  select * into existing from public.lineup_daily_attempts
  where challenge_date = p_challenge_date and normalized_nickname = normalized
  for update;

  if found then
    owns_attempt := p_participant_hash = any(existing.participant_hashes);
    if existing.status = 'in_progress' and not owns_attempt and p_confirm_resume then
      update public.lineup_daily_attempts
      set participant_hashes = array_append(participant_hashes, p_participant_hash),
          updated_at = now()
      where id = existing.id
      returning * into existing;
      owns_attempt := true;
    end if;
    return jsonb_build_object('access', owns_attempt, 'attempt', to_jsonb(existing));
  end if;

  insert into public.lineup_daily_nickname_claims (
    challenge_date, normalized_nickname, display_nickname
  ) values (p_challenge_date, normalized, btrim(p_nickname))
  on conflict (challenge_date, normalized_nickname) do nothing;
  if not found then
    select * into existing from public.lineup_daily_attempts
    where challenge_date = p_challenge_date and normalized_nickname = normalized;
    return jsonb_build_object('access', false, 'attempt', to_jsonb(existing));
  end if;

  insert into public.lineup_daily_attempts (
    challenge_date, nickname, normalized_nickname, participant_hashes, progress
  ) values (
    p_challenge_date, btrim(p_nickname), normalized, array[p_participant_hash], p_progress
  ) returning * into existing;
  return jsonb_build_object('access', true, 'attempt', to_jsonb(existing));
end;
$$;

create or replace function public.resolve_daily_attempt(
  p_attempt_id uuid,
  p_expected_revision integer,
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
  attempt public.daily_attempts%rowtype;
  inserted_id uuid;
begin
  select * into attempt from public.daily_attempts where id = p_attempt_id for update;
  if not found then return 'missing'; end if;
  if attempt.status <> 'in_progress' then return 'resolved'; end if;
  if attempt.revision <> p_expected_revision then return 'stale'; end if;

  insert into public.daily_results (
    challenge_date, participant_hash, nickname, normalized_nickname,
    points, outcome, clues_used, incorrect_guesses
  ) values (
    attempt.challenge_date, attempt.participant_hashes[1], attempt.nickname,
    attempt.normalized_nickname, p_points, p_outcome, p_clues_used,
    p_incorrect_guesses
  ) returning id into inserted_id;

  update public.daily_nickname_claims set daily_result_id = inserted_id
  where challenge_date = attempt.challenge_date
    and normalized_nickname = attempt.normalized_nickname;
  update public.daily_attempts set
    status = 'resolved', revision = revision + 1, progress = null,
    outcome = p_outcome, points = p_points, result_id = inserted_id,
    updated_at = now(), resolved_at = now()
  where id = attempt.id;
  return inserted_id::text;
end;
$$;

create or replace function public.resolve_lineup_daily_attempt(
  p_attempt_id uuid,
  p_expected_revision integer,
  p_points smallint,
  p_outcome text,
  p_clues_used smallint,
  p_clue_incorrect_guess_counts smallint[],
  p_incorrect_guesses smallint
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  attempt public.lineup_daily_attempts%rowtype;
  inserted_id uuid;
begin
  select * into attempt from public.lineup_daily_attempts where id = p_attempt_id for update;
  if not found then return 'missing'; end if;
  if attempt.status <> 'in_progress' then return 'resolved'; end if;
  if attempt.revision <> p_expected_revision then return 'stale'; end if;

  insert into public.lineup_daily_results (
    challenge_date, participant_hash, nickname, normalized_nickname, points,
    outcome, clues_used, clue_incorrect_guess_counts, incorrect_guesses
  ) values (
    attempt.challenge_date, attempt.participant_hashes[1], attempt.nickname,
    attempt.normalized_nickname, p_points, p_outcome, p_clues_used,
    to_jsonb(p_clue_incorrect_guess_counts), p_incorrect_guesses
  ) returning id into inserted_id;

  update public.lineup_daily_nickname_claims set daily_result_id = inserted_id
  where challenge_date = attempt.challenge_date
    and normalized_nickname = attempt.normalized_nickname;
  update public.lineup_daily_attempts set
    status = 'resolved', revision = revision + 1, progress = null,
    outcome = p_outcome, points = p_points, result_id = inserted_id,
    updated_at = now(), resolved_at = now()
  where id = attempt.id;
  return inserted_id::text;
end;
$$;

create or replace function public.expire_open_daily_attempts(p_before date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  attempt public.daily_attempts%rowtype;
  inserted_id uuid;
  expired_count integer := 0;
begin
  for attempt in select * from public.daily_attempts
    where status = 'in_progress' and challenge_date < p_before for update
  loop
    insert into public.daily_results (
      challenge_date, participant_hash, nickname, normalized_nickname,
      points, outcome, clues_used, incorrect_guesses
    ) values (
      attempt.challenge_date, attempt.participant_hashes[1], attempt.nickname,
      attempt.normalized_nickname, 0, 'gave-up',
      greatest(1, least(5, coalesce((attempt.progress->>'clueLevel')::integer, 1))),
      greatest(0, least(50, coalesce(jsonb_array_length(attempt.progress->'incorrectGuesses'), 0)))
    ) returning id into inserted_id;
    update public.daily_nickname_claims set daily_result_id = inserted_id
    where challenge_date = attempt.challenge_date and normalized_nickname = attempt.normalized_nickname;
    update public.daily_attempts set status = 'expired', revision = revision + 1,
      progress = null, outcome = 'gave-up', points = 0, result_id = inserted_id,
      updated_at = now(), resolved_at = now() where id = attempt.id;
    expired_count := expired_count + 1;
  end loop;
  return expired_count;
end;
$$;

create or replace function public.expire_open_lineup_daily_attempts(p_before date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  attempt public.lineup_daily_attempts%rowtype;
  inserted_id uuid;
  expired_count integer := 0;
  guess_counts smallint[];
begin
  for attempt in select * from public.lineup_daily_attempts
    where status = 'in_progress' and challenge_date < p_before for update
  loop
    select coalesce(array_agg(value::smallint order by ordinality), array[]::smallint[])
      into guess_counts
    from jsonb_array_elements_text(coalesce(attempt.progress->'clueIncorrectGuessCounts', '[]'::jsonb))
      with ordinality as values_with_order(value, ordinality);
    insert into public.lineup_daily_results (
      challenge_date, participant_hash, nickname, normalized_nickname, points,
      outcome, clues_used, clue_incorrect_guess_counts, incorrect_guesses
    ) values (
      attempt.challenge_date, attempt.participant_hashes[1], attempt.nickname,
      attempt.normalized_nickname, 0, 'gave-up',
      greatest(0, least(2, coalesce((attempt.progress->>'cluesUsed')::integer, 0))),
      to_jsonb(guess_counts),
      greatest(0, least(50, coalesce(jsonb_array_length(attempt.progress->'incorrectGuesses'), 0)))
    ) returning id into inserted_id;
    update public.lineup_daily_nickname_claims set daily_result_id = inserted_id
    where challenge_date = attempt.challenge_date and normalized_nickname = attempt.normalized_nickname;
    update public.lineup_daily_attempts set status = 'expired', revision = revision + 1,
      progress = null, outcome = 'gave-up', points = 0, result_id = inserted_id,
      updated_at = now(), resolved_at = now() where id = attempt.id;
    expired_count := expired_count + 1;
  end loop;
  return expired_count;
end;
$$;

revoke all on function public.start_daily_attempt(date, text, text, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.start_lineup_daily_attempt(date, text, text, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.resolve_daily_attempt(uuid, integer, smallint, text, smallint, smallint) from public, anon, authenticated;
revoke all on function public.resolve_lineup_daily_attempt(uuid, integer, smallint, text, smallint, smallint[], smallint) from public, anon, authenticated;
revoke all on function public.expire_open_daily_attempts(date) from public, anon, authenticated;
revoke all on function public.expire_open_lineup_daily_attempts(date) from public, anon, authenticated;

grant execute on function public.start_daily_attempt(date, text, text, jsonb, boolean) to service_role;
grant execute on function public.start_lineup_daily_attempt(date, text, text, jsonb, boolean) to service_role;
grant execute on function public.resolve_daily_attempt(uuid, integer, smallint, text, smallint, smallint) to service_role;
grant execute on function public.resolve_lineup_daily_attempt(uuid, integer, smallint, text, smallint, smallint[], smallint) to service_role;
grant execute on function public.expire_open_daily_attempts(date) to service_role;
grant execute on function public.expire_open_lineup_daily_attempts(date) to service_role;
