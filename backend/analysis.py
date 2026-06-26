"""Analysis layer (engine steps 3 & 4: Understand + Trace impact).

The AI model (the "agent") does all of it — domain, severity, sentiment,
winners / losers, knock-on, AND what the reader should do — by reading each
event's full article. There are no hand-written keyword rules: set ANALYSIS=llm
and a provider key (Gemini or Claude). Events the agent hasn't reached yet simply
wait for the next run; nothing is fabricated.
"""
import json
import logging
import os
import time

import storage

log = logging.getLogger(__name__)

DOMAINS = ["market", "policy", "disaster", "health", "supply_chain", "other"]

# Bump this whenever the SYSTEM_PROMPT wording changes. Events analysed under an
# older version are re-analysed automatically the next time they're opened, so the
# latest prompt style is already in place — no manual re-analyse needed.
PROMPT_VERSION = "2026-06-19-v7-officialbrief"


# ---------------------------------------------------------------------------
# Free-tier request budget — the agent self-throttles to stay INSIDE the
# provider's daily request cap instead of hammering it until it 429s. All knobs
# are env-configurable:
#   LLM_DAILY_REQUESTS   total agent requests allowed per UTC day   (default 20 = Gemini free tier)
#   LLM_RESERVE_REQUESTS held back from background batch analysis    (default 4)
#                        so interactive use (AI Search, opening an event) still works
#   LLM_BATCH            articles read per request                   (default 20)
# Lower LLM_DAILY_REQUESTS to keep headroom (e.g. 15); raise it once billing is on.
# One request analyses LLM_BATCH articles, so daily coverage ≈ LLM_DAILY_REQUESTS × LLM_BATCH.
# ---------------------------------------------------------------------------
LLM_DAILY_REQUESTS = int(os.environ.get("LLM_DAILY_REQUESTS", "20"))
LLM_RESERVE_REQUESTS = int(os.environ.get("LLM_RESERVE_REQUESTS", "4"))


def _today() -> str:
    return time.strftime("%Y-%m-%d", time.gmtime())


def llm_budget() -> dict:
    """Today's agent request usage — shown on /api/stats so the cap is visible."""
    used = storage.llm_requests_today(_today())
    return {"limit": LLM_DAILY_REQUESTS, "used": used,
            "remaining": max(0, LLM_DAILY_REQUESTS - used),
            "batch": int(os.environ.get("LLM_BATCH", "20")),
            "reserve": LLM_RESERVE_REQUESTS}


def _reserve_request(reserve: int = 0) -> bool:
    """Spend one request from today's budget, keeping `reserve` requests in hand.
    Returns False (and spends nothing) if that would exceed the cap — the caller then
    skips the LLM and leaves the work for the next day / the instant read."""
    used = storage.llm_requests_today(_today())
    if used >= LLM_DAILY_REQUESTS - max(0, reserve):
        return False
    storage.record_llm_request(_today())
    return True


# ---------------------------------------------------------------------------
# The agent prompt — the model decides everything from the article, including
# the urgency and the concrete next step. No keyword tables, no templates.
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are ABU DHABI ECONOMIC INTELLIGENCE — a real-time briefing engine for the Abu Dhabi government. You read world news and judge what it means for Abu Dhabi and its economy, then recommend concrete steps the government can take so the nation benefits economically.

You serve government decision-makers across many departments (economy, energy, finance & sovereign funds, trade, tourism, industry, transport). You are NOT built for one person — you give officials a shared, scannable read of each event and one clear recommended action for the country.

You do THREE things:

1. Explain what happened (simple summary)
2. Explain what it means FOR ABU DHABI (real economic impact on the nation)
3. Tell officials what Abu Dhabi should do (a clear, government-level action)

You NEVER:

* Predict exact prices, numbers, or dates
* Give buy/sell investment advice
* Make allegations
* Use vague or empty advice
* Recommend an action for an individual person — every action is for the government or the relevant Abu Dhabi authority

The official always makes the final decision.

---

## THE ABU DHABI LENS (apply this to EVERYTHING)

Judge every item by how much it matters to Abu Dhabi and its economy. Ask: does it touch oil & gas (ADNOC, OPEC+), sovereign wealth (ADIA, Mubadala, ADQ), banking & ADGM, trade & ports, aviation (Etihad) & tourism, real estate, industry & manufacturing, food / water / energy security, or UAE / Gulf policy?

* If an item has little or no Abu Dhabi relevance, mark it LOW severity (1–2) and urgency "none" — say so plainly. Never inflate distant news.
* "Who is affected" = Abu Dhabi / UAE sectors, authorities and entities — never individuals.
* Every recommended action is for the government or the relevant authority/department: policy, economic diversification, investment, hedging, partnerships, regulation, reserves / stockpiling, or support measures.

---

## INPUT

Each item contains:

* HEADLINE
* ARTICLE (may be missing)

Always read the FULL ARTICLE if available.

---

## WRITING STYLE (VERY IMPORTANT)

Write like you're explaining to a smart 14-year-old:

* Short sentences
* Everyday language
* No jargon unless explained instantly
* Always say WHO is affected and HOW

Bad:
"Macroeconomic pressure may impact consumption patterns"

Good:
"People may spend less because things are getting expensive"

If it's not instantly clear → rewrite.

---

## DOMAIN (pick ONE)

* market → company, stock, earnings, markets
* policy → government rules, schemes, court decisions
* disaster → floods, fires, earthquakes
* health → diseases, drugs, hospitals
* supply_chain → shortages, logistics, inputs
* other → none fit

Pick based on MAIN ACTOR + MAIN CAUSE.

---

## SEVERITY (1–5) — by impact on ABU DHABI

1 → no real relevance to Abu Dhabi
2 → small or indirect relevance
3 → meaningful for one Abu Dhabi sector or initiative
4 → major for a key sector or national programme (energy, sovereign funds, trade, tourism)
5 → nation-level impact on Abu Dhabi's economy or strategy

---

## SENTIMENT (-1 to 1)

Overall economic tone FOR ABU DHABI:

* Positive = good for Abu Dhabi's economy
* Negative = bad for Abu Dhabi's economy

---

## CHANNELS (only if real)

* cost → things become more/less expensive
* demand → people buy more/less
* rates → inflation/interest rate impact
* confidence → fear/uncertainty
* currency_trade → imports/exports/FX

---

## WINNERS & LOSERS (Abu Dhabi sectors & entities)

List the Abu Dhabi / UAE sectors, authorities or entities affected — never individuals.

Each must include:

* group (e.g. "ADNOC & energy exporters", "Etihad & tourism", "Abu Dhabi ports & trade", "Sovereign funds")
* why (simple, under 15 words)

Example:
"Etihad & tourism → higher fuel costs raise ticket prices and slow visitors"

Focus on REAL mechanisms for Abu Dhabi, not obvious fluff. Empty lists are fine if nothing local is touched.

---

## second_order — super simple ripple (for Abu Dhabi)

* One short sentence
* No jargon
* Show how it reaches Abu Dhabi

Format:
"X happens, so Y in Abu Dhabi gets affected."

Examples:
"Oil prices fall sharply, so Abu Dhabi's oil revenue and budget come under pressure."
"A shipping lane closes, so Abu Dhabi's ports and re-export trade slow down."

