"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useApi } from "@/app/providers";
import { ago, DLABEL } from "@/lib/ui";
import type { EventItem, SearchResult } from "@/lib/types";
import EventCard from "@/components/EventCard";
import { SparkleIcon, ArrowIcon, SearchIcon, ClockIcon, TryIcon } from "@/components/icons";

const POPULAR = [
  "What's driving the markets today?",
  "Which events put airlines or transport at risk?",
  "What should I act on right now?",
  "Any supply-chain disruptions brewing?",
];

const TRY = [
  { name: "search", title: "Find related events", desc: "Pull every recent event tied to a topic you name.", q: "Show me everything about oil and energy" },
  { name: "bar", title: "Spot the risks", desc: "Which sectors are most exposed right now.", q: "Which sectors are most at risk right now?" },
  { name: "bulb", title: "Get the gist", desc: "A quick read of today's most important events.", q: "Summarise today's most important events" },
  { name: "flask", title: "Who's affected", desc: "Which groups stand to gain or lose.", q: "Who gains and who loses from the latest events?" },
  { name: "doc", title: "What to do", desc: "The concrete steps worth taking today.", q: "What actions should I take based on today's events?" },
];

interface Recent { q: string; ts: number }

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="search-wrap"><div className="searchmain"><h1 className="search-h1">AI Search</h1></div></div>}>
      <SearchInner />
    </Suspense>
  );
}

function SearchInner() {
  const params = useSearchParams();
  const [q, setQ] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<Recent[]>([]);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("eii-recent-searches") || "[]");
      if (Array.isArray(s)) setRecent(s);
    } catch {}
  }, []);

  const { data: evData } = useApi<EventItem[]>("/api/events?limit=60");
  const evs = evData ?? [];

  const runSearch = async (text: string) => {
    const query = text.trim();
    if (!query) return;
    setQ(query);
    setLoading(true);
    setResult(null);
    const entry = { q: query, ts: Math.floor(Date.now() / 1000) };
    setRecent((prev) => {
      const next = [entry, ...prev.filter((r) => r.q !== query)].slice(0, 6);
      try { localStorage.setItem("eii-recent-searches", JSON.stringify(next)); } catch {}
      return next;
    });
    try {
      setResult(await api<SearchResult>("/api/search?q=" + encodeURIComponent(query)));
    } catch {
      setResult({ answer: "Search failed — check the API is running and try again.", events: [] });
    }
    setLoading(false);
  };

  const clearRecent = () => {
    setRecent([]);
    try { localStorage.removeItem("eii-recent-searches"); } catch {}
  };

  // run a query handed off from the header search bar (/search?q=…)
  const urlQ = params.get("q") || "";
  useEffect(() => {
    if (urlQ) runSearch(urlQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlQ]);

  // right-rail insights derived from the recent feed
  const themes: Record<string, number> = {};
  evs.forEach((e) => {
    const a = e.action;
    if (a && (a.urgency === "act" || a.urgency === "review")) themes[a.label] = (themes[a.label] || 0) + 1;
  });
  const topTheme = Object.entries(themes).sort((a, b) => b[1] - a[1])[0];
  const topEvent = [...evs].sort((a, b) => (b.severity || 1) * (b.confidence || 0) - (a.severity || 1) * (a.confidence || 0))[0];
  const avg = evs.length ? evs.reduce((s, e) => s + (e.sentiment || 0), 0) / evs.length : 0;
  const moodWord = avg < -0.2 ? "Cautious" : avg < -0.05 ? "Slightly negative" : avg > 0.2 ? "Upbeat" : avg > 0.05 ? "Slightly positive" : "Mixed";

  return (
    <div className="search-wrap">
      <div className="searchmain">
        <h1 className="search-h1">AI Search</h1>
        <p className="search-sub">Ask anything about the live events. The AI reads across the feed and answers, citing the events it used.</p>

        <div className="herocard">
          <div className="sparkcircle"><SparkleIcon /></div>
          <div className="heroq">What would you like to know about today&apos;s events?</div>
          <form className="searchbox" onSubmit={(e) => { e.preventDefault(); runSearch(q); }}>
            <span className="spark"><SparkleIcon /></span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Describe what you're looking for…"
              aria-label="Search the events"
            />
            <span className="kbd">Enter</span>
            <button className="gobtn" type="submit" disabled={loading || !q.trim()} title="Search"><ArrowIcon /></button>
          </form>
          <div className="poplabel">Popular searches</div>
          <div className="popgrid">
            {POPULAR.map((p) => (
              <button key={p} className="popbtn" onClick={() => runSearch(p)}><SearchIcon />{p}</button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="answercard"><div className="atitle"><SparkleIcon /> Searching…</div>
            <div className="abody">Reading across the events for an answer.</div></div>
        )}

        {result && !loading && (
          <>
            <div className="answercard">
              <div className="atitle"><SparkleIcon /> {result.mode === "keyword" ? "Keyword matches" : "AI answer"}</div>
              <div className="abody">{result.answer}</div>
            </div>
            {result.events.length > 0 && (
              <>
                <div className="answersrc">Events behind this answer</div>
                {result.events.map((e) => <EventCard key={e.dedupe_key} e={e} />)}
              </>
            )}
          </>
        )}

        {!result && !loading && (
          <>
            <div className="tryh">Try asking about</div>
            <div className="trygrid">
              {TRY.map((t) => (
                <button key={t.title} className="trycard" onClick={() => runSearch(t.q)}>
                  <div className="ti"><TryIcon name={t.name} /></div>
                  <h5>{t.title}</h5>
                  <p>{t.desc}</p>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="rail">
        <div className="railcard">
          <div className="railhead">
            <h4>Recent searches</h4>
            {recent.length > 0 && <button className="va" onClick={clearRecent}>Clear</button>}
          </div>
          {recent.length ? recent.map((r, i) => (
            <button key={i} className="recent" onClick={() => runSearch(r.q)}>
              <span className="rc"><ClockIcon /></span>
              <span className="rt">{r.q}</span>
              <span className="rg">{ago(r.ts)}</span>
            </button>
          )) : <div className="recent-empty">Your searches will show up here.</div>}
        </div>

        <div className="railcard">
          <div className="railhead"><h4>Key insights <span className="beta">LIVE</span></h4></div>
          {topTheme && (
            <div className="insight g1">
              <div className="il">Biggest theme</div>
              <h5>{topTheme[0]}</h5>
              <p>{topTheme[1]} event{topTheme[1] !== 1 ? "s" : ""} point the same way.</p>
            </div>
          )}
          {topEvent && (
            <Link href={`/event/${encodeURIComponent(topEvent.dedupe_key)}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div className="insight g2">
                <div className="il">Most serious right now</div>
                <h5>{DLABEL[topEvent.domain] || "Event"}</h5>
                <p>{topEvent.title}</p>
              </div>
            </Link>
          )}
          <div className="insight g3">
            <div className="il">Overall mood</div>
            <h5>{moodWord}</h5>
            <p>Average tone across the recent events ({avg >= 0 ? "+" : ""}{avg.toFixed(2)}).</p>
          </div>
        </div>
      </div>
    </div>
  );
}
