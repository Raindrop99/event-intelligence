"""Storage exactly per the master architecture:
  text & events  -> MongoDB   (db: media_risk, collection: events)
  prices/numbers -> PostgreSQL (db: media_risk, table: gauges)
"""
import hashlib
import os
import time

import psycopg2
from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.errors import ServerSelectionTimeoutError

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.environ.get("MONGO_DB", "media_risk")

_client = None


def _events():
    global _client
    if _client is None:
        _client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=4000)
    return _client[MONGO_DB]["events"]


def _meta():
    global _client
    if _client is None:
        _client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=4000)
    return _client[MONGO_DB]["meta"]


def _pg():
    # Managed Postgres (Neon, Render, Supabase, …) hands you a single connection
    # string — use it directly if DATABASE_URL is set; otherwise fall back to the
    # discrete PG_* parts (local dev). The string already carries sslmode=require.
    dsn = os.environ.get("DATABASE_URL")
    if dsn:
        return psycopg2.connect(dsn, connect_timeout=4)
    return psycopg2.connect(
        host=os.environ.get("PG_HOST", "localhost"),
        port=os.environ.get("PG_PORT", "5432"),
        dbname=os.environ.get("PG_DB", "media_risk"),
        user=os.environ.get("PG_USER", "postgres"),
        password=os.environ.get("PG_PASSWORD", "postgres"),
        connect_timeout=4,
    )


def init():
    """Create indexes/tables. Raise a clear, human error if a DB is unreachable."""
    try:
        ev = _events()
        ev.create_index([("dedupe_key", ASCENDING)], unique=True)
        ev.create_index([("ts", DESCENDING)])
        ev.create_index([("domain", ASCENDING)])
        ev.create_index([("analyzed_at", ASCENDING)])
    except ServerSelectionTimeoutError as e:
        raise RuntimeError(
            f"MongoDB not reachable at {MONGO_URI}. Is the MongoDB service running?"
        ) from e
    try:
        with _pg() as c, c.cursor() as cur:
            cur.execute(
                "CREATE TABLE IF NOT EXISTS gauges ("
                " name TEXT PRIMARY KEY, value DOUBLE PRECISION,"
                " change_pct DOUBLE PRECISION, updated DOUBLE PRECISION)"
            )
    except psycopg2.OperationalError as e:
        raise RuntimeError(
            "PostgreSQL not reachable (host="
            + os.environ.get("PG_HOST", "localhost")
            + ", db=" + os.environ.get("PG_DB", "media_risk")
            + "). Is the PostgreSQL service running and the database created?"
        ) from e


def dedupe_key(source: str, external_id: str) -> str:
    return hashlib.sha256(f"{source}:{external_id}".encode()).hexdigest()


# ---------- events (MongoDB) ----------

def insert_items(items: list[dict]) -> int:
    """Upsert raw items; returns count of new docs. Re-runs are safe."""
    new = 0
    ev = _events()
    for it in items:
        key = dedupe_key(it["source"], it["external_id"])
        doc = {
            "dedupe_key": key,
            "source": it["source"],
            "type": it.get("type", "news"),
            "title": it.get("title", ""),
            "content": it.get("content", ""),
            "url": it.get("url"),
            "ts": it.get("ts", time.time()),
            "analyzed_at": None,
        }
        res = ev.update_one({"dedupe_key": key}, {"$setOnInsert": doc}, upsert=True)
        if res.upserted_id is not None:
            new += 1
    return new


def unanalyzed(limit: int = 25) -> list[dict]:
    """Events the agent still needs to do: never analysed, OR flagged stale for
    re-analysis (those keep their old analysis visible until the agent redoes them)."""
    return list(
        _events()
        .find({"$or": [{"analyzed_at": None}, {"reanalyze": True}]}, {"_id": 0})
        .sort("ts", DESCENDING)
        .limit(limit)
    )


