import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Edition } from "@/lib/types";

async function getLatestEdition(): Promise<Edition | null> {
  const { data } = await supabase
    .from("editions")
    .select("*")
    .order("edition_number", { ascending: false })
    .limit(1)
    .single();

  return data ?? null;
}

export const revalidate = 3600; // revalida a cada 1h

export default async function HomePage() {
  const latest = await getLatestEdition();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-20">
        {/* Header */}
        <header className="mb-16 text-center">
          <p className="mb-3 text-sm font-mono tracking-widest text-muted-foreground uppercase">
            newsletter
          </p>
          <h1 className="mb-4 text-5xl font-bold tracking-tight">DevPulse</h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Curadoria semanal de artigos, ferramentas e tendências do mundo dev —
            traduzida e resumida por IA. Toda sexta-feira.
          </p>
        </header>

        {/* Latest edition */}
        {latest ? (
          <section className="mb-12">
            <p className="mb-3 text-xs font-mono tracking-widest text-muted-foreground uppercase">
              Última edição
            </p>
            <Link
              href={`/${latest.slug}`}
              className="block rounded-lg border border-border p-6 transition-colors hover:bg-muted"
            >
              <p className="mb-1 text-sm text-muted-foreground font-mono">
                {new Date(latest.created_at).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <h2 className="mb-2 text-xl font-semibold">{latest.title}</h2>
              {latest.summary && (
                <p className="text-muted-foreground leading-relaxed text-sm">
                  {latest.summary}
                </p>
              )}
              <span className="mt-4 inline-block text-sm font-medium">
                Ler edição →
              </span>
            </Link>
          </section>
        ) : (
          <section className="mb-12 rounded-lg border border-border p-6 text-center text-muted-foreground">
            <p>Nenhuma edição publicada ainda. Volte na próxima sexta!</p>
          </section>
        )}

        {/* Archive link */}
        <div className="text-center">
          <Link
            href="/archive"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Ver todas as edições →
          </Link>
        </div>
      </div>
    </div>
  );
}
