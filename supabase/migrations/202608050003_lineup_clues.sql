alter table public.lineup_daily_results
  add column clues_used smallint not null default 0 check (clues_used between 0 and 2),
  add column clue_incorrect_guess_counts jsonb not null default '[]'::jsonb
    check (jsonb_typeof(clue_incorrect_guess_counts) = 'array');

drop function public.submit_locked_lineup_daily_result(
  date, text, text, smallint, text, smallint
);

create function public.submit_locked_lineup_daily_result(
  p_challenge_date date,
  p_participant_hash text,
  p_nickname text,
  p_points smallint,
  p_outcome text,
  p_clues_used smallint,
  p_clue_incorrect_guess_counts jsonb,
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
    points, outcome, clues_used, clue_incorrect_guess_counts, incorrect_guesses
  ) values (
    p_challenge_date, p_participant_hash, btrim(p_nickname), normalized,
    p_points, p_outcome, p_clues_used, p_clue_incorrect_guess_counts, p_incorrect_guesses
  ) returning id into inserted_id;

  update public.lineup_daily_nickname_claims
  set daily_result_id = inserted_id
  where challenge_date = p_challenge_date and normalized_nickname = normalized;

  return inserted_id::text;
end;
$$;

revoke all on function public.submit_locked_lineup_daily_result(
  date, text, text, smallint, text, smallint, jsonb, smallint
) from public, anon, authenticated;

grant execute on function public.submit_locked_lineup_daily_result(
  date, text, text, smallint, text, smallint, jsonb, smallint
) to service_role;