def unclassified(limit: int = 600) -> list[dict]:
    """Freshly collected items the agent hasn't touched yet (analyzed_at is None),
    newest first. Used to give them an instant deterministic read so they show in
    the live feed right away instead of waiting on the rate-limited agent."""
    return list(
        _events()
        .find({"analyzed_at": None},
              {"_id": 0, "dedupe_key": 1, "title": 1, "content": 1, "ts": 1})
        .sort("ts", DESCENDING)
        .limit(limit)
    )


def save_instant(key: str, a: dict):
    """A quick deterministic read so a freshly collected item appears in the live
    feed immediately, even when the agent is rate-limited. Flagged reanalyze=True so
    the agent upgrades it to a full brief later (newest-first)."""
    _events().update_one(
        {"dedupe_key": key},
        {"$set": {
            "domain": a.get("domain", "other"),
            "severity": int(a.get("severity", 1)),
            "sentiment": float(a.get("sentiment", 0.0)),
            "ai_summary": a.get("ai_summary", ""),
            "impact_summary": a.get("impact_summary", ""),
            "confidence": float(a.get("confidence", 0.3)),
            "mode": "instant",
            "prompt_version": "",          # stale -> agent upgrades it later
            "analyzed_at": time.time(),    # makes it visible in the live feed now
            "reanalyze": True,             # agent rewrites it as a full brief
        }},
    )


def save_analysis(key: str, a: dict):
    _events().update_one(
        {"dedupe_key": key},
        {"$set": {
            "domain": a.get("domain", "other"),
            "severity": int(a.get("severity", 1)),
            "sentiment": float(a.get("sentiment", 0.0)),
            "ai_summary": a.get("ai_summary", ""),
            "why_it_matters": a.get("why_it_matters", ""),
            "government_impact": a.get("government_impact", ""),
            "impact_summary": a.get("impact_summary", ""),
            "channels": a.get("channels", []),
            "winners": a.get("winners", []),
            "winner_reasons": a.get("winner_reasons", []),
            "losers": a.get("losers", []),
            "loser_reasons": a.get("loser_reasons", []),
            "second_order": a.get("second_order", ""),
            "urgency": a.get("urgency", ""),
            "action_label": a.get("action_label", ""),
            "next_action": a.get("next_action", ""),
            "action_plan": a.get("action_plan", []),
            "economic_impact": a.get("economic_impact", {}),
            "economic_impact_after": a.get("economic_impact_after", {}),
            "official_brief": a.get("official_brief", {}),
            "confidence": float(a.get("confidence", 0.3)),
            "mode": a.get("mode", "basic"),
            "prompt_version": a.get("prompt_version", ""),
            "analyzed_at": time.time(),
            "reanalyze": False,            # clear the stale flag once redone
        }},
    )


def requeue_for_reanalysis() -> int:
    """Flag analysed events that predate the agent's full schema (no `urgency`
    field) so the agent redoes them — WITHOUT nulling analyzed_at, so they stay
    visible with their old analysis until the agent gets to them."""
    res = _events().update_many(
        {"analyzed_at": {"$ne": None},
         "mode": {"$ne": "demo"},          # leave curated demo events alone
         # missing the agent's urgency OR the newer action_plan field
         "$or": [{"urgency": {"$exists": False}}, {"urgency": ""},
                 {"action_plan": {"$exists": False}},
                 {"economic_impact": {"$exists": False}},
                 {"economic_impact_after": {"$exists": False}},
                 {"ai_summary": {"$exists": False}},
                 {"why_it_matters": {"$exists": False}},
                 {"government_impact": {"$exists": False}},
                 {"official_brief": {"$exists": False}}],
         "reanalyze": {"$ne": True}},
        {"$set": {"reanalyze": True}},
    )
    return res.modified_count


# the cached article body is large and only the analyzer needs it — keep it
# out of the read-facing endpoints to keep payloads small.
_NO_BODY = {"_id": 0, "body": 0}


def set_body(key: str, body: str):
    """Cache the fetched full-article text on the event (used by the LLM path)."""
    _events().update_one({"dedupe_key": key}, {"$set": {"body": body}})


