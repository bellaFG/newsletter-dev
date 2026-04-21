import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Edition } from './types'

type EditionWithArticles = Edition & {
  articles: Array<{ id: string }>
}

function stripArticles(edition: EditionWithArticles): Edition {
  const { articles: _articles, ...editionData } = edition
  return editionData
}

export async function listEditionsWithArticles(
  supabase: SupabaseClient<Database>,
  range?: { from: number; to: number },
): Promise<Edition[]> {
  let query = supabase
    .from('editions')
    // `prepared_at` existe apenas apos a migration 005; o site nao depende desse campo.
    .select('id, slug, edition_number, title, summary, prepared_at, published_at, sent_at, created_at, articles!inner(id)')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .order('edition_number', { ascending: false })

  if (range) {
    query = query.range(range.from, range.to)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(`[supabase] Failed to list published editions: ${error.message}`)
  }

  return ((data ?? []) as unknown as EditionWithArticles[]).map(stripArticles)
}

export async function getLatestEditionWithArticles(
  supabase: SupabaseClient<Database>,
): Promise<Edition | null> {
  const editions = await listEditionsWithArticles(supabase, { from: 0, to: 0 })
  return editions[0] ?? null
}

export function getEditionDisplayDate(
  edition: Pick<Edition, 'published_at' | 'created_at'>,
): string {
  return edition.published_at ?? edition.created_at
}
