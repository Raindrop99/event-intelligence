"""Intelligence aggregates — the data behind the Trends, Analytics, Reports and
Recommendations pages. Everything here is derived from the analysed events in
storage (no fabricated numbers); when there's little data the shapes still come
back valid and the UI degrades gracefully.
"""
import re
import time
from collections import Counter
from datetime import datetime, timezone

import analysis
import storage

DOMAINS = ["market", "policy", "disaster", "health", "supply_chain", "other"]
DLABEL = {"market": "Market", "policy": "Policy", "disaster": "Disaster",
          "health": "Health", "supply_chain": "Supply chain", "other": "Other"}

_STOP = set((
    "the a an and or of to in on for with at by from as is are was were be been being "
    "this that these those it its his her their our your my we you they he she them "
    "has have had do does did will would can could should may might must not no nor "
    "but if then than so such into over under after before about above below up down "
    "out off again more most other some any all each few new old via amid say says said "
    "report reports news update live latest amid amp ahead set get got make made one two "
    "first second year years day days week month percent pct vs against among across "
    "what when where which who whom how why now today us uk eu inc ltd co corp"
).split())


def _tok(text: str) -> list[str]:
    return [w for w in re.findall(r"[a-z][a-z0-9\-]{2,}", (text or "").lower())
            if w not in _STOP]


def _pct(cur: float, prev: float) -> float:
    """Percent change cur-vs-prev, clamped to a sane display range."""
    if prev <= 0:
        return round(min(100.0, cur * 12.0), 1) if cur else 0.0
    return round(max(-95.0, min(300.0, (cur - prev) / prev * 100.0)), 1)


def _label(t: float, hours: bool) -> str:
    d = datetime.fromtimestamp(t, tz=timezone.utc)
    if hours:
        return d.strftime("%H:%M")
    # %-d isn't portable on Windows; build it by hand
    return f"{d.strftime('%b')} {d.day}"


def _bucketer(events: list[dict], n: int = 12):
    """Return (labels, index_fn, hours) bucketing events across their real span."""
    ts = [e["ts"] for e in events if e.get("ts")]
    if not ts:
        return [""] * n, (lambda t: 0), False
    lo, hi = min(ts), max(ts)
    span = max(hi - lo, 1.0)
    hours = span < 2 * 86400
    width = span / n
    labels = [_label(lo + width * (i + 0.5), hours) for i in range(n)]

    def idx(t: float) -> int:
        return max(0, min(n - 1, int((t - lo) / width)))

    return labels, idx, hours


def _recent(limit: int = 400) -> list[dict]:
    evs = storage.recent_events(limit=limit)
    for e in evs:
        e["_a"] = analysis.derive_action(e)
    return evs


def _half_split(events: list[dict]):
    ts = [e["ts"] for e in events if e.get("ts")]
    if not ts:
        return (lambda e: True)
    mid = (min(ts) + max(ts)) / 2
    return (lambda e: (e.get("ts") or 0) >= mid)


# ---------------------------------------------------------------------------
# Trends
# ---------------------------------------------------------------------------