def set_action_plan(key: str, plan: list[dict]):
    """Cache an agent-generated action plan on the event (filled on first view)."""
    _events().update_one({"dedupe_key": key}, {"$set": {"action_plan": plan}})


def set_fields(key: str, fields: dict):
    """Cache one or more agent-generated fields on the event (filled on first view)."""
    if fields:
        _events().update_one({"dedupe_key": key}, {"$set": fields})


def recent_events(domain: str | None = None, limit: int = 60,
                  max_age_hours: float | None = None) -> list[dict]:
    """Most-recent analysed events, newest first. With max_age_hours, restrict to
    events from the last N hours — but only if there ARE any (otherwise fall back to
    the newest available, so the feed never goes empty while analysis catches up)."""
    q: dict = {"analyzed_at": {"$ne": None}}
    if domain:
        q["domain"] = domain
    if max_age_hours:
        fresh_q = dict(q, ts={"$gte": time.time() - max_age_hours * 3600})
        fresh = list(_events().find(fresh_q, _NO_BODY).sort("ts", DESCENDING).limit(limit))
        if fresh:
            return fresh
    return list(_events().find(q, _NO_BODY).sort("ts", DESCENDING).limit(limit))


def event_by_key(key: str) -> dict | None:
    return _events().find_one({"dedupe_key": key}, _NO_BODY)


def event_full(key: str) -> dict | None:
    """The full event doc INCLUDING the cached body — used to re-analyse one event."""
    return _events().find_one({"dedupe_key": key}, {"_id": 0})


def related_events(domain: str, exclude_key: str, limit: int = 6) -> list[dict]:
    """Other recent analyzed events in the same domain (for the detail page)."""
    q = {"analyzed_at": {"$ne": None}, "domain": domain,
         "dedupe_key": {"$ne": exclude_key}}
    return list(_events().find(q, _NO_BODY).sort("ts", DESCENDING).limit(limit))


def stats() -> dict:
    ev = _events()
    return {
        "total": ev.count_documents({}),
        "analyzed": ev.count_documents({"analyzed_at": {"$ne": None}}),
        "high_severity": ev.count_documents({"severity": {"$gte": 4}}),
    }


def clear_demo():
    _events().delete_many({"source": {"$regex": "^demo"}})


# ---------- LLM request budget (persists across restarts) ----------

def llm_requests_today(day: str) -> int:
    """How many agent requests have been spent on the given UTC day (0 once the day
    rolls over). Persisted in Mongo so a restart can't reset the count and blow past
    the provider's daily free cap."""
    doc = _meta().find_one({"_id": "llm_usage"})
    if not doc or doc.get("day") != day:
        return 0
    return int(doc.get("count", 0))


def record_llm_request(day: str) -> int:
    """Count one agent request for `day` (resetting when the day changes). Returns
    the new running total for the day."""
    doc = _meta().find_one({"_id": "llm_usage"})
    if not doc or doc.get("day") != day:
        _meta().update_one({"_id": "llm_usage"},
                           {"$set": {"day": day, "count": 1}}, upsert=True)
        return 1
    new = int(doc.get("count", 0)) + 1
    _meta().update_one({"_id": "llm_usage"}, {"$set": {"count": new}})
    return new


# ---------- gauges (PostgreSQL) ----------

def set_gauge(name: str, value: float, change_pct: float):
    with _pg() as c, c.cursor() as cur:
        cur.execute(
            "INSERT INTO gauges (name, value, change_pct, updated) VALUES (%s,%s,%s,%s)"
            " ON CONFLICT (name) DO UPDATE SET value=EXCLUDED.value,"
            " change_pct=EXCLUDED.change_pct, updated=EXCLUDED.updated",
            (name, value, change_pct, time.time()),
        )


def get_gauges() -> list[dict]:
    with _pg() as c, c.cursor() as cur:
        cur.execute("SELECT name, value, change_pct, updated FROM gauges ORDER BY name")
        rows = cur.fetchall()
    return [
        {"name": r[0], "value": r[1], "change_pct": r[2], "updated": r[3]}
        for r in rows
    ]
