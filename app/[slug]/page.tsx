import { notFound } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Edition, Article, ArticleCategory } from "@/lib/types";

const CATEGORY_COLORS: Record<ArticleCategory, string> = {
  "Backend": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "Frontend": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  "IA & Machine Learning": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  "DevOps & Cloud": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  "Segurança": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  "Open Source": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  "Ferramentas & Produtividade": "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  "Carreira & Cultura": "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  "Linguagens & Frameworks": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
};

async function getEditionWithArticles(slug: string) {
  const { data } = await supabase
    .from("editions")
    .select("*")
    .eq("slug", slug)
    .single();

  const edition = data as Edition | null;
  if (!edition) return null;

  const { data: articlesData } = await supabase
    .from("articles")
    .select("*")
    .eq("edition_id", edition.id)
    .order("position", { ascending: true });

  return { edition, articles: (articlesData ?? []) as Article[] };
}

export async function generateStaticParams() {
  const { data } = await supabase.from("editions").select("slug");
  return (data as Array<{ slug: string }> ?? []).map((e) => ({ slug: e.slug }));
}

export const revalidate = 3600;

export default async function EditionPage({
  params,
}: {
  params: { slug: string };
}) {
  const result = await getEditionWithArticles(params.slug);

  if (!result) notFound();

  const { edition, articles } = result;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-16">
        {/* Nav */}
        <nav className="mb-12">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← DevPulse
          </Link>
        </nav>

        {/* Header */}
        <header className="mb-12">
          <p className="mb-2 text-sm font-mono text-muted-foreground">
            {new Date(edition.created_at).toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
          <h1 className="mb-4 text-4xl font-bold tracking-tight">{edition.title}</h1>
          {edition.summary && (
            <p className="text-muted-foreground leading-relaxed">{edition.summary}</p>
          )}
        </header>

        {/* Articles */}
        <main className="space-y-10">
          {articles.map((article: Article) => (
            <article key={article.id} className="border-b border-border pb-10 last:border-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_COLORS[article.category] ?? "bg-muted text-muted-foreground"}`}
                >
                  {article.category}
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  {article.source}
                  {article.reading_time_min && ` · ${article.reading_time_min} min`}
                </span>
              </div>
              <h2 className="mb-2 text-xl font-semibold leading-snug">
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline hover:underline-offset-4"
                >
                  {article.title}
                </a>
              </h2>
              <p className="text-muted-foreground leading-relaxed text-sm">
                {article.summary_ptbr}
              </p>
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm font-medium hover:underline hover:underline-offset-4"
              >
                Leia completo →
              </a>
            </article>
          ))}
        </main>

        {/* Footer */}
        <footer className="mt-16 border-t border-border pt-8 text-center">
          <Link
            href="/archive"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Ver todas as edições →
          </Link>
        </footer>
      </div>
    </div>
  );
}