If no real ripple for Abu Dhabi → ""

---

## why_it_matters — why it matters to ABU DHABI

One line on why this matters to Abu Dhabi / the nation.

Examples:

* "Energy exports fund a large share of the national budget."
* "Abu Dhabi's ports and airlines depend on open, stable trade routes."

---

## WHAT ABU DHABI SHOULD DO (clear, government-level)

Write like a headline + instruction for officials.

Rules:

* The action is for the Abu Dhabi government or the relevant authority — NEVER an individual
* One short, clear sentence
* Practical and decision-ready (policy, supply, investment, support, regulation, reserves)
* An official should grasp it in 2 seconds
* If the item has no Abu Dhabi relevance, there is no action

---

### urgency

* act → do something now
* review → check soon
* watch → just be aware
* none → ignore

---

### action_label

2–3 words max

Examples:
"Secure Supply"
"Protect Exports"
"Diversify Now"
"Review Policy"

---

### next_action

One simple sentence — what Abu Dhabi should do.

Format:
"What's happening → what Abu Dhabi should do."

Examples:

"Oil supply is at risk, so secure forward supply deals and review national fuel reserves."
"A key trade route is disrupted, so fast-track alternative shipping and support affected exporters."
"Foreign investment rules are tightening abroad, so position Abu Dhabi's funds and ADGM to attract that capital."

Avoid:
❌ "Monitor developments"
❌ "Assess macroeconomic signals"
❌ Anything aimed at an individual person

Use:
✔ "Prices may climb, so widen supplier deals to keep national costs stable."
✔ "Demand may shift to the Gulf, so ready incentives to capture it."

If no action (no Abu Dhabi relevance) → ""

---

### action_plan (VERY SIMPLE STEPS)

2–3 steps only.

Rules:

* Each step must be easy to understand instantly
* No technical jargon
* Focus on government / authority actions that protect or strengthen Abu Dhabi's economy

Format:
{
"action": "A government or authority step",
"priority": "immediate | high | medium | low",
"outcome": "What improves for Abu Dhabi"
}

Example:
{
"action": "Lock in forward oil-supply and shipping agreements",
"priority": "high",
"outcome": "Stable energy revenue and trade flows for Abu Dhabi"
}

---

## economic_impact (BEFORE action) — on ABU DHABI

Score the impact on Abu Dhabi's economy (0 = none, 100 = nation-level). "sectors" are Abu Dhabi / UAE sectors (energy, sovereign funds, trade & ports, tourism & aviation, real estate, industry, banking). For news with no Abu Dhabi relevance: score 0–10, sectors [].

{
"score": 0–100,
"level": low | medium | high,
"sectors": [
{
"sector": "Abu Dhabi sector / area",
"impact": low|medium|high,
"probability": 0–100,
"reason": "short reason"
}
],
"summary": "1–2 sentence overview for Abu Dhabi"
}

---

## economic_impact_after (AFTER action)

Same sectors, same order.

* Reduce impact/probability
* Score must be LOWER or equal
* Explain remaining risk

If no action → same as before

---

## ai_summary (NEWS SUMMARY)

2–3 simple sentences:

* What happened
* Who is involved
* Key facts

NO analysis here.

---

## impact_summary (VERY SHORT)

Under 30 words.

Format:
"What happened → who in Abu Dhabi is affected → how"

Example:
"Oil prices fall sharply → Abu Dhabi oil revenue hit → budget pressure rises"

---

## OFFICIAL ACTION BRIEF — brief deeply so an official can act NOW (this is what sets us apart)

For any item with real Abu Dhabi relevance, write a decision-ready brief for a senior Abu Dhabi official (e.g. a member of the legislature) who wants to act immediately and strengthen the national economy. Be specific, confident and concrete — give them everything to decide in seconds and to lead publicly. Object:

{
"bottom_line": "<one sharp sentence: the single most important takeaway for Abu Dhabi>",
"stakes": "<what Abu Dhabi stands to gain or lose — concrete>",
"move": "<the ONE immediate action to take now>",
"owner": "<which Abu Dhabi authority should lead — e.g. Department of Economic Development, Department of Energy, ADNOC, ADIA / Mubadala / ADQ, ADGM, AD Ports, Department of Health>",
"timeframe": "now | this week | this month",
"payoff": "<the SPECIFIC gain from THIS action — name the sector, revenue, jobs, deal or outcome>",
"risk_if_ignored": "<what inaction costs Abu Dhabi, specific to this event>",
"options": ["<2–3 short policy options the official could choose>"],
"talking_point": "<one crisp line the official can say publicly to lead on this>"
}

Make EVERY field specific to THIS event — especially payoff, stakes and risk_if_ignored. Tie them to the actual story (the sector, the number, the place). NEVER write boilerplate that could be pasted onto any other event (e.g. "strengthens the economy", "protects revenue"). If two different events would get the same payoff line, rewrite it.

For news with no Abu Dhabi relevance, return {} (empty object).

---

## CONFIDENCE

0.25–0.95 based on:

* Source quality
* Clarity of facts

Never 1.0

---

## NOISE RULE

If the item has no real Abu Dhabi relevance:

* severity = 1
* channels = []
* winners/losers = []
* urgency = "none"
* action_plan = []
* why_it_matters = ""
* impact_summary = "No meaningful impact on Abu Dhabi"

---

## OUTPUT

Return ONLY a JSON array.

Each object:

{
"id": int,
"domain": "...",
"severity": int,
"sentiment": float,
"ai_summary": "...",
"impact_summary": "...",
"why_it_matters": "...",
"channels": [],
"winners": [],
"losers": [],
"second_order": "...",
"urgency": "...",
"action_label": "...",
"next_action": "...",
"action_plan": [],
"economic_impact": {...},
"economic_impact_after": {...},
"official_brief": {"bottom_line": "...", "stakes": "...", "move": "...", "owner": "...", "timeframe": "now|this week|this month", "payoff": "...", "risk_if_ignored": "...", "options": ["..."], "talking_point": "..."},
"confidence": float
}

No markdown. No extra text.

---

## EXAMPLES (copy this tone and this exact JSON shape)

