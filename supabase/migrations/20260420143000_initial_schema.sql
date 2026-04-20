-- Migration: baseline oficial do DevPulse para o Supabase CLI.
-- Esta migration e idempotente para facilitar a adocao do fluxo
-- `supabase link` + `supabase db push` em bancos novos ou legados.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.editions (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  edition_number integer not null,
  title text not null,
  summary text,
  prepared_at timestamptz,
  published_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz default now()
);

alter table public.editions
  add column if not exists slug text,
  add column if not exists edition_number integer,
  add column if not exists title text,
  add column if not exists summary text,
  add column if not exists prepared_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists sent_at timestamptz,
  add column if not exists created_at timestamptz default now();

alter table public.editions
  alter column created_at set default now();

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid,
  title text not null,
  title_ptbr text,
  url text not null,
  summary_ptbr text not null,
  content_ptbr text,
  source text not null,
  category text not null,
  original_language text default 'en',
  reading_time_min integer,
  canonical_topic text,
  primary_source_url text,
  primary_source_label text,
  source_count integer default 1,
  source_items jsonb not null default '[]'::jsonb,
  status text not null default 'active',
  position integer,
  slug text not null,
  created_at timestamptz default now()
);

alter table public.articles
  add column if not exists edition_id uuid,
  add column if not exists title text,
  add column if not exists title_ptbr text,
  add column if not exists url text,
  add column if not exists summary_ptbr text,
  add column if not exists content_ptbr text,
  add column if not exists source text,
  add column if not exists category text,
  add column if not exists original_language text default 'en',
  add column if not exists reading_time_min integer,
  add column if not exists canonical_topic text,
  add column if not exists primary_source_url text,
  add column if not exists primary_source_label text,
  add column if not exists source_count integer default 1,
  add column if not exists source_items jsonb default '[]'::jsonb,
  add column if not exists status text default 'active',
  add column if not exists position integer,
  add column if not exists slug text,
  add column if not exists created_at timestamptz default now();

create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  active boolean default true,
  created_at timestamptz default now()
);

alter table public.subscribers
  add column if not exists email text,
  add column if not exists active boolean default true,
  add column if not exists created_at timestamptz default now();

alter table public.subscribers
  alter column active set default true,
  alter column created_at set default now();

create table if not exists public.editorial_suppressions (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  value text not null,
  reason text,
  created_at timestamptz default now()
);

alter table public.editorial_suppressions
  add column if not exists scope text,
  add column if not exists value text,
  add column if not exists reason text,
  add column if not exists created_at timestamptz default now();

alter table public.editorial_suppressions
  alter column created_at set default now();

create table if not exists public.newsletter_deliveries (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null,
  email text not null,
  status text not null,
  error text,
  attempts integer not null default 1,
  last_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz default now()
);

alter table public.newsletter_deliveries
  add column if not exists edition_id uuid,
  add column if not exists email text,
  add column if not exists status text,
  add column if not exists error text,
  add column if not exists attempts integer default 1,
  add column if not exists last_attempt_at timestamptz default now(),
  add column if not exists sent_at timestamptz,
  add column if not exists created_at timestamptz default now();

alter table public.newsletter_deliveries
  alter column attempts set default 1,
  alter column last_attempt_at set default now(),
  alter column created_at set default now();

delete from public.articles as a
where a.edition_id is not null
  and not exists (
    select 1
    from public.editions as e
    where e.id = a.edition_id
  );

update public.articles
set slug = left(
  trim(
    both '-' from regexp_replace(
      lower(regexp_replace(title, '[^a-zA-Z0-9]+', '-', 'g')),
      '-+',
      '-',
      'g'
    )
  ),
  80
)
where slug is null
  and title is not null;

update public.editions as e
set published_at = coalesce(e.published_at, e.sent_at, e.created_at)
where e.published_at is null
  and exists (
    select 1
    from public.articles as a
    where a.edition_id = e.id
  );

update public.editions as e
set prepared_at = coalesce(e.prepared_at, e.published_at, e.sent_at, e.created_at)
where e.prepared_at is null
  and exists (
    select 1
    from public.articles as a
    where a.edition_id = e.id
  );

update public.articles
set
  primary_source_url = coalesce(primary_source_url, url),
  primary_source_label = coalesce(primary_source_label, source),
  source_items = case
    when source_items is null
      or jsonb_typeof(source_items) <> 'array'
      or source_items = '[]'::jsonb then
      jsonb_build_array(
        jsonb_build_object(
          'label', coalesce(source, ''),
          'url', coalesce(url, ''),
          'title', coalesce(title, ''),
          'snippet', summary_ptbr,
          'is_primary', true
        )
      )
    else source_items
  end,
  source_count = case
    when source_items is not null
      and jsonb_typeof(source_items) = 'array'
      and jsonb_array_length(source_items) > 0 then
      greatest(coalesce(source_count, 0), jsonb_array_length(source_items))
    else coalesce(source_count, 1)
  end,
  status = coalesce(status, 'active');

alter table public.articles
  alter column created_at set default now(),
  alter column original_language set default 'en',
  alter column source_count set default 1,
  alter column source_items set default '[]'::jsonb,
  alter column status set default 'active';

