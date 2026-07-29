create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create table public.daily_player_pool (
  player_id text primary key,
  roster_version text not null,
  ranking integer not null unique,
  active boolean not null default true
);

create table public.daily_challenges (
  challenge_date date primary key,
  player_id text not null references public.daily_player_pool(player_id),
  clue_seed integer not null check (clue_seed between 0 and 999999),
  roster_version text not null,
  created_at timestamptz not null default now()
);

create table public.daily_results (
  id uuid primary key default gen_random_uuid(),
  challenge_date date not null references public.daily_challenges(challenge_date),
  participant_hash text not null,
  nickname text not null check (
    char_length(btrim(nickname)) between 1 and 24
    and nickname !~ '[[:cntrl:]]'
  ),
  points smallint not null check (points between 0 and 100),
  outcome text not null check (outcome in ('correct', 'gave-up')),
  clues_used smallint not null check (clues_used between 1 and 5),
  incorrect_guesses smallint not null check (incorrect_guesses between 0 and 50),
  submitted_at timestamptz not null default now(),
  unique (challenge_date, participant_hash)
);

create index daily_results_ranking_idx
  on public.daily_results (challenge_date, points desc, submitted_at asc);

create table public.daily_archives (
  challenge_date date primary key,
  object_path text not null unique,
  row_count integer not null check (row_count >= 0),
  created_at timestamptz not null default now()
);

create table public.daily_request_limits (
  key_hash text not null,
  window_start timestamptz not null,
  request_count integer not null default 1,
  primary key (key_hash, window_start)
);

alter table public.daily_player_pool enable row level security;
alter table public.daily_challenges enable row level security;
alter table public.daily_results enable row level security;
alter table public.daily_archives enable row level security;
alter table public.daily_request_limits enable row level security;

revoke all on public.daily_player_pool from anon, authenticated;
revoke all on public.daily_challenges from anon, authenticated;
revoke all on public.daily_results from anon, authenticated;
revoke all on public.daily_archives from anon, authenticated;
revoke all on public.daily_request_limits from anon, authenticated;

create or replace function public.consume_daily_rate_limit(
  p_key_hash text,
  p_window_start timestamptz,
  p_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count integer;
begin
  delete from public.daily_request_limits
    where window_start < now() - interval '10 minutes';

  insert into public.daily_request_limits (key_hash, window_start, request_count)
  values (p_key_hash, p_window_start, 1)
  on conflict (key_hash, window_start)
  do update set request_count = public.daily_request_limits.request_count + 1
  returning request_count into next_count;

  return next_count <= p_limit;
end;
$$;

revoke all on function public.consume_daily_rate_limit(text, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.consume_daily_rate_limit(text, timestamptz, integer)
  to service_role;

insert into storage.buckets (id, name, public, file_size_limit)
values ('daily-leaderboard-archives', 'daily-leaderboard-archives', false, 5242880)
on conflict (id) do update set public = false;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'leo-guessi-daily-maintenance';
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end
$$;

select cron.schedule(
  'leo-guessi-daily-maintenance',
  '0 0 * * *',
  $$
    select net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'leo_guessi_project_url'
      ) || '/functions/v1/daily-maintenance',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'leo_guessi_publishable_key'
        ),
        'x-maintenance-secret', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'leo_guessi_maintenance_secret'
        )
      ),
      body := '{"source":"cron"}'::jsonb
    );
  $$
);