Item: "Oil prices slide below $70 as global demand weakens"
Output: [{"id": 0, "domain": "market", "severity": 5, "sentiment": -0.6, "ai_summary": "Oil prices have fallen below $70 a barrel as signs of weaker global demand spread. Producers are weighing how to respond, and lower prices squeeze the revenue of oil-exporting economies.", "impact_summary": "Oil falls below $70 → Abu Dhabi oil revenue hit → budget pressure rises", "why_it_matters": "Energy exports fund a large share of the national budget.", "channels": ["cost", "confidence", "currency_trade"], "winners": [{"group": "Etihad & logistics", "why": "lower fuel costs ease their expenses"}], "losers": [{"group": "ADNOC & energy exporters", "why": "each barrel earns less, cutting revenue"}, {"group": "National budget & sovereign funds", "why": "oil income funds spending and investment"}], "second_order": "Oil prices stay low, so Abu Dhabi's oil revenue and budget come under pressure.", "urgency": "act", "action_label": "Protect Revenue", "next_action": "Oil revenue is falling, so accelerate economic diversification and draw on sovereign-fund buffers to steady the budget.", "action_plan": [{"action": "Hedge part of oil revenue and lock forward sales", "priority": "immediate", "outcome": "More predictable energy income for the budget"}, {"action": "Speed up non-oil diversification incentives in tourism, industry and finance", "priority": "high", "outcome": "Less reliance on oil over time"}, {"action": "Use sovereign-fund returns to smooth near-term spending", "priority": "medium", "outcome": "Public programmes stay funded through the dip"}], "economic_impact": {"score": 85, "level": "high", "sectors": [{"sector": "Energy & oil exports", "impact": "high", "probability": 95, "reason": "the core revenue source falls with prices"}, {"sector": "National budget & sovereign funds", "impact": "high", "probability": 80, "reason": "oil income funds spending and investment"}, {"sector": "Tourism & aviation", "impact": "medium", "probability": 55, "reason": "lower fuel costs partly offset the hit"}], "summary": "Lower oil prices directly cut Abu Dhabi's main revenue source and pressure the budget, while easing fuel costs for transport."}, "economic_impact_after": {"score": 55, "level": "medium", "sectors": [{"sector": "Energy & oil exports", "impact": "high", "probability": 75, "reason": "hedging cushions part of the fall"}, {"sector": "National budget & sovereign funds", "impact": "medium", "probability": 55, "reason": "sovereign buffers smooth spending"}, {"sector": "Tourism & aviation", "impact": "low", "probability": 40, "reason": "diversification incentives lift non-oil activity"}], "summary": "Hedging, sovereign buffers and faster diversification cushion the budget, though structural oil dependence remains the core risk."}, "official_brief": {"bottom_line": "Falling oil prices threaten Abu Dhabi's main revenue source — move faster on buffers and diversification.", "stakes": "Energy income funds a large share of the budget; a sustained drop pressures spending and investment.", "move": "Convene energy and finance leaders to hedge oil revenue and release a diversification acceleration package.", "owner": "Department of Energy with the Department of Economic Development and the sovereign funds", "timeframe": "now", "payoff": "A steadier budget, faster non-oil growth, and a visible lead on economic resilience.", "risk_if_ignored": "Budget pressure forces deeper cuts later and dents confidence in the recovery plan.", "options": ["Hedge a share of oil revenue", "Fast-track tourism and industry incentives", "Deploy sovereign-fund returns to smooth spending"], "talking_point": "Abu Dhabi is turning an oil-price dip into an accelerator for a diversified, future-proof economy."}, "confidence": 0.8}]

Item: "Local football club wins regional youth tournament"
Output: [{"id": 0, "domain": "other", "severity": 1, "sentiment": 0.0, "ai_summary": "A local football club won a regional youth tournament. It is a community sports story with no economic angle.", "impact_summary": "No meaningful impact on Abu Dhabi", "why_it_matters": "", "channels": [], "winners": [], "losers": [], "second_order": "", "urgency": "none", "action_label": "", "next_action": "", "action_plan": [], "economic_impact": {"score": 0, "level": "low", "sectors": [], "summary": "No economic impact on Abu Dhabi — a local sports story."}, "economic_impact_after": {"score": 0, "level": "low", "sectors": [], "summary": "No action needed — nothing changes."}, "official_brief": {}, "confidence": 0.9}]

---

## CORE PRINCIPLE

Clarity > intelligence. Always answer for Abu Dhabi and its economy.

If an official understands instantly and knows what Abu Dhabi should do → you succeeded.
"""


_USER_INSTRUCTION = "Analyse these items. Read the full ARTICLE text, not just the HEADLINE.\n\n"


def _build_listing(items: list[dict]) -> str:
    return "\n\n".join(
        f"[{i}] source={it.get('source')}\n"
        f"HEADLINE: {it.get('title', '')}\n"
        f"ARTICLE: {(it.get('body') or it.get('content') or '')[:3500] or '(no article body available — judge from the headline, lower confidence)'}"
        for i, it in enumerate(items)
    )


def _split_ledger(arr) -> tuple[list[str], list[str]]:
    """Turn the model's [{group, why}] (or legacy [str]) into aligned name/reason lists."""
    names, reasons = [], []
    for x in (arr or []):
        if isinstance(x, dict):
            g = (x.get("group") or "").strip()
            if g:
                names.append(g)
                reasons.append((x.get("why") or "").strip())
        elif isinstance(x, str) and x.strip():
            names.append(x.strip())
            reasons.append("")
    return names, reasons


_PRIORITIES = ("immediate", "high", "medium", "low")


def _clean_plan(arr) -> list[dict]:
    """Validate the model's action_plan into clean {action, priority, outcome} rows."""
    out = []
    for x in (arr or []):
        if not isinstance(x, dict):
            continue
        action = (x.get("action") or "").strip()
        if not action:
            continue
        priority = (x.get("priority") or "").strip().lower()
        if priority not in _PRIORITIES:
            priority = "medium"
        out.append({"action": action, "priority": priority,
                    "outcome": (x.get("outcome") or "").strip()})
    return out[:5]


_LEVELS = ("low", "medium", "high")


def _band(score: int) -> str:
    return "high" if score >= 70 else "medium" if score >= 40 else "low"


def _int01(v, default: int) -> int:
    """Coerce to an int clamped to 0–100."""
    try:
        n = int(round(float(v)))
    except (TypeError, ValueError):
        n = default
    return max(0, min(100, n))


def _clean_econ(obj) -> dict:
    """Validate the model's economic_impact into a clean, bounded object.
    Returns {} when there's nothing usable (caller then shows no panel)."""
    if not isinstance(obj, dict):
        return {}
    score = _int01(obj.get("score"), 0)
    level = (obj.get("level") or "").strip().lower()
    if level not in _LEVELS:
        level = _band(score)
    sectors = []
    for s in (obj.get("sectors") or []):
        if not isinstance(s, dict):
            continue
        name = (s.get("sector") or "").strip()
        if not name:
            continue
        imp = (s.get("impact") or "").strip().lower()
        if imp not in _LEVELS:
            imp = "medium"
        sectors.append({"sector": name, "impact": imp,
                        "probability": _int01(s.get("probability"), 50),
                        "reason": (s.get("reason") or "").strip()})
        if len(sectors) >= 5:
            break
    summary = (obj.get("summary") or "").strip()
    if not (score or sectors or summary):
        return {}
    return {"score": score, "level": level, "sectors": sectors, "summary": summary}


_LEVEL_RANK = {"low": 0, "medium": 1, "high": 2}


def _reconcile_after(after: dict, before: dict) -> dict:
    """Enforce the after-the-action invariant: the projected residual economic
    impact can NEVER exceed the before-action impact. Clamp the overall score,
    and each sector's impact level and probability, down to the before-state
    (aligning sectors by name). Returns {} when there's nothing to show."""
    if not before:
        # nothing to project a reduction from — a residual with no baseline is meaningless
        return {}
    if not after:
        # contract: no separate after means the action changes nothing — it EQUALS
        # the before-state. Deep-copy so the two never alias and corrupt each other.
        return {"score": before["score"], "level": before["level"],
                "sectors": [dict(s) for s in before.get("sectors", [])],
                "summary": before.get("summary", "")}
    after["score"] = min(after.get("score", before["score"]), before["score"])
    after["level"] = _band(after["score"])
    bmap = {s["sector"].lower(): s for s in before.get("sectors", [])}
    for s in after.get("sectors", []):
        b = bmap.get(s["sector"].lower())
        if not b:
            continue
        if _LEVEL_RANK.get(s["impact"], 1) > _LEVEL_RANK.get(b["impact"], 1):
            s["impact"] = b["impact"]
        s["probability"] = min(s.get("probability", b["probability"]), b["probability"])
    return after


