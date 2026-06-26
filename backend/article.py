"""Fetch and extract readable article text from a URL.

Used by the LLM analysis path so Claude reads the whole story, not just the
headline. Stdlib-only extraction (html.parser) — no extra dependency. Fetched
bodies are cached on the event so re-analysis never re-fetches.
"""
import logging
import re
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser

import requests

log = logging.getLogger(__name__)

_UA = {"User-Agent": "Mozilla/5.0 (compatible; event-intelligence/0.1; research prototype)"}
_BLOCK = {"script", "style", "nav", "header", "footer", "aside", "form", "noscript", "figure", "svg"}
_TEXT = {"p", "h1", "h2", "h3", "h4", "li", "blockquote"}


class _Extract(HTMLParser):
    """Collect visible text inside paragraph/heading/list tags, skipping chrome."""

    def __init__(self):
        super().__init__()
        self._skip = 0     # inside a blocked (chrome) element
        self._depth = 0    # inside a text element
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag in _BLOCK:
            self._skip += 1
        elif tag in _TEXT:
            self._depth += 1

    def handle_endtag(self, tag):
        if tag in _BLOCK and self._skip:
            self._skip -= 1
        elif tag in _TEXT and self._depth:
            self._depth -= 1
            self.parts.append("\n")

    def handle_data(self, data):
        if self._skip == 0 and self._depth > 0:
            t = data.strip()
            if t:
                self.parts.append(t + " ")


def fetch_text(url: str, max_chars: int = 3500, timeout: int = 12) -> str:
    """Return the readable body text of an article URL, or '' on any failure."""
    if not isinstance(url, str) or not url.startswith(("http://", "https://")):
        return ""
    try:
        r = requests.get(url, headers=_UA, timeout=timeout)
        r.raise_for_status()
        if "html" not in r.headers.get("content-type", "").lower():
            return ""
        p = _Extract()
        p.feed(r.text)
        text = re.sub(r"[ \t]{2,}", " ", "".join(p.parts))
        text = re.sub(r"\n{2,}", "\n", text).strip()
        return text[:max_chars]
    except Exception as e:  # blocked, timeout, paywall — degrade to headline
        log.warning("article fetch failed (%s): %s", url, e)
        return ""


def fetch_many(urls: list[str], workers: int = 8) -> list[str]:
    """Fetch several article URLs concurrently; order matches the input."""
    if not urls:
        return []
    with ThreadPoolExecutor(max_workers=min(workers, len(urls))) as ex:
        return list(ex.map(fetch_text, urls))