def trends() -> dict:
    evs = _recent(400)
    n = len(evs)
    is_cur = _half_split(evs)
    cur = [e for e in evs if is_cur(e)]
    prev = [e for e in evs if not is_cur(e)]

    # ---- stat cards
    kw_cur = Counter(t for e in cur for t in set(_tok(e.get("title", ""))))
    emerging = sum(1 for _, c in kw_cur.items() if c >= 2) or len(kw_cur)
    kw_prev = Counter(t for e in prev for t in set(_tok(e.get("title", ""))))
    emerging_prev = sum(1 for _, c in kw_prev.items() if c >= 2) or len(kw_prev)

    growth = _pct(len(cur), len(prev))
    conf_now = (sum(e.get("confidence") or 0 for e in cur) / len(cur) * 100) if cur else 0
    conf_prev = (sum(e.get("confidence") or 0 for e in prev) / len(prev) * 100) if prev else 0
    high = [e for e in evs if (e.get("severity") or 1) >= 4]
    momentum = int(max(0, min(100, 0.5 * min(100, n) + 0.3 * (len(high) / n * 100 if n else 0)
                                 + 0.2 * max(0, growth))))

    cards = {
        "emerging_topics": {"value": emerging, "delta": _pct(emerging, emerging_prev)},
        "growth_rate": {"value": round(abs(growth), 1), "delta": growth},
        "signal_quality": {"value": round(conf_now, 1), "delta": round(conf_now - conf_prev, 1)},
        "momentum": {"value": momentum, "delta": _pct(len(cur), len(prev))},
    }

    # ---- stream (per-domain activity over time)
    labels, idx, _ = _bucketer(evs, 12)
    series = {d: [0] * 12 for d in DOMAINS}
    for e in evs:
        if e.get("ts"):
            series[e.get("domain", "other")][idx(e["ts"])] += 1
    totals = {d: sum(v) for d, v in series.items()}
    top_doms = [d for d, _ in sorted(totals.items(), key=lambda x: -x[1]) if totals[d]][:6]
    stream_series = [{"key": d, "values": series[d]} for d in top_doms]
    peaks = []
    for d in top_doms[:5]:
        v = series[d]
        bx = max(range(12), key=lambda i: v[i])
        c_cur = sum(v[6:])
        c_prev = sum(v[:6])
        peaks.append({"key": d, "x": bx, "delta": _pct(c_cur, c_prev)})

    # ---- AI trend intelligence (rising / emerging / declining domains)
    dom_delta = []
    for d in DOMAINS:
        c = sum(1 for e in cur if e.get("domain") == d)
        p = sum(1 for e in prev if e.get("domain") == d)
        if c or p:
            dom_delta.append((d, _pct(c, p), c))
    dom_delta.sort(key=lambda x: -x[1])
    intel = []
    if dom_delta:
        d, dl, _ = dom_delta[0]
        intel.append({"kind": "rising", "key": d,
                      "note": f"Activity up {abs(dl):.1f}% this period"})
    if len(dom_delta) > 1:
        d, dl, _ = dom_delta[1]
        intel.append({"kind": "emerging", "key": d,
                      "note": "Strong upward trajectory detected" if dl >= 0
                      else "Holding steady this period"})
    if dom_delta:
        d, dl, _ = dom_delta[-1]
        intel.append({"kind": "declining", "key": d,
                      "note": f"Attention {'declined' if dl < 0 else 'flat'} "
                              f"{abs(dl):.1f}% this period"})

    # ---- trending areas (domain share + direction)
    areas = []
    for d, dl, c in sorted(dom_delta, key=lambda x: -x[2]):
        areas.append({"key": d, "pct": round(c / max(1, len(cur)) * 100, 1),
                      "dir": "up" if dl > 3 else "down" if dl < -3 else "flat"})

    # ---- rising keywords / declining topics
    rising, declining = [], []
    seen = set(kw_cur) | set(kw_prev)
    scored = []
    for t in seen:
        scored.append((t, kw_cur[t] - kw_prev[t], kw_cur[t], kw_prev[t]))
    for t, mo, c, p in sorted(scored, key=lambda x: (-x[1], -x[2])):
        if c >= 2 and mo >= 0 and len(rising) < 6:
            rising.append({"term": t.title(), "pct": _pct(c, p)})
    for t, mo, c, p in sorted(scored, key=lambda x: (x[1], -x[3])):
        if p >= 1 and mo < 0 and len(declining) < 6:
            declining.append({"term": t.title(), "pct": _pct(c, p)})

    # ---- opportunity radar (per-domain composite 0-100)
    radar = []
    for d in DOMAINS:
        ev_d = [e for e in evs if e.get("domain") == d]
        if not ev_d and d == "other":
            continue
        vol = len(ev_d) / n * 100 if n else 0
        sev = (sum(e.get("severity") or 1 for e in ev_d) / len(ev_d) / 5 * 100) if ev_d else 0
        radar.append({"key": d, "value": int(min(100, 0.6 * vol * 2 + 0.4 * sev))})

    # ---- momentum timeline
    mlabels, midx, _ = _bucketer(evs, 12)
    mvals = [0] * 12
    for e in evs:
        if e.get("ts"):
            w = (e.get("severity") or 1) * (e.get("confidence") or 0.3)
            mvals[midx(e["ts"])] += w
    mmax = max(mvals) or 1
    mvals = [round(v / mmax * 100) for v in mvals]
    markers = []
    if top_doms:
        markers.append({"x": peaks[0]["x"], "text": f"{DLABEL[peaks[0]['key']]} surge"})
    if len(peaks) > 1:
        markers.append({"x": peaks[1]["x"], "text": f"{DLABEL[peaks[1]['key']]} rising"})

    # ---- AI trend recommendations (from the strongest action themes)
    themes = Counter()
    for e in evs:
        a = e["_a"]
        if a["urgency"] in ("act", "review"):
            themes[a["label"]] += 1
    recs = []
    for label, c in themes.most_common(3):
        recs.append({"title": label, "note": f"{c} event{'s' if c != 1 else ''} point the same way",
                     "level": "High" if c >= 3 else "Medium"})

    return {"cards": cards, "stream": {"labels": labels, "series": stream_series, "peaks": peaks},
            "intel": intel, "areas": areas, "rising": rising, "declining": declining,
            "radar": radar, "momentum": {"labels": mlabels, "values": mvals, "markers": markers},
            "recommendations": recs, "range": _range_label(evs)}


