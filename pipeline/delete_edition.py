import argparse
import sys
from pathlib import Path

from dotenv import load_dotenv
from loguru import logger

from pipeline.storage import (
    count_articles_for_edition,
    create_service_supabase,
    delete_edition_tree,
    get_edition_by_number,
    get_edition_by_slug,
)

load_dotenv(Path(__file__).parent.parent / ".env.local")

logger.remove()
logger.add(sys.stderr, format="<green>{time:HH:mm:ss}</green> | <level>{level}</level> | {message}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Apaga uma edicao e todos os artigos associados.",
    )
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument("--slug", help='Slug da edicao, ex: "2026-04-20"')
    target.add_argument("--edition-number", type=int, help="Numero da edicao, ex: 2")
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Confirma a exclusao. Sem esta flag o comando roda em modo informativo.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    supabase = create_service_supabase()

    edition = (
        get_edition_by_slug(supabase, args.slug)
        if args.slug
        else get_edition_by_number(supabase, args.edition_number)
    )

    if not edition:
        logger.error("Edicao nao encontrada.")
        return 1

    article_count = count_articles_for_edition(supabase, edition["id"])

    logger.info(
        f"Edicao encontrada: {edition['title']} "
        f"(#{edition['edition_number']}, slug={edition['slug']})"
    )
    logger.info(f"Artigos associados: {article_count}")

    if not args.yes:
        logger.warning("Nenhuma alteracao foi feita. Rode novamente com --yes para confirmar.")
        return 2

    deleted_articles = delete_edition_tree(supabase, edition["id"])
    logger.info(
        f"Edicao removida com sucesso. Artigos apagados: {deleted_articles}. "
        f"Slug removido: {edition['slug']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
