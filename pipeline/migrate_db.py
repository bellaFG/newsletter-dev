import argparse
import hashlib
import os
import sys
from pathlib import Path

import psycopg
from dotenv import load_dotenv
from loguru import logger

load_dotenv(Path(__file__).parent.parent / ".env.local")

logger.remove()
logger.add(sys.stderr, format="<green>{time:HH:mm:ss}</green> | <level>{level}</level> | {message}")

MIGRATIONS_DIR = Path(__file__).parent.parent / "supabase" / "migrations"
MIGRATIONS_TABLE = "public.devpulse_migrations"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Aplica migrations SQL pendentes no banco Supabase.")
    parser.add_argument(
        "--allow-missing-db-url",
        action="store_true",
        help="Sai com sucesso quando SUPABASE_DB_URL nao estiver configurada.",
    )
    return parser.parse_args()


def get_db_url() -> str | None:
    return os.environ.get("SUPABASE_DB_URL")


def checksum_for_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def ensure_migrations_table(conn: psycopg.Connection) -> None:
    with conn.cursor() as cur:
        cur.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {MIGRATIONS_TABLE} (
              filename    TEXT PRIMARY KEY,
              checksum    TEXT NOT NULL,
              applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )


def list_applied_migrations(conn: psycopg.Connection) -> dict[str, str]:
    with conn.cursor() as cur:
        cur.execute(f"SELECT filename, checksum FROM {MIGRATIONS_TABLE} ORDER BY filename ASC")
        return {filename: checksum for filename, checksum in cur.fetchall()}


def apply_migration(conn: psycopg.Connection, path: Path, checksum: str) -> None:
    sql = path.read_text(encoding="utf-8")
    with conn.transaction():
        with conn.cursor() as cur:
            cur.execute(sql)
            cur.execute(
                f"""
                INSERT INTO {MIGRATIONS_TABLE} (filename, checksum)
                VALUES (%s, %s)
                ON CONFLICT (filename)
                DO UPDATE SET checksum = EXCLUDED.checksum, applied_at = NOW()
                """,
                (path.name, checksum),
            )


def migrate(*, allow_missing_db_url: bool = False) -> int:
    db_url = get_db_url()
    if not db_url:
        message = "SUPABASE_DB_URL ausente; migrations automaticas nao podem ser aplicadas."
        if allow_missing_db_url:
            logger.warning(f"[Migrate] {message}")
            return 0
        logger.error(f"[Migrate] {message}")
        return 1

    migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not migration_files:
        logger.info("[Migrate] Nenhuma migration encontrada.")
        return 0

    logger.info(f"[Migrate] Conectando ao banco para aplicar {len(migration_files)} migration(s)...")
    with psycopg.connect(db_url, autocommit=False) as conn:
        ensure_migrations_table(conn)
        applied = list_applied_migrations(conn)

        pending = []
        for path in migration_files:
            checksum = checksum_for_file(path)
            previous_checksum = applied.get(path.name)
            if previous_checksum is None:
                pending.append((path, checksum))
                continue
            if previous_checksum != checksum:
                raise RuntimeError(
                    f"Migration {path.name} foi modificada apos aplicacao inicial. "
                    "Crie uma nova migration em vez de editar uma existente."
                )

        if not pending:
            logger.info("[Migrate] Nenhuma migration pendente.")
            return 0

        for path, checksum in pending:
            logger.info(f"[Migrate] Aplicando {path.name}...")
            apply_migration(conn, path, checksum)

    logger.info(f"[Migrate] {len(pending)} migration(s) aplicada(s) com sucesso.")
    return 0


def main() -> int:
    args = parse_args()
    return migrate(allow_missing_db_url=args.allow_missing_db_url)


if __name__ == "__main__":
    raise SystemExit(main())
