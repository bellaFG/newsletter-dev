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
        .select("id, slug, edition_number, title, summary, prepared_at, published_at, sent_at")
        .eq("slug", slug)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def get_edition_by_number(supabase: Client, edition_number: int) -> dict[str, Any] | None:
    result = (
        supabase.table("editions")
        .select("id, slug, edition_number, title, summary, prepared_at, published_at, sent_at")
        .eq("edition_number", edition_number)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def create_edition(
    supabase: Client,
    *,
    slug: str,
    edition_number: int,
    title: str,
) -> dict[str, Any]:
    result = (
        supabase.table("editions")
        .insert({
            "slug": slug,
            "edition_number": edition_number,
            "title": title,
            "prepared_at": None,
            "published_at": None,
            "sent_at": None,
        })
        .execute()
    )
    return result.data[0]


def update_edition(supabase: Client, edition_id: str, **fields: Any) -> dict[str, Any]:
    result = (
        supabase.table("editions")
        .update(fields)
        .eq("id", edition_id)
        .execute()
    )
    return result.data[0] if result.data else fields


def get_next_edition_number(supabase: Client) -> int:
    result = supabase.table("editions").select("id", count="exact").execute()
    return int(result.count or 0) + 1


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


def replace_articles_for_edition(
    supabase: Client,
    edition_id: str,
    articles_payload: list[dict[str, Any]],
) -> None:
    supabase.table("articles").delete().eq("edition_id", edition_id).execute()
    if articles_payload:
        supabase.table("articles").insert(articles_payload).execute()


def get_article_by_edition_and_slug(
    supabase: Client,
    *,
    edition_id: str,
    article_slug: str,
) -> dict[str, Any] | None:
    result = (
        supabase.table("articles")
        .select("id, title, title_ptbr, slug, canonical_topic, url, status")
        .eq("edition_id", edition_id)
        .eq("slug", article_slug)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def update_article_status(supabase: Client, article_id: str, status: str) -> dict[str, Any]:
    result = (
        supabase.table("articles")
        .update({"status": status})
        .eq("id", article_id)
        .execute()
    )
    return result.data[0] if result.data else {"id": article_id, "status": status}


def create_editorial_suppression(
    supabase: Client,
    *,
    scope: str,
    value: str,
    reason: str | None = None,
) -> dict[str, Any]:
    result = (
        supabase.table("editorial_suppressions")
        .upsert(
            {
                "scope": scope,
                "value": value,
                "reason": reason,
            },
            on_conflict="scope,value",
        )
        .execute()
    )
    return result.data[0] if result.data else {"scope": scope, "value": value, "reason": reason}


def list_editorial_suppressions(
    supabase: Client,
    scope: str | None = None,
) -> list[dict[str, Any]]:
    query = supabase.table("editorial_suppressions").select("scope, value, reason")
    if scope:
        query = query.eq("scope", scope)
    result = query.execute()
    return result.data or []
