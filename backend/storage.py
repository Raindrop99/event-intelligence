import hashlib
import os
import time

from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.errors import ServerSelectionTimeoutError

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.environ.get("MONGO_DB", "media_risk")

_client = None


def _db():
    global _client
    if _client is None:
        _client = MongoClient(
            MONGO_URI,
            serverSelectionTimeoutMS=4000,
        )
    return _client[MONGO_DB]


def _events():
    return _db()["events"]


def _gauges():
    return _db()["gauges"]


def init():
    """
    Initialize MongoDB collections and indexes.
    """

    try:
        ev = _events()

        ev.create_index(
            [("dedupe_key", ASCENDING)],
            unique=True,
        )
        ev.create_index([("ts", DESCENDING)])
        ev.create_index([("domain", ASCENDING)])
        ev.create_index([("analyzed_at", ASCENDING)])

        gauges = _gauges()
        gauges.create_index(
            [("name", ASCENDING)],
            unique=True,
        )
        _llm_requests().create_index(
            [("day", ASCENDING)],
            unique=True,
        )

    except ServerSelectionTimeoutError as e:
        raise RuntimeError(
            f"MongoDB not reachable at {MONGO_URI}. "
            "Is the MongoDB service running?"
        ) from e


def dedupe_key(source: str, external_id: str) -> str:
    return hashlib.sha256(
        f"{source}:{external_id}".encode()
    ).hexdigest()


# ------------------------------------------------------------------
# Events
# ------------------------------------------------------------------

def insert_items(items: list[dict]) -> int:
    """
    Upsert raw events.
    """

    new = 0
    ev = _events()

    for it in items:

        key = dedupe_key(
            it["source"],
            it["external_id"],
        )

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

        res = ev.update_one(
            {"dedupe_key": key},
            {"$setOnInsert": doc},
            upsert=True,
        )

        if res.upserted_id is not None:
            new += 1

    return new


def unanalyzed(limit: int = 25) -> list[dict]:
    """
    Events waiting for analysis.
    """

    return list(
        _events()
        .find(
            {
                "$or": [
                    {"analyzed_at": None},
                    {"reanalyze": True},
                ]
            },
            {"_id": 0},
        )
        .sort("ts", DESCENDING)
        .limit(limit)
    )


def save_analysis(key: str, a: dict):

    _events().update_one(
        {"dedupe_key": key},
        {
            "$set": {
                "domain": a.get("domain", "other"),
                "severity": int(a.get("severity", 1)),
                "sentiment": float(a.get("sentiment", 0.0)),
                "ai_summary": a.get("ai_summary", ""),
                "why_it_matters": a.get("why_it_matters", ""),
                "impact_summary": a.get("impact_summary", ""),
                "channels": a.get("channels", []),
                "winners": a.get("winners", []),
                "winner_reasons": a.get(
                    "winner_reasons",
                    [],
                ),
                "losers": a.get("losers", []),
                "loser_reasons": a.get(
                    "loser_reasons",
                    [],
                ),
                "second_order": a.get(
                    "second_order",
                    "",
                ),
                "urgency": a.get("urgency", ""),
                "action_label": a.get(
                    "action_label",
                    "",
                ),
                "next_action": a.get(
                    "next_action",
                    "",
                ),
                "action_plan": a.get(
                    "action_plan",
                    [],
                ),
                "economic_impact": a.get(
                    "economic_impact",
                    {},
                ),
                "economic_impact_after": a.get(
                    "economic_impact_after",
                    {},
                ),
                "official_brief": a.get(
                    "official_brief",
                    {},
                ),
                "confidence": float(
                    a.get("confidence", 0.3)
                ),
                "mode": a.get("mode", "basic"),
                "prompt_version": a.get(
                    "prompt_version",
                    "",
                ),
                "analyzed_at": time.time(),
                "reanalyze": False,
            }
        },
    )


def save_instant(key: str, fields: dict):
    """
    Store a deterministic instant read for an event without marking it fully
    analyzed.
    """

    if not fields:
        return

    _events().update_one(
        {"dedupe_key": key},
        {
            "$set": fields,
        },
    )


def unclassified(limit: int = 100) -> list[dict]:
    """
    Return newly collected events that still need a full AI analysis.
    """

    return list(
        _events()
        .find(
            {
                "analyzed_at": None,
            },
            {"_id": 0},
        )
        .sort("ts", DESCENDING)
        .limit(limit)
    )


def requeue_for_reanalysis() -> int:
    """
    Flag analyzed events that are missing newer AI fields so they are
    re-analyzed in the background.
    """

    res = _events().update_many(
        {
            "analyzed_at": {"$ne": None},
            "mode": {"$ne": "demo"},
            "$or": [
                {"urgency": {"$exists": False}},
                {"urgency": ""},
                {"action_plan": {"$exists": False}},
                {"economic_impact": {"$exists": False}},
                {"economic_impact_after": {"$exists": False}},
                {"ai_summary": {"$exists": False}},
                {"why_it_matters": {"$exists": False}},
                {"official_brief": {"$exists": False}},
            ],
            "reanalyze": {"$ne": True},
        },
        {
            "$set": {
                "reanalyze": True,
            }
        },
    )

    return res.modified_count


