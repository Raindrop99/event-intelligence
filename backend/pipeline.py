"""Pipeline: Collect -> (Verify*) -> Understand -> Trace impact -> store.

demo mode: loads curated dummy events (with full impact ledgers) + demo gauges.
live mode: runs the real collectors, then the analysis layer, then live gauges.

*Verify in this starter = source allow-listing + dedupe; the full
three-verdict claim-verification module is the next build step.
"""
import logging
import os

import storage

log = logging.getLogger(__name__)


def run() -> dict:
    mode = os.environ.get("DATA_MODE", "live").lower()
    return run_demo() if mode == "demo" else run_live()


def run_demo() -> dict:
    import demo_data
    new = storage.insert_items([e["item"] for e in demo_data.DEMO_EVENTS])
    for e in demo_data.DEMO_EVENTS:
        key = storage.dedupe_key(e["item"]["source"], e["item"]["external_id"])
        storage.save_analysis(key, e["analysis"])
    for g in demo_data.DEMO_GAUGES:
        storage.set_gauge(g["name"], g["value"], g["change_pct"])
    log.info("demo pipeline: %d new events seeded", new)
    return {"mode": "demo", "new_events": new}


def run_live() -> dict:
    import analysis
    import collectors
    storage.clear_demo()  # replace any seeded demo events with real live data
    items = collectors.collect_all_live()
    new = storage.insert_items(items)
    # Instant deterministic read for anything not yet analysed, so the live feed
    # fills immediately even when the agent's daily quota is exhausted. The agent
    # then upgrades these to full briefs (newest-first, quota permitting).
    analysis.instant_analyze(storage.unclassified())
    analysis.analyze_pending()
    for g in collectors.collect_gauges():
        storage.set_gauge(g["name"], g["value"], g["change_pct"])
    log.info("live pipeline: %d collected, %d new", len(items), new)
    return {"mode": "live", "collected": len(items), "new_events": new}
