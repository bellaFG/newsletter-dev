import base64
import html
import json
import os
import re
import time
from collections import defaultdict
from datetime import datetime, timezone
from hashlib import sha256
from urllib.parse import quote

import requests
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from pipeline.storage import create_service_supabase

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"
DEFAULT_SITE_URL = "https://newsletter-dev.vercel.app"
EMAIL_BATCH_SIZE = 100
TOKEN_VERSION_V2 = "v2"
UNSUBSCRIBE_TOKEN_TTL_SECONDS = 365 * 24 * 60 * 60


def deliver_newsletter_direct(edition_id: str) -> dict:
    """Envia a newsletter direto pelo pipeline, sem depender da API do site."""
    supabase = create_service_supabase()
    email_from = os.environ["EMAIL_FROM"]
    brevo_api_key = os.environ["BREVO_API_KEY"]
    site_url = _normalize_site_url(os.environ.get("SITE_URL"))

    edition = _single(
        supabase.table("editions")
        .select("*")
        .eq("id", edition_id)
        .limit(1)
        .execute()
        .data
    )
    if not edition:
        raise RuntimeError("Edicao nao encontrada para envio direto")

    if edition.get("sent_at"):
        return {
            "message": "Newsletter already sent",
            "sent_at": edition["sent_at"],
            "sent_total": 0,
            "sent_now": 0,
            "already_sent": 0,
        }

    articles = (
        supabase.table("articles")
        .select("*")
        .eq("edition_id", edition_id)
        .eq("status", "active")
        .order("position")
        .execute()
        .data
        or []
    )
    if not articles:
        raise RuntimeError("Edicao nao possui materias ativas")

    subscribers = (
        supabase.table("subscribers")
        .select("email")
        .eq("active", True)
        .execute()
        .data
        or []
    )
    if not subscribers:
        _mark_edition_sent(supabase, edition_id)
        return {"message": "No active subscribers", "sent_total": 0, "sent_now": 0, "already_sent": 0}

    deliveries = (
        supabase.table("newsletter_deliveries")
        .select("email, status, attempts, sent_at")
        .eq("edition_id", edition_id)
        .execute()
        .data
        or []
    )
    delivery_by_email = {delivery["email"]: delivery for delivery in deliveries}
    pending_subscribers = [
        subscriber
        for subscriber in subscribers
        if delivery_by_email.get(subscriber["email"], {}).get("status") != "sent"
    ]
    already_sent = len(subscribers) - len(pending_subscribers)

    if not pending_subscribers:
        _mark_edition_sent(supabase, edition_id)
        return {
            "message": "Newsletter already delivered to all active subscribers",
            "sent_total": len(subscribers),
            "sent_now": 0,
            "already_sent": already_sent,
        }

    sent_now = 0
    errors: list[str] = []

    for batch in _chunks(pending_subscribers, EMAIL_BATCH_SIZE):
        for subscriber in batch:
            email = subscriber["email"]
            previous = delivery_by_email.get(email) or {}
            attempt = int(previous.get("attempts") or 0) + 1
            attempted_at = datetime.now(timezone.utc).isoformat()

            try:
                unsubscribe_url = (
                    f"{site_url}/unsubscribe?token="
                    f"{quote(_create_unsubscribe_token(email), safe='')}"
                )
                html_body = _render_newsletter_html(
                    edition=edition,
                    articles=articles,
                    site_url=site_url,
                    unsubscribe_url=unsubscribe_url,
                )
                _send_brevo_email(
                    api_key=brevo_api_key,
                    to_email=email,
                    from_email=email_from,
                    subject=edition["title"],
                    html_body=html_body,
                )

                _upsert_delivery(
                    supabase,
                    edition_id=edition_id,
                    email=email,
                    status="sent",
                    error=None,
                    attempts=attempt,
                    attempted_at=attempted_at,
                    sent_at=attempted_at,
                )
                delivery_by_email[email] = {"email": email, "status": "sent"}
                sent_now += 1
            except Exception as exc:
                message = str(exc)
                errors.append(f"{email}: {message}")
                _upsert_delivery(
                    supabase,
                    edition_id=edition_id,
                    email=email,
                    status="failed",
                    error=message,
                    attempts=attempt,
                    attempted_at=attempted_at,
                    sent_at=None,
                )
                delivery_by_email[email] = {"email": email, "status": "failed"}

    sent_total = sum(
        1
        for subscriber in subscribers
        if delivery_by_email.get(subscriber["email"], {}).get("status") == "sent"
    )

    if sent_total == len(subscribers):
        _mark_edition_sent(supabase, edition_id)
        return {
            "success": True,
            "sent_now": sent_now,
            "already_sent": already_sent,
            "sent_total": sent_total,
        }

    raise RuntimeError(
        f"Envio parcial da newsletter: sent_now={sent_now}, "
        f"already_sent={already_sent}, sent_total={sent_total}, errors={errors}"
    )


def _single(items: list[dict] | None) -> dict | None:
    return items[0] if items else None


def _chunks(items: list[dict], size: int):
    for index in range(0, len(items), size):
        yield items[index : index + size]


