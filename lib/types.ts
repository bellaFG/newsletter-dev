// Tipos gerados manualmente a partir do schema do Supabase
// Quando tiver as credenciais, substitua com: npx supabase gen types typescript --linked

export type Database = {
  public: {
    Tables: {
      editions: {
        Row: Edition;
        Insert: EditionInsert;
        Update: Partial<EditionInsert>;
      };
      articles: {
        Row: Article;
        Insert: ArticleInsert;
        Update: Partial<ArticleInsert>;
      };
      subscribers: {
        Row: Subscriber;
        Insert: SubscriberInsert;
        Update: Partial<SubscriberInsert>;
      };
    };
  };
};

export type Edition = {
  id: string;
  slug: string;
  edition_number: number;
  title: string;
  summary: string | null;
  sent_at: string | null;
  created_at: string;
};

export type EditionInsert = {
  id?: string;
  slug: string;
  edition_number: number;
  title: string;
  summary?: string | null;
  sent_at?: string | null;
  created_at?: string;
};

export type Article = {
  id: string;
  edition_id: string;
  title: string;
  url: string;
  summary_ptbr: string;
  source: string;
  category: ArticleCategory;
  original_language: string;
  reading_time_min: number | null;
  position: number | null;
  created_at: string;
};

export type ArticleInsert = {
  id?: string;
  edition_id: string;
  title: string;
  url: string;
  summary_ptbr: string;
  source: string;
  category: ArticleCategory;
  original_language?: string;
  reading_time_min?: number | null;
  position?: number | null;
  created_at?: string;
};

export type Subscriber = {
  id: string;
  email: string;
  active: boolean;
  created_at: string;
};

export type SubscriberInsert = {
  id?: string;
  email: string;
  active?: boolean;
  created_at?: string;
};

export type ArticleCategory =
  | "Backend"
  | "Frontend"
  | "IA & Machine Learning"
  | "DevOps & Cloud"
  | "Segurança"
  | "Open Source"
  | "Ferramentas & Produtividade"
  | "Carreira & Cultura"
  | "Linguagens & Frameworks";
