import argparse
import sys
from pathlib import Path

from dotenv import load_dotenv
from loguru import logger

from pipeline.curator import normalize_url
from pipeline.storage import (
    create_editorial_suppression,
    create_service_supabase,
    get_article_by_edition_and_slug,
    get_edition_by_slug,
    update_article_status,
)

load_dotenv(Path(__file__).parent.parent / ".env.local")

logger.remove()
logger.add(sys.stderr, format="<green>{time:HH:mm:ss}</green> | <level>{level}</level> | {message}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Operacoes editoriais sobre matérias da newsletter.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    def add_story_target(subparser: argparse.ArgumentParser) -> None:
        subparser.add_argument("--edition-slug", required=True, help='Slug da edicao, ex: "2026-04-20"')
        subparser.add_argument("--story-slug", required=True, help='Slug da matéria, ex: "claude-opus-4-7"')
        subparser.add_argument("--yes", action="store_true", help="Confirma a operacao.")

    remove_story = subparsers.add_parser("remove-story", help="Remove uma matéria do site/acervo")
    add_story_target(remove_story)

    restore_story = subparsers.add_parser("restore-story", help="Restaura uma matéria removida")
    add_story_target(restore_story)

    suppress_story = subparsers.add_parser(
        "suppress-story",
        help="Suprime uma matéria globalmente por tópico ou URL principal",
    )
    add_story_target(suppress_story)
    suppress_story.add_argument(
        "--scope",
        choices=["topic", "url"],
        default="topic",
        help="Escopo da supressao global",
    )
    suppress_story.add_argument("--reason", help="Motivo editorial da supressao")

    return parser.parse_args()


def get_story(args: argparse.Namespace) -> tuple[dict, dict]:
    supabase = create_service_supabase()
    edition = get_edition_by_slug(supabase, args.edition_slug)
    if not edition:
        raise RuntimeError(f"Edicao nao encontrada: {args.edition_slug}")

    story = get_article_by_edition_and_slug(
        supabase,
        edition_id=edition["id"],
        article_slug=args.story_slug,
    )
    if not story:
        raise RuntimeError(
            f"Matéria nao encontrada na edicao {args.edition_slug}: {args.story_slug}"
        )

    return supabase, story


def main() -> int:
    args = parse_args()
    supabase, story = get_story(args)

    logger.info(
        f"Matéria encontrada: {story.get('title_ptbr') or story['title']} "
        f"(slug={story['slug']}, status={story['status']})"
    )

    if not args.yes:
        logger.warning("Nenhuma alteracao foi feita. Rode novamente com --yes para confirmar.")
        return 2

    if args.command == "remove-story":
        update_article_status(supabase, story["id"], "removed")
        logger.info("Matéria removida do site/acervo com sucesso.")
        return 0

    if args.command == "restore-story":
        update_article_status(supabase, story["id"], "active")
        logger.info("Matéria restaurada com sucesso.")
        return 0

    if args.scope == "topic":
        topic = (story.get("canonical_topic") or "").strip().lower()
        if not topic:
            raise RuntimeError("A matéria nao possui canonical_topic para supressao por topico.")
        create_editorial_suppression(
            supabase,
            scope="topic",
            value=topic,
            reason=args.reason,
        )
        update_article_status(supabase, story["id"], "suppressed")
        logger.info(f"Supressao global por topico registrada: {topic}")
        return 0

    suppressed_url = normalize_url(story["url"])
    create_editorial_suppression(
        supabase,
        scope="url",
        value=suppressed_url,
        reason=args.reason,
    )
    update_article_status(supabase, story["id"], "suppressed")
    logger.info(f"Supressao global por URL registrada: {suppressed_url}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
