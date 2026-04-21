create table if not exists public.site_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  dismissible boolean not null default true,
  is_active boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_site_announcements_updated_at
  on public.site_announcements(updated_at desc);

create unique index if not exists idx_site_announcements_single_active
  on public.site_announcements ((1))
  where is_active;

alter table public.site_announcements enable row level security;

drop policy if exists "site_announcements_select_public" on public.site_announcements;
create policy "site_announcements_select_public"
  on public.site_announcements for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "site_announcements_select_service" on public.site_announcements;
create policy "site_announcements_select_service"
  on public.site_announcements for select
  to service_role
  using (true);

drop policy if exists "site_announcements_insert_service" on public.site_announcements;
create policy "site_announcements_insert_service"
  on public.site_announcements for insert
  to service_role
  with check (true);

drop policy if exists "site_announcements_update_service" on public.site_announcements;
create policy "site_announcements_update_service"
  on public.site_announcements for update
  to service_role
  using (true);

drop policy if exists "site_announcements_delete_service" on public.site_announcements;
create policy "site_announcements_delete_service"
  on public.site_announcements for delete
  to service_role
  using (true);