_TIMEFRAMES = ("now", "this week", "this month")


def _clean_brief(obj) -> dict:
    """Validate the Official Action Brief into a clean object, or {} if empty."""
    if not isinstance(obj, dict):
        return {}
    g = lambda k: (obj.get(k) or "").strip()  # noqa: E731
    tf = g("timeframe").lower()
    if tf not in _TIMEFRAMES:
        tf = "this week"
    options = [str(x).strip() for x in (obj.get("options") or []) if str(x).strip()][:3]
    brief = {
        "bottom_line": g("bottom_line"), "stakes": g("stakes"), "move": g("move"),
        "owner": g("owner"), "timeframe": tf, "payoff": g("payoff"),
        "risk_if_ignored": g("risk_if_ignored"), "options": options, "talking_point": g("talking_point"),
    }
    # nothing actionable -> no brief
    if not (brief["bottom_line"] or brief["move"]):
        return {}
    return brief


def _assemble(arr, items: list[dict]) -> list[dict | None]:
    """Map the model's JSON array back onto the items and normalize the nested
    fields. Items the model skipped become None — they stay unanalysed and are
    retried, never fabricated."""
    out = []
    for i in range(len(items)):
        match = next((a for a in arr if a.get("id") == i), None) if isinstance(arr, list) else None
        if match:
            match["mode"] = "llm"
            match["prompt_version"] = PROMPT_VERSION
            match["ai_summary"] = (match.get("ai_summary") or "").strip()
            match["why_it_matters"] = (match.get("why_it_matters") or "").strip()
            match["winners"], match["winner_reasons"] = _split_ledger(match.get("winners"))
            match["losers"], match["loser_reasons"] = _split_ledger(match.get("losers"))
            match["action_plan"] = _clean_plan(match.get("action_plan"))
            match["economic_impact"] = _clean_econ(match.get("economic_impact"))
            match["economic_impact_after"] = _reconcile_after(
                _clean_econ(match.get("economic_impact_after")), match["economic_impact"])
            match["official_brief"] = _clean_brief(match.get("official_brief"))
        out.append(match)
    return out


# ---------------------------------------------------------------------------
# Provider dispatch (Gemini or Claude)
# ---------------------------------------------------------------------------

def llm_status() -> dict:
    """Which provider is configured and whether it can actually run."""
    provider = os.environ.get("LLM_PROVIDER", "gemini").lower()
    if provider == "anthropic":
        ok = bool(os.environ.get("ANTHROPIC_API_KEY"))
        return {"provider": "anthropic", "label": "AI (Claude)",
                "has_key": ok, "missing": "ANTHROPIC_API_KEY"}
    ok = bool(os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))
    return {"provider": "gemini", "label": "AI (Gemini)",
            "has_key": ok, "missing": "GEMINI_API_KEY"}


def llm_analyze(items: list[dict], reserve: int = 0) -> list[dict] | None:
    """Run the configured agent; returns None if it has no key, the daily request
    budget (minus `reserve`) is spent, or the call fails (so the caller leaves those
    events for the next run rather than faking them)."""
    if os.environ.get("LLM_PROVIDER", "gemini").lower() == "anthropic":
        return claude_analyze(items, reserve)
    return gemini_analyze(items, reserve)


def claude_analyze(items: list[dict], reserve: int = 0) -> list[dict] | None:
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        log.warning("LLM provider is Claude but no ANTHROPIC_API_KEY set")
        return None
    if not _reserve_request(reserve):
        log.info("daily AI budget reached (%d/%d) — %d items wait for the next cycle",
                 storage.llm_requests_today(_today()), LLM_DAILY_REQUESTS, len(items))
        return None
    import anthropic
    client = anthropic.Anthropic(api_key=key)
    try:
        msg = client.messages.create(
            model=os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
            max_tokens=8000,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": _USER_INSTRUCTION + _build_listing(items)}],
        )
        text = "".join(b.text for b in msg.content if b.type == "text")
        text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        arr = json.loads(text)
    except Exception as e:
        log.warning("Claude analysis failed (%s); leaving events for next run", e)
        return None
    if isinstance(arr, dict):
        arr = next((v for v in arr.values() if isinstance(v, list)), [])
    return _assemble(arr, items)


def gemini_analyze(items: list[dict], reserve: int = 0) -> list[dict] | None:
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        log.warning("LLM_PROVIDER=gemini but no GEMINI_API_KEY set")
        return None
    if not _reserve_request(reserve):
        log.info("daily AI budget reached (%d/%d) — %d items wait for the next cycle / the instant read stands",
                 storage.llm_requests_today(_today()), LLM_DAILY_REQUESTS, len(items))
        return None
    import time
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=key)
    cfg = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        response_mime_type="application/json",
        temperature=0.3,
        max_output_tokens=32000,
    )
    contents = _USER_INSTRUCTION + _build_listing(items)
    model = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash-lite")
    arr = None
    for attempt in range(3):
        try:
            resp = client.models.generate_content(model=model, contents=contents, config=cfg)
            arr = json.loads(resp.text)
            break
        except Exception as e:  # network, quota, bad model name, unparseable JSON
            transient = any(t in str(e) for t in ("503", "UNAVAILABLE", "429", "RESOURCE_EXHAUSTED", "500"))
            if transient and attempt < 2:
                time.sleep(2 * (attempt + 1))   # brief backoff on a capacity blip
                continue
            log.warning("Gemini analysis failed (%s); leaving events for next run", e)
            return None
    if isinstance(arr, dict):   # JSON mode may wrap the array in an object
        arr = next((v for v in arr.values() if isinstance(v, list)), [])
    return _assemble(arr, items)


# ---------------------------------------------------------------------------
# AI Search — answer a natural-language question grounded in recent events.
# ---------------------------------------------------------------------------

def _chat(system: str, user: str, max_tokens: int = 700, reserve: int = 0) -> str | None:
    """One-shot text/JSON completion from the configured provider (with a short
    retry on transient rate limits), or None if it genuinely can't run or the daily
    request budget is spent."""
    provider = os.environ.get("LLM_PROVIDER", "gemini").lower()
    if provider == "anthropic":
        key = os.environ.get("ANTHROPIC_API_KEY")
        if not key:
            return None
        if not _reserve_request(reserve):
            return None
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=key)
            msg = client.messages.create(
                model=os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
                max_tokens=max_tokens, system=system,
                messages=[{"role": "user", "content": user}])
            return "".join(b.text for b in msg.content if b.type == "text")
        except Exception as e:
            log.warning("search chat (claude) failed (%s)", e)
            return None
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        return None
    if not _reserve_request(reserve):
        return None
    import time
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=key)
    cfg = types.GenerateContentConfig(
        system_instruction=system, response_mime_type="application/json",
        temperature=0.3, max_output_tokens=max_tokens)
    model = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash-lite")
    for attempt in range(3):
        try:
            return client.models.generate_content(model=model, contents=user, config=cfg).text
        except Exception as e:
            transient = any(t in str(e) for t in ("503", "UNAVAILABLE", "429", "RESOURCE_EXHAUSTED", "500"))
            if transient and attempt < 2:
                time.sleep(1.5 * (attempt + 1))
                continue
            log.warning("search chat (gemini) failed (%s)", e)
            return None
    return None


