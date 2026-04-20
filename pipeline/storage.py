import os
from typing import Any

from supabase import Client, create_client


def create_service_supabase() -> Client:
    """Cria um client com service role para operacoes administrativas."""
    return create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )


def get_edition_by_slug(supabase: Client, slug: str) -> dict[str, Any] | None:
    result = (
        supabase.table("editions")
        .select("id, slug, edition_number, title, sent_at")
        .eq("slug", slug)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def get_edition_by_number(supabase: Client, edition_number: int) -> dict[str, Any] | None:
    result = (
        supabase.table("editions")
        .select("id, slug, edition_number, title, sent_at")
        .eq("edition_number", edition_number)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def count_articles_for_edition(supabase: Client, edition_id: str) -> int:
    result = (
        supabase.table("articles")
        .select("id", count="exact")
        .eq("edition_id", edition_id)
        .execute()
    )
    return int(result.count or 0)


def delete_edition_tree(supabase: Client, edition_id: str) -> int:
    """
    Remove manualmente os artigos de uma edicao e, em seguida, a propria edicao.

    O delete explicito dos artigos funciona como fallback caso o banco real ainda
    nao esteja com ON DELETE CASCADE aplicado.
    """
    article_count = count_articles_for_edition(supabase, edition_id)

    if article_count:
        supabase.table("articles").delete().eq("edition_id", edition_id).execute()

    supabase.table("editions").delete().eq("id", edition_id).execute()
    return article_count