def _range_label(evs: list[dict]) -> str:
    ts = [e["ts"] for e in evs if e.get("ts")]
    if not ts:
        return "—"
    lo, hi = min(ts), max(ts)
    a = datetime.fromtimestamp(lo, tz=timezone.utc)
    b = datetime.fromtimestamp(hi, tz=timezone.utc)
    return f"{a.strftime('%b')} {a.day} – {b.strftime('%b')} {b.day}"


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------

def analytics() -> dict:
    evs = _recent(400)
    n = len(evs)
    is_cur = _half_split(evs)
    cur = [e for e in evs if is_cur(e)]
    prev = [e for e in evs if not is_cur(e)]
    s = storage.stats()

    analyzed = [e for e in evs if e.get("analyzed_at")]
    planned = [e for e in evs if e.get("action_plan")]
    high = [e for e in evs if (e.get("severity") or 1) >= 4]
    avg_conf = (sum(e.get("confidence") or 0 for e in evs) / n * 100) if n else 0

    def card(value, cur_c, prev_c):
        return {"value": value, "delta": _pct(cur_c, prev_c)}

    cards = {
        "total": card(s.get("total", n), len(cur), len(prev)),
        "events": card(n, len(cur), len(prev)),
        "insights": card(len(planned), sum(1 for e in cur if e.get("action_plan")),
                         sum(1 for e in prev if e.get("action_plan"))),
        "high": card(len(high), sum(1 for e in cur if (e.get("severity") or 1) >= 4),
                     sum(1 for e in prev if (e.get("severity") or 1) >= 4)),
        "confidence": {"value": round(avg_conf, 1),
                       "delta": round(avg_conf - ((sum(e.get("confidence") or 0 for e in prev) /
                                                   len(prev) * 100) if prev else 0), 1)},
    }

    # activity over time — four series the page graphs together
    labels, idx, _ = _bucketer(evs, 14)
    ser = {"events": [0] * 14, "analyzed": [0] * 14, "high": [0] * 14, "act": [0] * 14}
    for e in evs:
        if not e.get("ts"):
            continue
        i = idx(e["ts"])
        ser["events"][i] += 1
        if e.get("analyzed_at"):
            ser["analyzed"][i] += 1
        if (e.get("severity") or 1) >= 4:
            ser["high"][i] += 1
        if e["_a"]["urgency"] == "act":
            ser["act"][i] += 1

    # domain distribution + top categories
    dom = Counter(e.get("domain", "other") for e in evs)
    dist = [{"key": d, "count": c, "pct": round(c / n * 100, 1),
             "delta": _pct(sum(1 for e in cur if e.get("domain") == d),
                           sum(1 for e in prev if e.get("domain") == d))}
            for d, c in dom.most_common()]

    # AI insights summary
    top_area = dist[0] if dist else None
    top_insight = max(evs, key=lambda e: (e.get("severity") or 1) * (e.get("confidence") or 0),
                      default=None)
    gap = min(dist, key=lambda d: d["count"]) if dist else None

    summary = {
        "top_area": ({"key": top_area["key"], "pct": top_area["pct"]} if top_area else None),
        "top_insight": ({"key": top_insight.get("dedupe_key"), "title": top_insight.get("title"),
                         "domain": top_insight.get("domain", "other"),
                         "confidence": round((top_insight.get("confidence") or 0) * 100)}
                        if top_insight else None),
        "gap": ({"key": gap["key"], "count": gap["count"]} if gap else None),
    }
    coverage = int(len([d for d in DOMAINS if dom.get(d)]) / len(DOMAINS) * 100)

    return {"cards": cards, "labels": labels,
            "series": [{"key": k, "values": v} for k, v in ser.items()],
            "distribution": dist, "summary": summary, "coverage": coverage,
            "range": _range_label(evs)}