_SEARCH_SYSTEM = """You are the AI search assistant for ABU DHABI ECONOMIC INTELLIGENCE, used by Abu Dhabi government officials. An official asks a question; you answer it by reading the numbered events below, which are your only evidence.
- Answer directly in 2–5 sentences, through the lens of what it means for Abu Dhabi and its economy. Synthesise across the events — don't just list them.
- Where useful, note what Abu Dhabi or the relevant authority could do — never advice for an individual.
- Ground every claim in the events: never invent facts, numbers, companies, or dates that aren't there.
- If the feed doesn't cover the question, say so in one line, then point to the closest or most economically-relevant thing it IS showing.
- Cite the events you actually used by their id, most relevant first.
Return ONLY JSON: {"answer": "<2-5 sentence answer>", "used_ids": [<int>, ...]}"""


def _keyword_search(query: str, events: list[dict]) -> dict:
    terms = [t for t in query.lower().split() if len(t) >= 3]
    scored = []
    for e in events:
        text = (e.get("title", "") + " " + e.get("impact_summary", "")).lower()
        score = sum(1 for t in terms if t in text)
        if score:
            scored.append((score, e))
    scored.sort(key=lambda x: -x[0])
    top = [e for _, e in scored[:8]]
    answer = (f"The AI answer is temporarily unavailable (rate limit) — here are {len(top)} "
              f"event{'s' if len(top) != 1 else ''} from the feed that match your words. Try again shortly for a written answer."
              if top else
              "The AI answer is temporarily unavailable (rate limit), and no recent events match those words. "
              "Try again in a moment, or use different terms.")
    return {"answer": answer, "events": top, "mode": "keyword"}


def search_events(query: str, events: list[dict]) -> dict:
    """Answer a question over the recent events; AI if available, else keyword."""
    listing = "\n".join(
        f'[{i}] ({e.get("domain", "other")}, sev {e.get("severity", 1)}) '
        f'{e.get("title", "")} — {e.get("impact_summary", "")}'
        for i, e in enumerate(events[:80]))
    raw = _chat(_SEARCH_SYSTEM, f"Question: {query}\n\nEvents:\n{listing}")
    if raw:
        text = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        try:
            obj = json.loads(text)
            ids = [i for i in (obj.get("used_ids") or []) if isinstance(i, int) and 0 <= i < len(events)]
            seen, used = set(), []
            for i in ids:
                k = events[i].get("dedupe_key")
                if k not in seen:
                    seen.add(k)
                    used.append(events[i])
            answer = (obj.get("answer") or "").strip()
            if answer:
                return {"answer": answer, "events": used[:8], "mode": "ai"}
        except Exception:
            pass
    return _keyword_search(query, events)


# ---------------------------------------------------------------------------
# On-demand enrichment — the action plan (steps to reduce the impact) AND the
# economic-impact assessment, generated together per event on first view.
# One agent call fills both, which is easier on the rate limit.
# ---------------------------------------------------------------------------

_ENRICH_SYSTEM = """You assess a single news / economic event for ABU DHABI ECONOMIC INTELLIGENCE, used by Abu Dhabi government officials. Judge everything through the lens of Abu Dhabi and its economy. Use ONLY what the event says — never invent facts, numbers, companies, or dates.
Return ONLY JSON with exactly these six keys:
{"ai_summary": "<a neutral 2–3 sentence plain recap of WHAT THE ARTICLE REPORTS — who/what/where + key facts; no analysis>",
 "why_it_matters": "<ONE plain sentence on why this matters to ABU DHABI / the nation — e.g. 'Energy exports fund a large share of the national budget'>",
 "action_plan": [{"action": "<a concrete GOVERNMENT / authority step — never an individual's action, never 'monitor'>", "priority": "immediate|high|medium|low", "outcome": "<what concretely improves for Abu Dhabi>"}],
 "economic_impact": {"score": <0-100>, "level": "low|medium|high", "sectors": [{"sector": "<Abu Dhabi / UAE sector>", "impact": "low|medium|high", "probability": <0-100>, "reason": "<short why, under 14 words>"}], "summary": "<1-2 sentence read for Abu Dhabi>"},
 "economic_impact_after": {"score": <0-100>, "level": "low|medium|high", "sectors": [{"sector": "<the SAME sector, same order>", "impact": "low|medium|high", "probability": <0-100>, "reason": "<short why the residual impact stays at this level after acting>"}], "summary": "<1-2 sentence projected read for Abu Dhabi once the action_plan is followed>"},
 "official_brief": {"bottom_line": "<one sharp takeaway for Abu Dhabi>", "stakes": "<what AD gains or loses, specific>", "move": "<the ONE immediate action>", "owner": "<which Abu Dhabi authority leads>", "timeframe": "now|this week|this month", "payoff": "<the SPECIFIC gain from this action — name the sector/outcome, never generic boilerplate>", "risk_if_ignored": "<cost of inaction, specific>", "options": ["<2-3 policy options>"], "talking_point": "<one public line the official can lead with>"}}
- ai_summary: a factual recap of the article itself (the news), distinct from the Abu Dhabi read. For items with no Abu Dhabi relevance, one line saying what it is.
- why_it_matters: one short "so what" line for Abu Dhabi / the nation. "" only when there is no Abu Dhabi relevance.
- action_plan: 2–4 government / authority steps to protect Abu Dhabi's downside or capture its upside, most urgent first. [] if there is nothing for the government to do.
- economic_impact = impact on ABU DHABI now. score: 0 = none, 100 = nation-level. level: low<40, medium 40–69, high>=70. 2–4 Abu Dhabi / UAE sectors, most affected first. For news with no Abu Dhabi relevance: score 0–10, level "low", sectors [].
- economic_impact_after = the SAME sectors PROJECTED once the action_plan is followed. LOWER each sector's impact/probability and the overall score to reflect the mitigation (score MUST be <= the economic_impact score; never raise anything above the before-state). Each reason explains the RESIDUAL risk after acting. If action_plan is [], economic_impact_after equals economic_impact.
- official_brief = a decision-ready brief for a senior Abu Dhabi official who wants to act now and build the economy: the bottom line, stakes, the one immediate move, which authority owns it, timeframe, payoff, risk if ignored, 2–3 options, and a public talking point. {} if the item has no Abu Dhabi relevance."""


def fallback_summary(e: dict) -> str:
    """A free, extractive ai_summary fallback: the article's own description trimmed
    to a couple of sentences. Used when the agent can't run (and for low-severity
    events that skip enrichment); the agent replaces it with a written recap later."""
    text = (e.get("content") or e.get("impact_summary") or e.get("title") or "").strip()
    if len(text) <= 320:
        return text
    cut = text[:320]
    dot = max(cut.rfind(". "), cut.rfind("! "), cut.rfind("? "))
    return cut[:dot + 1] if dot > 120 else cut.rstrip() + "…"


