from __future__ import annotations

from io import BytesIO

import pytest

from workflows.crawler import CrawlError, fetch_public_sources


class _Response:
    headers = type("Headers", (), {"get_content_charset": lambda self: "utf-8"})()

    def __init__(self, body: bytes):
        self.body = body

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self, limit=-1):
        return BytesIO(self.body).read(limit)


def test_fetch_public_sources_extracts_visible_text_and_provenance():
    def opener(_request, timeout):
        assert timeout == 3
        return _Response(b"<html><title>Demo Shop</title><script>ignore()</script><body>Hello <b>Macau</b></body></html>")

    sources = fetch_public_sources(("https://example.com/shop",), timeout=3, opener=opener)

    assert sources[0]["source_id"] == "WEB-001"
    assert sources[0]["title"] == "Demo Shop"
    assert "Hello" in sources[0]["content"]
    assert "ignore" not in sources[0]["content"]
    assert sources[0]["evidence"][0]["locator"] == "https://example.com/shop"


def test_fetch_public_sources_rejects_non_http_urls():
    with pytest.raises(CrawlError, match="invalid_url"):
        fetch_public_sources(("file:///secret",), opener=lambda *_args, **_kwargs: None)


def test_fetch_public_sources_enforces_response_limit():
    with pytest.raises(CrawlError, match="response_too_large"):
        fetch_public_sources(("https://example.com",), max_bytes=3, opener=lambda *_args, **_kwargs: _Response(b"1234"))
