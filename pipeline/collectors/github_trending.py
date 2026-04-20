import requests
from bs4 import BeautifulSoup
from loguru import logger
from pipeline.models import RawArticle

BASE_URL = "https://github.com/trending"
HEADERS = {"User-Agent": "Mozilla/5.0 (DevPulse Newsletter Bot)"}


def collect(languages: list[str], since: str = "weekly") -> list[RawArticle]:
    """Coleta repositórios em alta do GitHub Trending."""
    articles: list[RawArticle] = []
    seen_urls: set[str] = set()

    for language in languages:
        try:
            url = BASE_URL
            params = {"since": since}
            if language:
                url = f"{BASE_URL}/{language}"

            response = requests.get(url, params=params, headers=HEADERS, timeout=10)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, "html.parser")
            repos = soup.select("article.Box-row")

            count = 0
            for repo in repos:
                title_el = repo.select_one("h2 a")
                if not title_el:
                    continue

                # ex: "/ owner / repo" → limpa
                repo_path = title_el.get("href", "").strip().lstrip("/")
                repo_url = f"https://github.com/{repo_path}"

                if repo_url in seen_urls:
                    continue
                seen_urls.add(repo_url)

                title = repo_path.replace("/", " / ")

                description_el = repo.select_one("p")
                snippet = description_el.get_text(strip=True) if description_el else ""

                stars_el = repo.select_one("a[href$='/stargazers']")
                stars = stars_el.get_text(strip=True) if stars_el else ""

                lang_el = repo.select_one("[itemprop='programmingLanguage']")
                lang = lang_el.get_text(strip=True) if lang_el else ""

                extra = " | ".join(filter(None, [
                    f"⭐ {stars}" if stars else "",
                    f"Linguagem: {lang}" if lang else "",
                ]))
                full_snippet = f"{snippet} {extra}".strip()

                articles.append(
                    RawArticle(
                        title=f"[GitHub] {title}",
                        url=repo_url,
                        snippet=full_snippet,
                        source="GitHub Trending",
                        collector="github_trending",
                        metadata={
                            "language": lang or None,
                            "stars": stars or None,
                            "since": since,
                            "repo_path": repo_path,
                        },
                    )
                )
                count += 1

            label = language if language else "all"
            logger.info(f"[GitHub Trending] {label}: {count} repositórios coletados")

        except Exception as e:
            logger.error(f"[GitHub Trending] Falha ao coletar (lang={language}): {e}")

    return articles