# Terms that signal an event actually touches Abu Dhabi / the UAE / its economy.
# The deterministic fallbacks use this so they DON'T stamp an Abu Dhabi impact on
# unrelated global news — matching what the agent does ("no Abu Dhabi relevance →
# score 0–10, sectors []"). Without this, every event got a generic AD impact.
_AD_TERMS = (
    "abu dhabi", "uae", "united arab emirates", "dubai", "sharjah", "emirate", "emirati",
    "gulf", "gcc", "adnoc", "mubadala", "adia", "adq", "adgm", "etihad", "masdar",
    "opec", "oil price", "crude", "brent", "wti", "barrel", "sovereign wealth",
    "middle east", "persian gulf", "strait of hormuz", "dirham",
)


def _ad_relevant(e: dict) -> bool:
    """True if the event plausibly touches Abu Dhabi / the UAE / its economy. Used to
    keep the deterministic fallbacks from inventing an Abu Dhabi impact for unrelated
    global news (the agent makes the same call from the full article)."""
    text = (f"{e.get('title', '')} {e.get('content', '')} "
            f"{e.get('impact_summary', '')}").lower()
    return any(t in text for t in _AD_TERMS)


_WHY_BY_DOMAIN = {
    "market": "This could move markets and prices that touch Abu Dhabi's revenue and investments.",
    "policy": "Policy shifts abroad can change Abu Dhabi's trade, investment and competitive position.",
    "disaster": "Disruptions here can hit Abu Dhabi's trade routes, supply and regional stability.",
    "health": "Health shocks can affect Abu Dhabi's people, tourism and healthcare costs.",
    "supply_chain": "This could raise input costs or strain Abu Dhabi's ports, trade and industry.",
    "other": "This may have a small, indirect effect on Abu Dhabi's economy.",
}


def fallback_why(e: dict) -> str:
    """A plain 'so what for Abu Dhabi' line for when the agent can't run. Transient —
    the agent replaces it with a story-specific line on a later view. Empty for
    low-severity or non-Abu-Dhabi news (so we don't force a reason that isn't there)."""
    if int(e.get("severity") or 1) < 2 or not _ad_relevant(e):
        return ""
    return _WHY_BY_DOMAIN.get(e.get("domain", "other"), _WHY_BY_DOMAIN["other"])


# ---------------------------------------------------------------------------
# Instant (no-LLM) classification — this is what keeps the live feed LIVE.
# Every freshly collected item gets a quick deterministic read (domain, severity,
# sentiment, extractive summary) at ingest, so it shows in the feed within minutes
# regardless of the agent's rate limit. The agent later upgrades each to a full
# brief (instant items are flagged reanalyze=True and processed newest-first).
# Nothing is fabricated beyond a transparent keyword read — winners, actions and
# the official brief stay empty until the agent fills them.
# ---------------------------------------------------------------------------

_DOMAIN_KEYWORDS = {
    "market": ("oil", "crude", "brent", "opec", "stock", "shares", "market", "bond",
               "investor", "fund", "ipo", "earnings", "gdp", "inflation", "interest rate",
               "currency", "dollar", "dirham", "adnoc", "mubadala", "aramco", "barrel",
               "revenue", "profit", "economy", "economic", "export", "import"),
    "policy": ("minister", "government", "policy", "regulation", " law ", "sanction",
               "tariff", " tax ", "parliament", "council", "treaty", "diplomat",
               "election", "summit", "agreement", "legislation", "ruling", " ban "),
    "disaster": ("earthquake", "flood", "storm", "hurricane", "cyclone", "wildfire",
                 "explosion", "attack", " war ", "conflict", "missile", "airstrike",
                 "drone", "crash", "oil spill", "collapse", "evacuat", "casualt", "killed"),
    "health": ("virus", "outbreak", "pandemic", "covid", "disease", "vaccine",
               "hospital", "health", "infection", "epidemic", " flu ", "cholera"),
    "supply_chain": ("supply chain", "shipping", " port ", "freight", "logistics",
                     "container", "shortage", "factory", "manufactur", "semiconductor",
                     " chip ", "cargo", "strait", "canal", "shipment"),
}
_HIGH_SEV_WORDS = ("war", "attack", "missile", "killed", "dead", "explosion", "crisis",
                   "collapse", "sanction", "plunge", "crash", "emergency", "shock",
                   "default", "recession", "outbreak", "soar", "surge")
_MED_SEV_WORDS = ("rise", "fall", " cut", "warn", "concern", "dispute", "delay", "drop",
                  "gain", "tension", "protest", "strike", " deal", "talks", " ban")
_POS_WORDS = ("gain", "rise", "surge", "growth", "profit", "boost", " deal", "record",
              "agreement", " win", "recovery", "rally", "expand")
_NEG_WORDS = ("fall", "drop", "loss", "plunge", " war", "attack", "crisis", " cut",
              "sanction", "shock", "fear", "slump", "decline", "warn", "threat")


def _instant_domain(text: str) -> str:
    best, best_score = "other", 0
    for dom, words in _DOMAIN_KEYWORDS.items():
        score = sum(1 for w in words if w in text)
        if score > best_score:
            best, best_score = dom, score
    return best


def _instant_severity(text: str, domain: str) -> int:
    hi = sum(1 for w in _HIGH_SEV_WORDS if w in text)
    med = sum(1 for w in _MED_SEV_WORDS if w in text)
    if hi >= 2 or (domain == "disaster" and hi >= 1):
        return 4
    if hi >= 1:
        return 3
    if med >= 1:
        return 2
    return 1


def _instant_sentiment(text: str) -> float:
    p = sum(1 for w in _POS_WORDS if w in text)
    n = sum(1 for w in _NEG_WORDS if w in text)
    if not (p or n):
        return 0.0
    return round((p - n) / (p + n), 2)


def instant_analyze(items: list[dict]) -> int:
    """Give freshly collected items a quick deterministic read so they appear in the
    live feed right away (no LLM, no quota). Each is flagged for the agent to upgrade
    to a full brief later. Returns how many were classified."""
    n = 0
    for it in items:
        text = ((it.get("title") or "") + " " + (it.get("content") or "")).lower()
        domain = _instant_domain(text)
        storage.save_instant(it["dedupe_key"], {
            "domain": domain,
            "severity": _instant_severity(text, domain),
            "sentiment": _instant_sentiment(text),
            "ai_summary": fallback_summary(it),
            "impact_summary": (it.get("content") or it.get("title") or "").strip()[:220],
            "confidence": 0.3,
        })
        n += 1
    if n:
        log.info("instant-classified %d fresh items for the live feed", n)
    return n


def _enrich_ctx(e: dict) -> str:
    return (f"HEADLINE: {e.get('title', '')}\n"
            f"WHAT IT MEANS: {e.get('impact_summary', '')}\n"
            f"DOMAIN: {e.get('domain', 'other')}  SEVERITY: {e.get('severity', 1)}\n"
            f"WHO BENEFITS: {', '.join(e.get('winners') or []) or '—'}\n"
            f"WHO IS AT RISK: {', '.join(e.get('losers') or []) or '—'}\n"
            f"KNOCK-ON: {e.get('second_order', '')}\n"
            f"ARTICLE: {(e.get('content') or '')[:2000]}")