def _mark_edition_sent(supabase, edition_id: str) -> None:
    supabase.table("editions").update({
        "sent_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", edition_id).execute()


def _upsert_delivery(
    supabase,
    *,
    edition_id: str,
    email: str,
    status: str,
    error: str | None,
    attempts: int,
    attempted_at: str,
    sent_at: str | None,
) -> None:
    supabase.table("newsletter_deliveries").upsert(
        {
            "edition_id": edition_id,
            "email": email,
            "status": status,
            "error": error,
            "attempts": attempts,
            "last_attempt_at": attempted_at,
            "sent_at": sent_at,
        },
        on_conflict="edition_id,email",
    ).execute()


def _send_brevo_email(
    *,
    api_key: str,
    to_email: str,
    from_email: str,
    subject: str,
    html_body: str,
) -> None:
    response = requests.post(
        BREVO_API_URL,
        headers={
            "api-key": api_key,
            "content-type": "application/json",
            "accept": "application/json",
        },
        json={
            "sender": {"email": from_email},
            "to": [{"email": to_email}],
            "subject": subject,
            "htmlContent": html_body,
        },
        timeout=30,
    )
    if not response.ok:
        try:
            payload = response.json()
            message = payload.get("message") or payload
        except ValueError:
            message = response.text
        raise RuntimeError(f"Brevo API error: status={response.status_code}, payload={message}")


def _create_unsubscribe_token(email: str) -> str:
    secret = os.environ.get("UNSUBSCRIBE_TOKEN_SECRET") or os.environ["NEWSLETTER_API_SECRET"]
    key = sha256(f"devpulse-unsubscribe:{secret}".encode("utf-8")).digest()
    payload = json.dumps(
        {
            "email": email.strip().lower(),
            "exp": int(time.time()) + UNSUBSCRIBE_TOKEN_TTL_SECONDS,
            "v": TOKEN_VERSION_V2,
        },
        separators=(",", ":"),
    ).encode("utf-8")
    iv = os.urandom(12)
    encrypted_with_tag = AESGCM(key).encrypt(iv, payload, None)
    encrypted = encrypted_with_tag[:-16]
    auth_tag = encrypted_with_tag[-16:]
    return ".".join(
        [
            TOKEN_VERSION_V2,
            _base64url(iv),
            _base64url(encrypted),
            _base64url(auth_tag),
        ]
    )


def _base64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _normalize_site_url(value: str | None) -> str:
    value = (value or DEFAULT_SITE_URL).strip().rstrip("/")
    if not value or "localhost" in value or value.startswith("http://127."):
        return DEFAULT_SITE_URL
    return value


def _render_newsletter_html(
    *,
    edition: dict,
    articles: list[dict],
    site_url: str,
    unsubscribe_url: str,
) -> str:
    edition_url = f"{site_url}/edicao/{edition['slug']}"
    grouped_articles: dict[str, list[dict]] = defaultdict(list)
    for article in articles:
        grouped_articles[article.get("category") or "Outros"].append(article)

    sections = []
    for category, category_articles in grouped_articles.items():
        items = []
        for article in category_articles:
            title = article.get("title_ptbr") or article.get("title") or "Materia"
            article_slug = article.get("slug")
            article_url = f"{edition_url}/{article_slug}" if article_slug else edition_url
            source_url = article.get("primary_source_url") or article.get("url") or article_url
            source_label = article.get("primary_source_label") or article.get("source") or "Fonte"
            summary = article.get("summary_ptbr") or ""
            items.append(
                f"""
                <article style="border-top:1px solid #e0ddd8;padding:18px 0">
                  <p style="margin:0 0 6px;font:11px Menlo,Consolas,monospace;color:#2563eb">{_escape(source_label)}</p>
                  <h3 style="margin:0 0 8px;font:700 22px Georgia,serif;line-height:1.25">
                    <a href="{_escape(article_url)}" style="color:#1a1816;text-decoration:none">{_escape(title)}</a>
                  </h3>
                  <p style="margin:0 0 12px;color:#3a3735;line-height:1.7">{_escape(summary)}</p>
                  <p style="margin:0;font:11px Menlo,Consolas,monospace;text-transform:uppercase;letter-spacing:.08em">
                    <a href="{_escape(article_url)}" style="color:#2563eb;text-decoration:none">Ler na integra</a>
                    <span style="color:#8a8580"> · </span>
                    <a href="{_escape(source_url)}" style="color:#6b6662;text-decoration:none">Fonte principal</a>
                  </p>
                </article>
                """
            )
        sections.append(
            f"""
            <section>
              <h2 style="margin:28px 0 0;font:700 11px Menlo,Consolas,monospace;text-transform:uppercase;letter-spacing:.18em;color:#6b6662">
                {_escape(category)}
              </h2>
              {''.join(items)}
            </section>
            """
        )

    summary = edition.get("summary") or ""
    return f"""<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1816">
    <main style="max-width:640px;margin:0 auto;padding:24px 16px">
      <div style="background:#faf8f5;border:1px solid #e0ddd8;padding:24px">
        <p style="margin:0 0 12px;font:11px Menlo,Consolas,monospace;color:#2563eb;text-transform:uppercase;letter-spacing:.12em">
          DevPulse
        </p>
        <h1 style="margin:0 0 16px;font:900 34px Georgia,serif;line-height:1.05">
          <a href="{_escape(edition_url)}" style="color:#1a1816;text-decoration:none">{_escape(edition.get('title') or 'DevPulse')}</a>
        </h1>
        <p style="margin:0 0 18px;color:#3a3735;line-height:1.7">{_escape(summary)}</p>
        {''.join(sections)}
        <hr style="border:none;border-top:1px solid #e0ddd8;margin:28px 0 16px" />
        <p style="margin:0;color:#6b6662;font-size:12px;line-height:1.6">
          Voce recebe este email porque se inscreveu no DevPulse.
          <a href="{_escape(unsubscribe_url)}" style="color:#2563eb">Cancelar inscricao</a>.
        </p>
      </div>
    </main>
  </body>
</html>"""


def _escape(value: object) -> str:
    return html.escape(str(value or ""), quote=True)
