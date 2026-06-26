"""Live collectors — used when DATA_MODE=live.
All keyless ones work with zero setup; keyed ones skip gracefully if no key.
Every collector returns list[dict] with: source, external_id, type, title,
content, url, ts.
"""
import logging
import os
import time
from datetime import datetime, timezone

import requests

log = logging.getLogger(__name__)
TIMEOUT = 25


def _safe(fn, name):
    try:
        out = fn()
        log.info("%s: %d items", name, len(out))
        return out
    except Exception as e:  # one dead API never stops the run
        log.warning("%s failed: %s", name, e)
        return []


# ---------- keyless ----------

# Abu Dhabi / UAE / Gulf focus + the global economic forces that move its economy
# (oil & OPEC, sovereign funds, trade). GDELT needs an OR-query in parentheses.
_GDELT_Q = ('("Abu Dhabi" OR "United Arab Emirates" OR UAE OR Dubai OR "Gulf" OR GCC OR '
            'ADNOC OR Mubadala OR ADIA OR ADQ OR ADGM OR OPEC OR "oil prices" OR '
            '"sovereign wealth" OR "UAE economy" OR "Gulf trade")')


def collect_gdelt(query=_GDELT_Q, n=50):
    # GDELT requires OR-queries in parentheses; otherwise it returns a
    # plain-text error (not JSON).
    r = requests.get(
        "https://api.gdeltproject.org/api/v2/doc/doc",
        params={"query": query, "mode": "artlist", "format": "json", "maxrecords": n},
        headers={"User-Agent": "event-intelligence/0.1 (research prototype)"},
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    out = []
    for a in r.json().get("articles", []):
        ts = a.get("seendate")
        when = (datetime.strptime(ts, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc).timestamp()
                if ts else time.time())
        out.append(dict(source="gdelt", external_id=a["url"], type="news",
                        title=a.get("title", ""), content=a.get("title", ""),
                        url=a.get("url"), ts=when))
    return out


def collect_hackernews(n=30):
    # the current front page — broad tech / world / science, not one topic
    r = requests.get(
        "https://hn.algolia.com/api/v1/search",
        params={"tags": "front_page", "hitsPerPage": n},
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    out = []
    for h in r.json().get("hits", []):
        out.append(dict(source="hackernews", external_id=h["objectID"], type="social",
                        title=h.get("title") or "",
                        content=h.get("story_text") or h.get("title") or "",
                        url=h.get("url") or f"https://news.ycombinator.com/item?id={h['objectID']}",
                        ts=h.get("created_at_i", time.time())))
    return out


def collect_reddit_public(subs=("dubai", "UAE", "worldnews", "economics",
                                "business", "energy", "geopolitics", "news"), n=15):
    headers = {"User-Agent":
               "windows:event-intelligence:v0.1 (research prototype; contact: local)"}
    out = []
    for sub in subs:
        try:
            r = requests.get(f"https://www.reddit.com/r/{sub}/hot.json",
                             params={"limit": n}, headers=headers, timeout=TIMEOUT)
            r.raise_for_status()
        except Exception as e:  # one blocked subreddit shouldn't kill the rest
            log.warning("reddit r/%s failed: %s", sub, e)
            continue
        for ch in r.json()["data"]["children"]:
            p = ch["data"]
            out.append(dict(source="reddit", external_id=p["id"], type="social",
                            title=p["title"], content=p.get("selftext") or p["title"],
                            url=f"https://reddit.com{p['permalink']}",
                            ts=p.get("created_utc", time.time())))
    return out


def collect_gauges():
    """VIX, oil, gold, dollar index via yfinance. Returns list of gauge dicts."""
    import yfinance as yf
    symbols = {"VIX": "^VIX", "Oil (WTI)": "CL=F", "Gold": "GC=F", "Dollar (DXY)": "DX-Y.NYB"}
    gauges = []
    for name, sym in symbols.items():
        try:
            h = yf.Ticker(sym).history(period="5d")["Close"].dropna()
            if len(h) >= 2:
                val, prev = float(h.iloc[-1]), float(h.iloc[-2])
                gauges.append(dict(name=name, value=round(val, 2),
                                   change_pct=round((val - prev) / prev * 100, 2)))
        except Exception as e:
            log.warning("gauge %s failed: %s", name, e)
    return gauges


# ---------- keyed (optional) ----------

_GNEWS_Q = ('"Abu Dhabi" OR UAE OR Dubai OR Gulf OR OPEC OR ADNOC OR Mubadala OR '
            '"oil price" OR "UAE economy"')


def collect_gnews(n=25):
    key = os.environ.get("GNEWS_KEY")
    if not key:
        return []
    # Abu Dhabi / UAE / Gulf + economy search, sorted by recency
    r = requests.get("https://gnews.io/api/v4/search",
                     params={"q": _GNEWS_Q, "lang": "en", "max": n,
                             "sortby": "publishedAt", "apikey": key},
                     timeout=TIMEOUT)
    r.raise_for_status()
    out = []
    for a in r.json().get("articles", []):
        out.append(dict(source="gnews", external_id=a["url"], type="news",
                        title=a.get("title", ""), content=a.get("description", ""),
                        url=a.get("url"),
                        ts=datetime.fromisoformat(a["publishedAt"].replace("Z", "+00:00")).timestamp()))
    return out


def collect_finnhub(category="general"):
    key = os.environ.get("FINNHUB_KEY")
    if not key:
        return []
    r = requests.get("https://finnhub.io/api/v1/news",
                     params={"category": category, "token": key}, timeout=TIMEOUT)
    r.raise_for_status()
    return [dict(source="finnhub", external_id=str(a["id"]), type="news",
                 title=a.get("headline", ""), content=a.get("summary", ""),
                 url=a.get("url"), ts=a.get("datetime", time.time()))
            for a in r.json()]


def collect_newsapi(n=40):
    key = os.environ.get("NEWSAPI_KEY")
    if not key:
        return []
    # Abu Dhabi / UAE / Gulf + the economic forces that move its economy
    query = ('"Abu Dhabi" OR "United Arab Emirates" OR UAE OR Dubai OR Gulf OR GCC OR '
             'ADNOC OR Mubadala OR ADIA OR OPEC OR "oil price" OR "sovereign wealth"')
    r = requests.get("https://newsapi.org/v2/everything",
                     params={"q": query, "language": "en", "pageSize": n,
                             "sortBy": "publishedAt", "apiKey": key},
                     timeout=TIMEOUT)
    r.raise_for_status()
    out = []
    for a in r.json().get("articles", []):
        if not a.get("title") or a["title"] == "[Removed]":
            continue
        out.append(dict(source="newsapi", external_id=a["url"], type="news",
                        title=a.get("title", ""), content=a.get("description") or a.get("title", ""),
                        url=a.get("url"),
                        ts=datetime.fromisoformat(a["publishedAt"].replace("Z", "+00:00")).timestamp()))
    return out


def collect_all_live() -> list[dict]:
    items = []
    items += _safe(collect_gdelt, "gdelt")
    items += _safe(collect_hackernews, "hackernews")
    items += _safe(collect_reddit_public, "reddit")
    items += _safe(collect_gnews, "gnews")
    items += _safe(collect_finnhub, "finnhub")
    items += _safe(collect_newsapi, "newsapi")
    return items