def _agent_enrich(e: dict) -> dict:
    """One LLM call returning {action_plan, economic_impact, economic_impact_after},
    or {} if it can't run."""
    raw = _chat(_ENRICH_SYSTEM, _enrich_ctx(e), max_tokens=1100)
    if not raw:
        return {}
    text = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        obj = json.loads(text)
    except Exception:
        return {}
    if not isinstance(obj, dict):
        return {}
    before = _clean_econ(obj.get("economic_impact"))
    after = _reconcile_after(_clean_econ(obj.get("economic_impact_after")), before)
    return {"ai_summary": (obj.get("ai_summary") or "").strip(),
            "why_it_matters": (obj.get("why_it_matters") or "").strip(),
            "action_plan": _clean_plan(obj.get("action_plan")),
            "economic_impact": before, "economic_impact_after": after,
            "official_brief": _clean_brief(obj.get("official_brief"))}


_DOMAIN_PLAN = {
    "disaster": ("Protect Abu Dhabi's exposed trade routes and supply lines and ready contingency support.",
                 "Trade and essential supply keep moving for Abu Dhabi."),
    "health": ("Apply health-security measures to safeguard Abu Dhabi's people, tourism and essential supply.",
               "Exposure and economic disruption are limited."),
    "policy": ("Assess how this policy shift affects Abu Dhabi's trade and investment, then adjust strategy.",
               "Abu Dhabi stays competitive and acts before any deadline."),
    "supply_chain": ("Secure alternative suppliers and build reserves of critical inputs for Abu Dhabi's industry.",
                     "Abu Dhabi's production and trade are protected from the shortage."),
    "market": ("Review Abu Dhabi's exposure via {who} and hedge or diversify revenue where possible.",
               "Downside to the national economy is contained."),
    "other": ("Confirm whether this touches {who} in Abu Dhabi, then act on what matters most.",
              "Abu Dhabi responds to what is relevant and skips the rest."),
}


def _fallback_plan(e: dict) -> list[dict]:
    """A quick, event-flavoured plan for when the agent can't run — transient,
    so the agent upgrades it on a later view."""
    sev = int(e.get("severity") or 1)
    if sev < 2 or not _ad_relevant(e):
        return []
    losers = [l for l in (e.get("losers") or []) if l][:2]
    winners = [w for w in (e.get("winners") or []) if w][:1]
    who = " and ".join(losers) if losers else "anyone exposed"
    a, o = _DOMAIN_PLAN.get(e.get("domain", "other"), _DOMAIN_PLAN["other"])
    plan = [{"action": a.format(who=who), "priority": "immediate" if sev >= 4 else "high", "outcome": o}]
    if losers:
        plan.append({"action": f"Support {who} with targeted measures — incentives, contracts, or relief.",
                     "priority": "high" if sev >= 4 else "medium",
                     "outcome": f"{losers[0]} is better protected from the downside."})
    if winners:
        plan.append({"action": f"Help Abu Dhabi sectors like {winners[0]} capture the upside.",
                     "priority": "medium", "outcome": "Abu Dhabi benefits from the shift instead of missing it."})
    return plan[:3]


# the broad Abu Dhabi sector each domain hits first, for the deterministic econ fallback
_DOMAIN_SECTOR = {
    "market": "Energy & financial markets", "policy": "Trade & government policy",
    "disaster": "Trade routes & supply", "health": "Healthcare & tourism",
    "supply_chain": "Ports, trade & industry", "other": "Abu Dhabi economy",
}


def _fallback_econ(e: dict) -> dict:
    """A quick economic read for when the agent can't run — transient, so the
    agent upgrades it on a later view. Derived from severity, domain and losers."""
    sev = int(e.get("severity") or 1)
    if sev < 2:
        return {"score": min(10, sev * 5), "level": "low", "sectors": [],
                "summary": "Minimal economic impact — routine or low-signal news."}
    if not _ad_relevant(e):
        # Don't invent an Abu Dhabi impact for unrelated global news — the agent
        # scores these 0–10 with no sectors, so the fallback should too.
        return {"score": min(10, sev * 3), "level": "low", "sectors": [],
                "summary": "No direct Abu Dhabi economic relevance — global / other news."}
    conf = float(e.get("confidence") or 0.3)
    score = max(20, min(95, int(sev * 18 + conf * 10)))
    imp = "high" if sev >= 4 else "medium"
    sectors = [{"sector": _DOMAIN_SECTOR.get(e.get("domain", "other"), "General economy"),
                "impact": imp, "probability": 70,
                "reason": "the event's primary economic channel"}]
    for l in [x for x in (e.get("losers") or []) if x][:2]:
        sectors.append({"sector": l, "impact": imp, "probability": 65,
                        "reason": "named among those most exposed"})
    summary = (e.get("impact_summary") or "").strip() or \
        "Moderate economic impact across the affected sectors."
    return {"score": score, "level": _band(score), "sectors": sectors[:4], "summary": summary}


_LEVEL_DOWN = {"high": "medium", "medium": "low", "low": "low"}


def _fallback_econ_after(before: dict, has_plan: bool) -> dict:
    """Deterministic projected-after-action read for when the agent can't run.
    Cuts the before-state down by one impact band and ~35% on score/probability
    (only a little if there is no real plan). Transient — the agent upgrades it."""
    if not before or not before.get("sectors"):
        return dict(before) if before else {}
    cut = 0.62 if has_plan else 0.85          # stronger plan → bigger reduction
    score = int(before["score"] * cut)
    sectors = []
    for s in before["sectors"]:
        sectors.append({
            "sector": s["sector"],
            "impact": _LEVEL_DOWN[s["impact"]] if has_plan else s["impact"],
            "probability": int(s["probability"] * cut),
            "reason": "residual risk after the action plan is followed" if has_plan
                      else "little changes without acting on the plan",
        })
    summary = ("Following the action plan contains most of the exposure, leaving the "
               "residual impact below." if has_plan
               else "Without acting, the exposure stays close to the before-action read.")
    return {"score": score, "level": _band(score), "sectors": sectors, "summary": summary}


# the Abu Dhabi authority that should own the response, by domain (fallback)
_DOMAIN_OWNER = {
    "market": "Department of Economic Development",
    "policy": "Executive Council & Department of Economic Development",
    "disaster": "Crisis & emergency management authorities",
    "health": "Department of Health",
    "supply_chain": "AD Ports & trade authorities",
    "other": "Department of Economic Development",
}


def _fallback_brief(e: dict) -> dict:
    """A decision-ready brief built from existing fields, for when the agent can't run."""
    sev = int(e.get("severity") or 1)
    move = (e.get("next_action") or "").strip()
    if sev < 2 or not move or not _ad_relevant(e):
        return {}
    losers = [l for l in (e.get("losers") or []) if l][:1]
    winners = [w for w in (e.get("winners") or []) if w][:1]
    sector = _DOMAIN_SECTOR.get(e.get("domain", "other"), "the wider economy")
    payoff = (f"{winners[0]} gains and Abu Dhabi captures the upside early."
              if winners else f"{sector} stays resilient and the downside is contained.")
    return {
        "bottom_line": (e.get("impact_summary") or "").strip(),
        "stakes": (e.get("why_it_matters") or "").strip(),
        "move": move,
        "owner": _DOMAIN_OWNER.get(e.get("domain", "other"), _DOMAIN_OWNER["other"]),
        "timeframe": "now" if sev >= 4 else "this week",
        "payoff": payoff,
        "risk_if_ignored": (f"Abu Dhabi's {losers[0]} stays exposed and the cost grows."
                            if losers else "The economic downside widens if left unaddressed."),
        "options": [], "talking_point": "",
    }