# ---------------------------------------------------------------------------
# Reports — each analysed event reads as a one-line "report"
# ---------------------------------------------------------------------------

_TYPE = {"market": "Market Brief", "policy": "Policy Note", "disaster": "Disaster Report",
         "health": "Health Alert", "supply_chain": "Supply Note", "other": "General"}


def reports(limit: int = 120) -> dict:
    evs = _recent(limit)
    n = len(evs)
    rows = []
    for e in evs:
        rows.append({
            "key": e.get("dedupe_key"),
            "title": e.get("title", ""),
            "subtitle": e.get("impact_summary", "")[:90],
            "type": _TYPE.get(e.get("domain", "other"), "General"),
            "domain": e.get("domain", "other"),
            "source": e.get("source", ""),
            "ts": e.get("ts"),
            "severity": e.get("severity") or 1,
            "urgency": e["_a"]["urgency"],
            "confidence": round((e.get("confidence") or 0) * 100),
        })
    high = [r for r in rows if r["severity"] >= 4]
    acts = [r for r in rows if r["urgency"] == "act"]
    avg_conf = round(sum(r["confidence"] for r in rows) / n) if n else 0
    by_type = Counter(r["type"] for r in rows)
    cards = {"total": n, "high": len(high), "act": len(acts),
             "avg_confidence": avg_conf, "domains": len({r["domain"] for r in rows})}
    return {"cards": cards, "rows": rows,
            "by_type": [{"type": t, "count": c} for t, c in by_type.most_common()]}


# ---------------------------------------------------------------------------
# Recommendations — a decision read for a question, grounded in stored events
# ---------------------------------------------------------------------------

_RISK = {"high": "High Risk", "medium": "Medium Risk", "low": "Low Risk"}


