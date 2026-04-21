create or replace function public.normalize_search_text(input text)
returns text
language sql
immutable
set search_path = public
as $$
  select translate(
    lower(coalesce(input, '')),
    'àáâãäåæçèéêëìíîïñòóôõöùúûüýÿÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ',
    'aaaaaaaceeeeiiiinooooouuuuyyaaaaaaaceeeeiiiinooooouuuuy'
  )
$$;

alter table public.articles
  add column if not exists source_published_at timestamptz;

alter table public.articles
  add column if not exists search_document tsvector
  generated always as (
    setweight(to_tsvector('simple', public.normalize_search_text(title_ptbr)), 'A') ||
    setweight(to_tsvector('simple', public.normalize_search_text(title)), 'A') ||
    setweight(to_tsvector('simple', public.normalize_search_text(summary_ptbr)), 'B') ||
    setweight(to_tsvector('simple', public.normalize_search_text(content_ptbr)), 'C') ||
    setweight(to_tsvector('simple', public.normalize_search_text(category)), 'B') ||
    setweight(to_tsvector('simple', public.normalize_search_text(source)), 'B') ||
    setweight(to_tsvector('simple', public.normalize_search_text(primary_source_label)), 'B') ||
    setweight(to_tsvector('simple', public.normalize_search_text(canonical_topic)), 'A')
  ) stored;

create index if not exists idx_articles_source_published_at
  on public.articles(source_published_at desc);

create index if not exists idx_articles_search_document
  on public.articles using gin(search_document);

create or replace function public.activate_site_announcement(announcement_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.site_announcements
    where id = announcement_id
  ) then
    raise exception 'site_announcement_not_found';
  end if;

  update public.site_announcements
  set
    is_active = false,
    updated_at = now()
  where is_active = true
    and id <> announcement_id;

  update public.site_announcements
  set
    is_active = true,
    updated_at = now()
  where id = announcement_id;
end;
$$;

create or replace function public.save_site_announcement_and_activate(
  announcement_id uuid,
  announcement_title text,
  announcement_message text,
  announcement_dismissible boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  if announcement_id is null then
    insert into public.site_announcements (
      title,
      message,
      dismissible,
      is_active,
      created_at,
      updated_at
    )
    values (
      trim(announcement_title),
      trim(announcement_message),
      announcement_dismissible,
      false,
      now(),
      now()
    )
    returning id into target_id;
  else
    update public.site_announcements
    set
      title = trim(announcement_title),
      message = trim(announcement_message),
      dismissible = announcement_dismissible,
      updated_at = now()
    where id = announcement_id
    returning id into target_id;

    if target_id is null then
      raise exception 'site_announcement_not_found';
    end if;
  end if;

  perform public.activate_site_announcement(target_id);
end;
$$;

create or replace function public.deactivate_site_announcement(announcement_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.site_announcements
  set
    is_active = false,
    updated_at = now()
  where id = announcement_id;

  if not found then
    raise exception 'site_announcement_not_found';
  end if;
end;
$$;

create or replace function public.delete_site_announcement(announcement_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.site_announcements
  where id = announcement_id;

  if not found then
    raise exception 'site_announcement_not_found';
  end if;
end;
$$;

create or replace function public.search_articles(
  search_query text,
  result_limit integer default 20,
  result_offset integer default 0
)
returns table (
  id uuid,
  slug text,
  title text,
  title_ptbr text,
  summary_ptbr text,
  content_ptbr text,
  category text,
  source text,
  primary_source_label text,
  source_count integer,
  canonical_topic text,
  source_published_at timestamptz,
  edition_slug text,
  edition_number integer,
  edition_title text,
  edition_published_at timestamptz,
  edition_created_at timestamptz,
  rank real
)
language sql
stable
set search_path = public
as $$
  with normalized_query as (
    select websearch_to_tsquery(
      'simple',
      public.normalize_search_text(trim(search_query))
    ) as terms
  )
  select
    a.id,
    a.slug,
    a.title,
    a.title_ptbr,
    a.summary_ptbr,
    a.content_ptbr,
    a.category,
    a.source,
    a.primary_source_label,
    a.source_count,
    a.canonical_topic,
    a.source_published_at,
    e.slug as edition_slug,
    e.edition_number,
    e.title as edition_title,
    e.published_at as edition_published_at,
    e.created_at as edition_created_at,
    ts_rank(a.search_document, nq.terms)::real as rank
  from public.articles as a
  join public.editions as e
    on e.id = a.edition_id
  cross join normalized_query as nq
  where trim(coalesce(search_query, '')) <> ''
    and a.status = 'active'
    and e.published_at is not null
    and a.search_document @@ nq.terms
  order by
    rank desc,
    coalesce(a.source_published_at, e.published_at, a.created_at) desc,
    a.created_at desc
  limit greatest(least(coalesce(result_limit, 20), 50), 1)
  offset greatest(coalesce(result_offset, 0), 0);
$$;

grant execute on function public.activate_site_announcement(uuid) to service_role;
grant execute on function public.save_site_announcement_and_activate(uuid, text, text, boolean) to service_role;
grant execute on function public.deactivate_site_announcement(uuid) to service_role;
grant execute on function public.delete_site_announcement(uuid) to service_role;
grant execute on function public.search_articles(text, integer, integer) to service_role;