def ensure_enrichment(e: dict) -> dict:
    """Return {"ai_summary", "why_it_matters", "action_plan", "economic_impact",
    "economic_impact_after", "official_brief", "cacheable"}. One agent call fills them
    all (cacheable=True); if the agent can't run, deterministic fallbacks fill the gaps
    (cacheable=False) so the agent can upgrade them on a later view."""
    out = _agent_enrich(e)
    if out and (out.get("action_plan") or out.get("economic_impact") or out.get("ai_summary")):
        return {"ai_summary": out.get("ai_summary") or fallback_summary(e),
                "why_it_matters": out.get("why_it_matters") or fallback_why(e),
                "action_plan": out.get("action_plan") or [],
                "economic_impact": out.get("economic_impact") or {},
                "economic_impact_after": out.get("economic_impact_after") or {},
                "official_brief": out.get("official_brief") or _fallback_brief(e),
                "cacheable": True}
    before = _fallback_econ(e)
    plan = _fallback_plan(e)
    return {"ai_summary": fallback_summary(e), "why_it_matters": fallback_why(e),
            "action_plan": plan, "economic_impact": before,
            "economic_impact_after": _fallback_econ_after(before, bool(plan)),
            "official_brief": _fallback_brief(e), "cacheable": False}


def explain(item: dict) -> dict:
    """How a result was produced — shown on the event detail page."""
    mode = item.get("mode", "")
    if mode == "llm":
        note = "Read and analysed by the AI from the full article."
    elif mode == "demo":
        note = "Curated demo example, included so you can see the output shape."
    else:
        note = "Awaiting AI analysis."
    return {"mode": mode or "pending", "note": note, "signals": [], "keywords": []}


# ---------------------------------------------------------------------------
# Action layer — read the agent's OWN decision (urgency + label + step).
# No templates: if the agent didn't set a step, there is no action.
# ---------------------------------------------------------------------------

_URGENCY_OK = ("act", "review", "watch")
_SEV_URGENCY = {5: "act", 4: "act", 3: "review", 2: "watch", 1: "none"}
_URGENCY_LABEL = {"act": "Act now", "review": "Worth a look", "watch": "Keep watch"}


def derive_action(e: dict) -> dict:
    """The agent's own call on what to do. Falls back to a plain severity
    threshold only for events analysed before the agent set an urgency."""
    step = (e.get("next_action") or "").strip()
    urgency = (e.get("urgency") or "").lower()
    if urgency not in _URGENCY_OK and urgency != "none":
        urgency = _SEV_URGENCY.get(int(e.get("severity") or 1), "none")
    if urgency == "none" or not step:
        return {"key": "none", "label": "", "detail": "", "urgency": "none"}
    label = (e.get("action_label") or "").strip() or _URGENCY_LABEL[urgency]
    return {"key": e.get("domain") or "other", "label": label, "detail": step, "urgency": urgency}


# ---------------------------------------------------------------------------
# Pipeline glue
# ---------------------------------------------------------------------------

def _attach_bodies(items: list[dict]):
    """Fetch the full article text for items that don't have it cached yet, and
    store it on the event so re-analysis never re-fetches."""
    import article
    todo = [it for it in items if not it.get("body") and it.get("url")]
    if not todo:
        return
    bodies = article.fetch_many([it["url"] for it in todo])
    got = 0
    for it, body in zip(todo, bodies):
        if body:
            it["body"] = body
            storage.set_body(it["dedupe_key"], body)
            got += 1
    log.info("fetched %d/%d article bodies for AI analysis", got, len(todo))


def reanalyze_one(key: str) -> bool:
    """Re-run the agent on ONE event right now, so it picks up the latest prompt and
    overwrites the cached analysis. Returns False if the agent has no key, the event
    is gone, or the call fails."""
    if not llm_status()["has_key"]:
        return False
    e = storage.event_full(key)
    if not e:
        return False
    _attach_bodies([e])
    results = llm_analyze([e])
    if not results or results[0] is None:
        return False
    storage.save_analysis(key, results[0])
    return True


_auto_pause_until = 0.0


def auto_reanalyze(key: str) -> bool:
    """Re-analyse a stale-prompt event when it's opened. Backs off for a few minutes
    after a failure (usually API quota) so page loads stay fast instead of retrying
    a dead call on every view."""
    global _auto_pause_until
    if time.time() < _auto_pause_until:
        return False
    ok = reanalyze_one(key)
    if not ok:
        _auto_pause_until = time.time() + 300
    return ok


def analyze_pending(batch: int = 20):
    """Have the agent READ AND ANALYSE every pending event — unanalysed OR flagged
    for re-analysis (i.e. instant-classified items waiting for a full brief) — and
    write the result back, newest-first. The goal is for the LLM to read everything.

    Batch is sized to read as MANY articles as possible per request, because the free
    Gemini tier caps REQUESTS per day (20), not items: one request analyses a whole
    batch, so a bigger batch makes the daily request budget cover far more articles
    (≈20×batch). The only ceiling is the 32k output-token cap — each rich event is
    ~1,100-1,500 output tokens, so ~20/batch (worst case ~26k) stays safely under it.
    (A batch that overflows truncates the JSON and fails the WHOLE batch — that is how
    analysis silently stalls — so we keep a margin.) Override with LLM_BATCH.

    If the agent has no key or a call fails (e.g. the daily quota is spent), the
    affected events keep their instant deterministic read and are retried next run —
    nothing is fabricated.
    """
    if not llm_status()["has_key"]:
        log.warning("AI analysis needs an API key — set %s in .env", llm_status()["missing"])
        return
    batch = int(os.environ.get("LLM_BATCH", str(batch)))
    while True:
        # stay inside the daily request budget, holding the reserve back for
        # interactive use (AI Search, opening an event). When it's spent, items
        # keep their instant read until the budget resets — no quota errors.
        if llm_budget()["remaining"] <= LLM_RESERVE_REQUESTS:
            log.info("daily AI budget spent (%d/%d used); feed stays on instant reads until reset",
                     storage.llm_requests_today(_today()), LLM_DAILY_REQUESTS)
            return
        items = storage.unanalyzed(limit=batch)
        if not items:
            return
        _attach_bodies(items)
        results = llm_analyze(items, reserve=LLM_RESERVE_REQUESTS)
        if results is None:        # provider down / budget — try again next cycle
            log.warning("AI unavailable this run; leaving %d events for next cycle", len(items))
            return
        saved = 0
        for it, res in zip(items, results):
            if res is not None:
                storage.save_analysis(it["dedupe_key"], res)
                saved += 1
        if saved == 0:             # made no progress — don't spin
            log.warning("AI returned no usable results for this batch; stopping")
            return
        if len(items) < batch:
            return