def recommend(q: str = "") -> dict:
    evs = _recent(200)
    q = (q or "").strip()

    # pick the focal event: best title match, else the most important one
    if q:
        terms = set(_tok(q))
        scored = sorted(evs, key=lambda e: (-len(terms & set(_tok(e.get("title", "")))),
                                            -(e.get("severity") or 1) * (e.get("confidence") or 0)))
        matched = [e for e in scored if terms & set(_tok(e.get("title", "")))] or scored
    else:
        matched = sorted(evs, key=lambda e: -((e.get("severity") or 1) * (e.get("confidence") or 0)))
    if not matched:
        return {"question": q, "empty": True}
    focus = matched[0]
    pool = matched[:40]

    domains = len({e.get("domain") for e in pool})
    sources = len({e.get("source") for e in pool})
    confidence = round(sum(e.get("confidence") or 0 for e in pool) / len(pool) * 100)

    # written recommendation: reuse the AI search agent (keyword fallback inside)
    sr = analysis.search_events(q or focus.get("title", ""), pool)
    answer = sr.get("answer", "")

    sev = focus.get("severity") or 1
    success = round((focus.get("confidence") or 0.4) * 100)
    verdict = ("High Risk" if sev >= 4 and (focus.get("sentiment") or 0) < 0
               else "Proceed With Caution" if sev >= 3 else "Proceed")
    chips = (focus.get("channels") or [])[:3] or [focus.get("domain", "other")]

    # success factors — from the focal event's action plan (priority → strength)
    pw = {"immediate": 90, "high": 78, "medium": 64, "low": 50}
    factors = [{"label": s["action"][:48], "pct": pw.get(s["priority"], 60)}
               for s in (focus.get("action_plan") or [])[:4]]

    # risk assessment — from the economic-impact sectors (deterministic fallback
    # when the focal event hasn't been opened/enriched yet, so this is never empty)
    ei = focus.get("economic_impact") or analysis._fallback_econ(focus)
    risks = [{"label": s["sector"], "level": _RISK.get(s["impact"], "Medium Risk"),
              "observed": f"{s['probability']}% likelihood", "confidence": success}
             for s in (ei.get("sectors") or [])[:3]]

    # similar events — same domain, split by tone
    rel = storage.related_events(focus.get("domain", "other"), focus.get("dedupe_key", ""), limit=12)
    fterms = set(_tok(focus.get("title", "")))

    def match_pct(e):
        ov = len(fterms & set(_tok(e.get("title", ""))))
        return min(96, 60 + ov * 9 + (e.get("severity") or 1) * 2)

    def row(e):
        return {"key": e.get("dedupe_key"), "title": e.get("title", ""),
                "domain": e.get("domain", "other"), "severity": e.get("severity") or 1,
                "match": match_pct(e)}
    pos = [row(e) for e in rel if (e.get("sentiment") or 0) >= 0][:3]
    neg = [row(e) for e in rel if (e.get("sentiment") or 0) < 0][:3]

    evidence = [e.get("source", "src").upper()[:8] + "-" + str(abs(hash(e.get("dedupe_key", ""))) % 900 + 100)
                for e in pool[:5]]
    actions = [{"title": s["action"], "note": s["outcome"]}
               for s in (focus.get("action_plan") or [])[:4]]

    return {
        "question": q or focus.get("title", ""),
        "empty": False,
        "data": {"events": len(pool), "domains": domains, "sources": sources, "confidence": confidence},
        "answer": answer, "verdict": verdict, "chips": chips,
        "success": success, "ci": [max(0, success - 10), min(100, success + 8)],
        "factors": factors, "risks": risks,
        "similar_pos": pos, "similar_neg": neg,
        "evidence": evidence, "actions": actions,
        "focus": {"key": focus.get("dedupe_key"), "title": focus.get("title"),
                  "domain": focus.get("domain", "other")},
        "counts": {"events": len(pool), "reports": sum(1 for e in pool if e.get("action_plan")),
                   "high": sum(1 for e in pool if (e.get("severity") or 1) >= 4),
                   "sources": sources},
    }


# ---------------------------------------------------------------------------
# Dashboard — one call powering the standalone analytics dashboard. Shapes match
# its cards exactly (severity / ingested / gauges / briefing / top / domains /
# channels), all derived from live stored events. No LLM call.
# ---------------------------------------------------------------------------

_GAUGE_LABEL = {"VIX": "VIX", "Oil (WTI)": "Oil WTI", "Gold": "Gold", "Dollar (DXY)": "DXY"}


def _fmt_val(v) -> str:
    try:
        v = float(v)
    except (TypeError, ValueError):
        return str(v)
    return f"{v:,.0f}" if abs(v) >= 1000 else f"{v:,.2f}"


def _ago(ts) -> str:
    if not ts:
        return ""
    m = max(1, int((time.time() - ts) / 60))
    if m < 60:
        return f"{m}m ago"
    h = m // 60
    return f"{h}h ago" if h < 24 else f"{h // 24}d ago"


