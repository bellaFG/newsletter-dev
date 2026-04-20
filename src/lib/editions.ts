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
    .select('id, slug, edition_number, title, summary, sent_at, created_at, articles!inner(id)')
    .order('edition_number', { ascending: false })

  if (range) {
    query = query.range(range.from, range.to)
  }

  const { data, error } = await query
  if (error) throw error

  return ((data ?? []) as EditionWithArticles[]).map(stripArticles)
}

export async function getLatestEditionWithArticles(
  supabase: SupabaseClient<Database>,
): Promise<Edition | null> {
  const editions = await listEditionsWithArticles(supabase, { from: 0, to: 0 })
  return editions[0] ?? null
}