# ------------------------------------------------------------------
# Cached body / enrichment
# ------------------------------------------------------------------

_NO_BODY = {
    "_id": 0,
    "body": 0,
}


def set_body(key: str, body: str):
    """
    Cache fetched article body.
    """

    _events().update_one(
        {"dedupe_key": key},
        {
            "$set": {
                "body": body,
            }
        },
    )


def set_action_plan(key: str, plan: list[dict]):
    """
    Cache generated action plan.
    """

    _events().update_one(
        {"dedupe_key": key},
        {
            "$set": {
                "action_plan": plan,
            }
        },
    )


def set_fields(key: str, fields: dict):
    """
    Update arbitrary fields on an event.
    """

    if not fields:
        return

    _events().update_one(
        {"dedupe_key": key},
        {
            "$set": fields,
        },
    )


# ------------------------------------------------------------------
# Read APIs
# ------------------------------------------------------------------

def recent_events(
    domain: str | None = None,
    limit: int = 60,
    max_age_hours: float | None = None,
) -> list[dict]:
    """
    Return analyzed events ordered by newest first.
    """

    q = {
        "analyzed_at": {
            "$ne": None,
        }
    }

    if domain:
        q["domain"] = domain

    if max_age_hours:

        fresh_query = dict(q)

        fresh_query["ts"] = {
            "$gte": time.time() - max_age_hours * 3600,
        }

        fresh = list(
            _events()
            .find(fresh_query, _NO_BODY)
            .sort("ts", DESCENDING)
            .limit(limit)
        )

        if fresh:
            return fresh

    return list(
        _events()
        .find(q, _NO_BODY)
        .sort("ts", DESCENDING)
        .limit(limit)
    )


def event_by_key(key: str) -> dict | None:
    return _events().find_one(
        {
            "dedupe_key": key,
        },
        _NO_BODY,
    )


def event_full(key: str) -> dict | None:
    """
    Return full document including cached body.
    """

    return _events().find_one(
        {
            "dedupe_key": key,
        },
        {
            "_id": 0,
        },
    )
# ------------------------------------------------------------------
# Related Events
# ------------------------------------------------------------------

def related_events(
    domain: str,
    exclude_key: str,
    limit: int = 6,
) -> list[dict]:
    """
    Return other analyzed events from the same domain.
    """

    query = {
        "analyzed_at": {"$ne": None},
        "domain": domain,
        "dedupe_key": {"$ne": exclude_key},
    }

    return list(
        _events()
        .find(query, _NO_BODY)
        .sort("ts", DESCENDING)
        .limit(limit)
    )


# ------------------------------------------------------------------
# Statistics
# ------------------------------------------------------------------

def stats() -> dict:
    """
    Dashboard statistics.
    """

    ev = _events()

    return {
        "total": ev.count_documents({}),
        "analyzed": ev.count_documents(
            {
                "analyzed_at": {
                    "$ne": None
                }
            }
        ),
        "high_severity": ev.count_documents(
            {
                "severity": {
                    "$gte": 4
                }
            }
        ),
    }


def clear_demo():
    """
    Remove demo events.
    """

    _events().delete_many(
        {
            "source": {
                "$regex": "^demo"
            }
        }
    )


# ------------------------------------------------------------------
# MongoDB Gauges
# ------------------------------------------------------------------

def set_gauge(
    name: str,
    value: float,
    change_pct: float,
):
    """
    Store a market gauge in MongoDB.
    """

    _gauges().update_one(
        {
            "name": name
        },
        {
            "$set": {
                "name": name,
                "value": value,
                "change_pct": change_pct,
                "updated": time.time(),
            }
        },
        upsert=True,
    )


def _llm_requests():
    return _db()["llm_requests"]


def llm_requests_today(day: str) -> int:
    doc = _llm_requests().find_one({"day": day})
    return int(doc["count"]) if doc else 0


def record_llm_request(day: str):
    _llm_requests().update_one(
        {"day": day},
        {
            "$inc": {"count": 1},
            "$setOnInsert": {"created_at": time.time()},
        },
        upsert=True,
    )


def get_gauges() -> list[dict]:
    """
    Return all market gauges stored in MongoDB.

    Example document:
    {
        "name": "S&P 500",
        "value": 6123.45,
        "change_pct": 1.25,
        "updated": 1719234567.12
    }
    """

    return list(
        _gauges()
        .find(
            {},
            {"_id": 0},
        )
        .sort("name", ASCENDING)
    )