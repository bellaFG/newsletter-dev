/**
 * Tipos do banco de dados Supabase.
 * Espelham as tabelas definidas em supabase/schema.sql.
 *
 * Gerados manualmente — para gerar automaticamente com credenciais:
 *   npx supabase gen types typescript --linked
 */

export type Database = {
  public: {
    Tables: {
      editions: {
        Row: Edition
        Insert: EditionInsert
        Update: Partial<EditionInsert>
        Relationships: []
      }
      articles: {
        Row: Article
        Insert: ArticleInsert
        Update: Partial<ArticleInsert>
        Relationships: []
      }
      subscribers: {
        Row: Subscriber
        Insert: SubscriberInsert
        Update: Partial<SubscriberInsert>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Edition = {
  id: string
  slug: string
  edition_number: number
  title: string
  summary: string | null
  sent_at: string | null
  created_at: string
}

export type EditionInsert = {
  id?: string
  slug: string
  edition_number: number
  title: string
  summary?: string | null
  sent_at?: string | null
  created_at?: string
}

export type Article = {
  id: string
  edition_id: string
  title: string
  title_ptbr: string | null
  url: string
  summary_ptbr: string
  content_ptbr: string | null
  source: string
  category: ArticleCategory
  original_language: string
  reading_time_min: number | null
  position: number | null
  slug: string
  created_at: string
}

export type ArticleInsert = {
  id?: string
  edition_id: string
  title: string
  title_ptbr?: string | null
  url: string
  summary_ptbr: string
  content_ptbr?: string | null
  source: string
  category: ArticleCategory
  original_language?: string
  reading_time_min?: number | null
  position?: number | null
  slug: string
  created_at?: string
}

export type Subscriber = {
  id: string
  email: string
  active: boolean
  created_at: string
}

export type SubscriberInsert = {
  id?: string
  email: string
  active?: boolean
  created_at?: string
}

export type ArticleCategory =
  | 'Backend'
  | 'Frontend'
  | 'IA & Machine Learning'
  | 'DevOps & Cloud'
  | 'Segurança'
  | 'Open Source'
  | 'Ferramentas & Produtividade'
  | 'Carreira & Cultura'
  | 'Linguagens & Frameworks'