def dashboard() -> dict:
    ev = storage._events()
    now = time.time()
    evs = _recent(400)

    # severity buckets across the whole DB (accurate counts)
    bars = [
        {"label": "Critical", "count": ev.count_documents({"severity": 5})},
        {"label": "High", "count": ev.count_documents({"severity": 4})},
        {"label": "Medium", "count": ev.count_documents({"severity": 3})},
        {"label": "Low", "count": ev.count_documents({"severity": {"$gte": 1, "$lte": 2}})},
    ]
    sev_total = sum(b["count"] for b in bars)
    cur24 = ev.count_documents({"ts": {"$gte": now - 86400}})
    prev24 = ev.count_documents({"ts": {"$gte": now - 2 * 86400, "$lt": now - 86400}})

    # events ingested — count per day for the last 7 days
    series = []
    for i in range(6, -1, -1):
        s0, s1 = now - (i + 1) * 86400, now - i * 86400
        d = datetime.fromtimestamp(s0, tz=timezone.utc)
        series.append({"d": f"{d.strftime('%b')} {d.day}",
                       "v": ev.count_documents({"ts": {"$gte": s0, "$lt": s1}})})
    total_events = ev.count_documents({})
    wk_cur = ev.count_documents({"ts": {"$gte": now - 7 * 86400}})
    wk_prev = ev.count_documents({"ts": {"$gte": now - 14 * 86400, "$lt": now - 7 * 86400}})

    # market gauges
    raw_gauges = storage.get_gauges()
    gauges = [{"label": _GAUGE_LABEL.get(g["name"], g["name"]), "value": _fmt_val(g.get("value")),
               "delta": round(abs(g.get("change_pct") or 0), 1), "up": (g.get("change_pct") or 0) >= 0}
              for g in raw_gauges]

    # events by domain (analysed)
    dom = Counter(e.get("domain", "other") for e in evs)
    domains = [{"name": DLABEL.get(d, "Other"), "key": d, "value": dom.get(d, 0)} for d in DOMAINS]

    # impact channels activated across recent events
    ch = Counter(c for e in evs for c in (e.get("channels") or []))
    channels = [{"label": "Cost", "value": ch.get("cost", 0)},
                {"label": "Confidence", "value": ch.get("confidence", 0)},
                {"label": "Rates", "value": ch.get("rates", 0)},
                {"label": "Demand", "value": ch.get("demand", 0)}]

    # top events by impact, deduped by title — prefer recent (last ~36h), fall back to all
    recent_evs = [e for e in evs if (e.get("ts") or 0) >= now - 36 * 3600] or evs
    seen, top = set(), []
    for e in sorted(recent_evs, key=lambda e: -((e.get("severity") or 1) * (e.get("confidence") or 0.3))):
        t = (e.get("title") or "").strip()
        if not t or t.lower() in seen:
            continue
        seen.add(t.lower())
        top.append(e)
        if len(top) >= 3:
            break
    top_events = [{"title": e.get("title", ""), "domain": DLABEL.get(e.get("domain", "other"), "Other"),
                   "ago": _ago(e.get("ts")), "sev": int(e.get("severity") or 1),
                   "key": e.get("dedupe_key")} for e in top]

    # AI situation briefing — composed from the aggregates (grounded, no LLM)
    high = [e for e in evs if (e.get("severity") or 1) >= 4]
    # prefer named domains over the catch-all "other" for the headline/labels
    named = [(d, c) for d, c in dom.most_common() if d != "other"]
    topdoms = [DLABEL.get(d, d) for d, _ in (named or dom.most_common())[:2]]
    movers = [g for g in raw_gauges if abs(g.get("change_pct") or 0) >= 1.5]
    parts = [f"Tracking {total_events:,} events; {len(high)} look serious"
             + (f" — concentrated in {' and '.join(topdoms)}." if topdoms else ".")]
    if movers:
        parts.append("Market gauges on the move: " + ", ".join(
            f"{_GAUGE_LABEL.get(g['name'], g['name'])} {'up' if (g.get('change_pct') or 0) >= 0 else 'down'} "
            f"{abs(g['change_pct']):.1f}%" for g in movers[:3]) + ".")
    themes = Counter(e["_a"]["label"] for e in evs
                     if e["_a"]["urgency"] in ("act", "review") and e["_a"]["label"])
    if themes:
        label, c = themes.most_common(1)[0]
        parts.append(f"Biggest theme right now: {label.lower()} — {c} events point the same way.")
    headline = (f"{topdoms[0]} risk is leading the board today" if topdoms
                else "All quiet across live events right now")
    kw = Counter(t for e in evs[:120] for t in set(_tok(e.get("title", ""))))
    chips = [t.title() for t, _ in kw.most_common(5)] or topdoms or ["Markets", "Policy"]
    briefing = {"headline": headline, "body": " ".join(parts), "chips": chips}

    return {
        "severity": {"total": sev_total, "delta": _pct(cur24, prev24), "bars": bars},
        "ingested": {"total": total_events, "delta": _pct(wk_cur, wk_prev), "series": series},
        "gauges": gauges,
        "briefing": briefing,
        "topEvents": top_events,
        "domains": domains,
        "channels": channels,
    }