alter table public.articles
  alter column slug set not null,
  alter column source_items set not null,
  alter column status set not null;

alter table public.articles
  drop constraint if exists articles_edition_id_fkey;

alter table public.articles
  add constraint articles_edition_id_fkey
  foreign key (edition_id)
  references public.editions(id)
  on delete cascade;

alter table public.newsletter_deliveries
  drop constraint if exists newsletter_deliveries_edition_id_fkey;

alter table public.newsletter_deliveries
  add constraint newsletter_deliveries_edition_id_fkey
  foreign key (edition_id)
  references public.editions(id)
  on delete cascade;

create unique index if not exists idx_editions_slug_unique
  on public.editions(slug);

create unique index if not exists idx_articles_slug_edition
  on public.articles(edition_id, slug);

create unique index if not exists idx_subscribers_email_unique
  on public.subscribers(email);

create unique index if not exists idx_editorial_suppressions_scope_value
  on public.editorial_suppressions(scope, value);

create unique index if not exists idx_newsletter_deliveries_unique
  on public.newsletter_deliveries(edition_id, email);

create index if not exists idx_articles_edition_id
  on public.articles(edition_id);

create index if not exists idx_articles_category
  on public.articles(category);

create index if not exists idx_articles_status
  on public.articles(status);

create index if not exists idx_articles_canonical_topic
  on public.articles(canonical_topic);

create index if not exists idx_editions_prepared_at
  on public.editions(prepared_at desc);

create index if not exists idx_editions_published_at
  on public.editions(published_at desc);

create index if not exists idx_editions_created_at
  on public.editions(created_at desc);

create index if not exists idx_newsletter_deliveries_status
  on public.newsletter_deliveries(status);

create index if not exists idx_newsletter_deliveries_edition_id
  on public.newsletter_deliveries(edition_id);

alter table public.editions enable row level security;
alter table public.articles enable row level security;
alter table public.subscribers enable row level security;
alter table public.editorial_suppressions enable row level security;
alter table public.newsletter_deliveries enable row level security;

drop policy if exists "editions_select_public" on public.editions;
create policy "editions_select_public"
  on public.editions for select
  to anon, authenticated
  using (published_at is not null);

drop policy if exists "editions_insert_service" on public.editions;
create policy "editions_insert_service"
  on public.editions for insert
  to service_role
  with check (true);

drop policy if exists "editions_update_service" on public.editions;
create policy "editions_update_service"
  on public.editions for update
  to service_role
  using (true);

drop policy if exists "articles_select_public" on public.articles;
create policy "articles_select_public"
  on public.articles for select
  to anon, authenticated
  using (
    status = 'active'
    and exists (
      select 1
      from public.editions
      where public.editions.id = public.articles.edition_id
        and public.editions.published_at is not null
    )
  );

drop policy if exists "articles_insert_service" on public.articles;
create policy "articles_insert_service"
  on public.articles for insert
  to service_role
  with check (true);

drop policy if exists "articles_update_service" on public.articles;
create policy "articles_update_service"
  on public.articles for update
  to service_role
  using (true);

drop policy if exists "subscribers_insert_anon" on public.subscribers;
create policy "subscribers_insert_anon"
  on public.subscribers for insert
  to anon
  with check (true);

drop policy if exists "subscribers_select_service" on public.subscribers;
create policy "subscribers_select_service"
  on public.subscribers for select
  to service_role
  using (true);

drop policy if exists "subscribers_update_service" on public.subscribers;
create policy "subscribers_update_service"
  on public.subscribers for update
  to service_role
  using (true);

drop policy if exists "editorial_suppressions_select_service" on public.editorial_suppressions;
create policy "editorial_suppressions_select_service"
  on public.editorial_suppressions for select
  to service_role
  using (true);

drop policy if exists "editorial_suppressions_insert_service" on public.editorial_suppressions;
create policy "editorial_suppressions_insert_service"
  on public.editorial_suppressions for insert
  to service_role
  with check (true);

drop policy if exists "editorial_suppressions_update_service" on public.editorial_suppressions;
create policy "editorial_suppressions_update_service"
  on public.editorial_suppressions for update
  to service_role
  using (true);

drop policy if exists "editorial_suppressions_delete_service" on public.editorial_suppressions;
create policy "editorial_suppressions_delete_service"
  on public.editorial_suppressions for delete
  to service_role
  using (true);

drop policy if exists "newsletter_deliveries_select_service" on public.newsletter_deliveries;
create policy "newsletter_deliveries_select_service"
  on public.newsletter_deliveries for select
  to service_role
  using (true);

drop policy if exists "newsletter_deliveries_insert_service" on public.newsletter_deliveries;
create policy "newsletter_deliveries_insert_service"
  on public.newsletter_deliveries for insert
  to service_role
  with check (true);

drop policy if exists "newsletter_deliveries_update_service" on public.newsletter_deliveries;
create policy "newsletter_deliveries_update_service"
  on public.newsletter_deliveries for update
  to service_role
  using (true);
