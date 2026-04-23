create table if not exists public.api_rate_limits (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  endpoint text not null,
  window_sec integer not null,
  bucket_start timestamptz not null,
  count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.api_rate_limits
  add column if not exists ip_hash text,
  add column if not exists endpoint text,
  add column if not exists window_sec integer,
  add column if not exists bucket_start timestamptz,
  add column if not exists count integer default 0,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.api_rate_limits
  alter column count set default 0,
  alter column created_at set default now(),
  alter column updated_at set default now();

create unique index if not exists idx_api_rate_limits_bucket
  on public.api_rate_limits(ip_hash, endpoint, window_sec, bucket_start);

create index if not exists idx_api_rate_limits_updated_at
  on public.api_rate_limits(updated_at desc);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor text not null,
  action text not null,
  target_id text,
  payload jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);

alter table public.admin_audit_log
  add column if not exists actor text,
  add column if not exists action text,
  add column if not exists target_id text,
  add column if not exists payload jsonb default '{}'::jsonb,
  add column if not exists at timestamptz default now();

alter table public.admin_audit_log
  alter column payload set default '{}'::jsonb,
  alter column at set default now();

create index if not exists idx_admin_audit_log_at
  on public.admin_audit_log(at desc);

create index if not exists idx_admin_audit_log_action
  on public.admin_audit_log(action);

create or replace function public.bump_rate_limit_bucket(
  p_ip_hash text,
  p_endpoint text,
  p_window_sec integer,
  p_bucket_start timestamptz
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
begin
  insert into public.api_rate_limits (
    ip_hash,
    endpoint,
    window_sec,
    bucket_start,
    count,
    created_at,
    updated_at
  )
  values (
    p_ip_hash,
    p_endpoint,
    p_window_sec,
    p_bucket_start,
    1,
    now(),
    now()
  )
  on conflict (ip_hash, endpoint, window_sec, bucket_start)
  do update set
    count = public.api_rate_limits.count + 1,
    updated_at = now()
  returning count into current_count;

  return current_count;
end;
$$;

grant execute on function public.bump_rate_limit_bucket(text, text, integer, timestamptz) to service_role;
