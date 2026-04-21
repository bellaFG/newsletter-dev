import requests
from datetime import datetime, timezone
from loguru import logger
from pipeline.models import RawArticle

REDDIT_API = "https://www.reddit.com/r/{subreddit}/top.json"
HEADERS = {"User-Agent": "Mozilla/5.0 (DevPulse Newsletter Bot)"}


def collect(subreddits: list[dict]) -> list[RawArticle]:
    """Coleta posts em alta dos subreddits configurados (sem autenticação)."""
    articles: list[RawArticle] = []

    for config in subreddits:
        subreddit = config["subreddit"]
        limit = config.get("limit", 10)

        try:
            url = REDDIT_API.format(subreddit=subreddit)
            response = requests.get(
                url,
                headers=HEADERS,
                params={"limit": limit, "t": "week"},
                timeout=10,
            )
            response.raise_for_status()

            data = response.json()
            posts = data.get("data", {}).get("children", [])

            count = 0
            for post in posts:
                p = post.get("data", {})

                # Ignora posts sem URL externa (posts de texto puro do Reddit)
                url_post = p.get("url", "")
                if not url_post or "reddit.com" in url_post:
                    url_post = f"https://www.reddit.com{p.get('permalink', '')}"

                title = p.get("title", "").strip()
                if not title:
                    continue

                score = p.get("score", 0)
                num_comments = p.get("num_comments", 0)
                selftext = p.get("selftext", "")[:300]
                created_utc = p.get("created_utc")
                published_at = (
                    datetime.fromtimestamp(created_utc, tz=timezone.utc)
                    if isinstance(created_utc, (int, float))
                    else None
                )

                snippet = selftext if selftext else f"Score: {score} | Comentários: {num_comments}"

                articles.append(
                    RawArticle(
                        title=title,
                        url=url_post,
                        snippet=snippet,
                        source=f"r/{subreddit}",
                        published_at=published_at,
                        collector="reddit",
                        metadata={
                            "subreddit": subreddit,
                            "score": score,
                            "num_comments": num_comments,
                            "permalink": p.get("permalink", ""),
                            "is_reddit_thread": "reddit.com" in url_post,
                        },
                    )
                )
                count += 1

            logger.info(f"[Reddit] r/{subreddit}: {count} posts coletados")

        except Exception as e:
            logger.error(f"[Reddit] Falha ao coletar r/{subreddit}: {e}")

    return articles
