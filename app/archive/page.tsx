import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Edition } from "@/lib/types";

async function getAllEditions(): Promise<Edition[]> {
  const { data } = await supabase
    .from("editions")
    .select("*")
    .order("edition_number", { ascending: false });

  return data ?? [];
}

export const revalidate = 3600;

export default async function ArchivePage() {
  const editions = await getAllEditions();

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

        <header className="mb-12">
          <h1 className="text-3xl font-bold tracking-tight">Todas as edições</h1>
          <p className="mt-2 text-muted-foreground">
            {editions.length} {editions.length === 1 ? "edição publicada" : "edições publicadas"}
          </p>
        </header>

        {editions.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma edição publicada ainda.</p>
        ) : (
          <ul className="space-y-3">
            {editions.map((edition: Edition) => (
              <li key={edition.id}>
                <Link
                  href={`/${edition.slug}`}
                  className="flex items-baseline justify-between rounded-lg border border-border px-5 py-4 transition-colors hover:bg-muted"
                >
                  <span className="font-medium">{edition.title}</span>
                  <span className="ml-4 shrink-0 text-sm font-mono text-muted-foreground">
                    {new Date(edition.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
