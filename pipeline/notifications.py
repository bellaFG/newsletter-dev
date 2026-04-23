import json
import os
from typing import Any, Literal

import requests
from loguru import logger

PipelineMode = Literal["prepare", "check-ready", "publish", "full"]


def _get_run_url() -> str | None:
    server = os.environ.get("GITHUB_SERVER_URL")
    repository = os.environ.get("GITHUB_REPOSITORY")
    run_id = os.environ.get("GITHUB_RUN_ID")

    if server and repository and run_id:
        return f"{server}/{repository}/actions/runs/{run_id}"
    return None


def build_failure_alert(mode: PipelineMode, error: str) -> tuple[str, str]:
    if mode == "check-ready":
        title = "DevPulse nao ficou pronto ate 07:30 BRT"
        body = (
            "A edicao desta semana ainda nao esta preparada no banco "
            "30 minutos antes da publicacao. Verificar coleta, curadoria e rascunho."
        )
    elif mode == "publish":
        title = "DevPulse falhou na publicacao das 08:00 BRT"
        body = (
            "A etapa de publicar no site e disparar os emails nao concluiu com sucesso. "
            "Verificar rascunho do dia, endpoint /api/send-newsletter e Brevo."
        )
    elif mode == "prepare":
        title = "DevPulse falhou ao preparar o rascunho da semana"
        body = (
            "A coleta/curadoria nao conseguiu deixar a edicao pronta antes da janela de publicacao."
        )
    else:
        title = "DevPulse falhou no pipeline semanal"
        body = "O fluxo completo da newsletter falhou."

    return title, f"{body}\n\nErro: {error}"


def _format_metadata_line(label: str, value: Any) -> str | None:
    if value in (None, "", []):
        return None
    return f"- {label}: {value}"


def build_success_alert(mode: PipelineMode, payload: dict[str, Any]) -> tuple[str, str]:
    slug = payload.get("slug")
    edition_number = payload.get("edition_number")
    article_count = payload.get("article_count")
    sent_total = payload.get("sent_total")
    sent_now = payload.get("sent_now")
    already_sent = payload.get("already_sent")

    if mode == "prepare":
        title = "DevPulse preparou o rascunho da semana"
        body = "A curadoria terminou e o rascunho ficou salvo no Supabase."
    elif mode == "check-ready":
        title = "DevPulse validou o rascunho da semana"
        body = "A checagem das 07:30 BRT confirmou que a edição está pronta para publicação."
    elif mode == "publish":
        title = "DevPulse publicou a edição da semana"
        body = "A edição foi publicada no site e o disparo da newsletter concluiu com sucesso."
    else:
        title = "DevPulse concluiu o pipeline completo"
        body = "A edição da semana foi preparada, publicada e enviada sem falhas."

    metadata_lines = [
        _format_metadata_line("Slug", slug),
        _format_metadata_line("Edição", f"#{edition_number}" if edition_number else None),
        _format_metadata_line("Matérias", article_count),
    ]

    if mode in ("publish", "full"):
        metadata_lines.extend([
            _format_metadata_line("Envios totais", sent_total),
            _format_metadata_line("Envios novos", sent_now),
            _format_metadata_line("Já entregues", already_sent),
        ])

    metadata = "\n".join(line for line in metadata_lines if line)
    if metadata:
        body = f"{body}\n\n{metadata}"

    return title, body


def send_discord_alert(title: str, body: str) -> None:
    webhook_url = os.environ.get("DISCORD_ALERT_WEBHOOK_URL")
    if not webhook_url:
        logger.warning("[Notify] DISCORD_ALERT_WEBHOOK_URL ausente; alerta nao enviado")
        return

    run_url = _get_run_url()
    content = f"**{title}**\n{body}"
    if run_url:
        content += f"\n\nGitHub Actions: {run_url}"

    response = requests.post(
        webhook_url,
        headers={"Content-Type": "application/json"},
        data=json.dumps({"content": content}),
        timeout=15,
    )
    response.raise_for_status()
    logger.info("[Notify] Alerta enviado ao Discord")
