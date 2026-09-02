"""Small, opt-in public-web source collector for the competition demo.

This is intentionally not a social-platform scraper. Operators provide one or
more public HTTP(S) URLs; the collector downloads a bounded HTML response and
keeps only visible text plus basic provenance for the QwenPaw Miner.
"""

from __future__ import annotations

import re
import urllib.error
import urllib.request
from html.parser import HTMLParser
from urllib.parse import urlparse


class CrawlError(Exception):
    """Raised when an explicitly configured source cannot be collected."""


class _VisibleTextParser(HTMLParser):
    _ignored = {"script", "style", "noscript", "svg", "template"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._ignored_depth = 0
        self.title = ""
        self._in_title = False
        self._chunks: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:  # noqa: ANN001 - stdlib callback
        tag = tag.lower()
        if tag in self._ignored:
            self._ignored_depth += 1
        elif tag == "title" and self._ignored_depth == 0:
            self._in_title = True

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in self._ignored and self._ignored_depth:
            self._ignored_depth -= 1
        elif tag == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._ignored_depth:
            return
        text = re.sub(r"\s+", " ", data).strip()
        if not text:
            return
        if self._in_title:
            self.title = f"{self.title} {text}".strip()
        self._chunks.append(text)

    @property
    def text(self) -> str:
        return "\n".join(self._chunks)


def fetch_public_sources(urls: tuple[str, ...], *, timeout: float = 15, max_bytes: int = 300_000, opener=None) -> list[dict]:
    """Fetch configured public pages and return Workflow source-shaped records."""

    open_url = opener or urllib.request.urlopen
    sources: list[dict] = []
    for index, raw_url in enumerate(urls, start=1):
        url = raw_url.strip()
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise CrawlError(f"invalid_url:{url}")
        request = urllib.request.Request(
            url,
            headers={"Accept": "text/html,application/xhtml+xml", "User-Agent": "HeritageTraceDemo/1.0"},
        )
        try:
            with open_url(request, timeout=timeout) as response:
                payload = response.read(max_bytes + 1)
        except (OSError, urllib.error.URLError) as exc:
            raise CrawlError(f"fetch_failed:{url}") from exc
        if len(payload) > max_bytes:
            raise CrawlError(f"response_too_large:{url}")
        try:
            html = payload.decode(response.headers.get_content_charset() or "utf-8", errors="replace")
        except AttributeError:
            html = payload.decode("utf-8", errors="replace")
        parser = _VisibleTextParser()
        parser.feed(html)
        text = parser.text[:max_bytes]
        if not text:
            raise CrawlError(f"empty_page:{url}")
        sources.append(
            {
                "source_id": f"WEB-{index:03d}",
                "content_type": "retrieved_text",
                "content": text,
                "evidence": [{"text": text[:2000], "locator": url}],
                "url": url,
                "publisher": parsed.netloc,
                "source_family": "public_web",
                "source_type": "operator_configured_public_page",
                "authorization": "public_page_only",
                "limits": "HTML text extraction only; no login, social posting, or platform API access.",
                "title": parser.title or url,
            }
        )
    return sources
