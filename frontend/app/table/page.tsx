"use client";
import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { useApi } from "@/app/providers";
import { ago, DLABEL, DCOLOR, DDESC, SEV, SEVWORD, UC, ULABEL, sortEvents, type SortBy } from "@/lib/ui";
import { downloadCsv } from "@/lib/download";
import type { EventItem, Stats, Todos } from "@/lib/types";
import { SearchIcon, SparkleIcon, MiniIcon } from "@/components/icons";

const TABS = [
  ["all", "All events"], ["act", "Act now"], ["review", "Worth a look"],
  ["watch", "Keep watch"], ["none", "Info"],
] as const;

const DOMAINS = ["market", "policy", "disaster", "health", "supply_chain", "other"];

function Spark({ bars, color }: { bars: number[]; color: string }) {
  const max = Math.max(...bars, 1);
  return (
    <div className="spark12">
      {bars.map((b, i) => (
        <i key={i} style={{ height: `${Math.max(14, Math.round((b / max) * 100))}%`, background: color, opacity: 0.45 + 0.55 * (b / max) }} />
      ))}
    </div>
  );
}

function StatCard({ icon, color, label, value, delta, bars }:
  { icon: string; color: string; label: string; value: string | number; delta: string; bars: number[] }) {
  return (
    <div className="statcard">
      <div className="sh">{label}<span className="si" style={{ background: color + "22", color }}><MiniIconOrSpark name={icon} /></span></div>
      <div className="sv">{value}</div>
      <div className="sd">{delta}</div>
      <Spark bars={bars} color={color} />
    </div>
  );
}

function MiniIconOrSpark({ name }: { name: string }) {
  if (name === "spark") return <SparkleIcon />;
  return <MiniIcon name={name} />;
}

export default function TablePage() {
  const { data: evData } = useApi<EventItem[]>("/api/events?limit=60");
  const { data: stats } = useApi<Stats>("/api/stats");
  const { data: todos } = useApi<Todos>("/api/todos");
  const events = evData ?? [];

  const [tab, setTab] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState("all");
  const [sort, setSort] = useState<SortBy>("new");

  const urgOf = (e: EventItem) => e.action?.urgency || "none";
  const tabCount = (u: string) => (u === "all" ? events.length : events.filter((e) => urgOf(e) === u).length);

  const rows = sortEvents(
    events.filter((e) => {
      if (tab !== "all" && urgOf(e) !== tab) return false;
      if (domain !== "all" && e.domain !== domain) return false;
      if (search && !(e.title || "").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }),
    sort,
  );

  // stat cards
  const total = stats?.total ?? events.length;
  const analyzed = stats?.analyzed ?? events.length;
  const high = stats?.high_severity ?? events.filter((e) => (e.severity || 1) >= 4).length;
  const acts = todos?.counts.act ?? events.filter((e) => urgOf(e) === "act").length;
  const reviews = todos?.counts.review ?? events.filter((e) => urgOf(e) === "review").length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  // a small 12h activity sparkline reused across the stat cards
  const now = Date.now() / 1000;
  const bars = new Array(12).fill(0);
  events.forEach((e) => { const h = Math.floor((now - e.ts) / 3600); if (h >= 0 && h < 12) bars[11 - h]++; });
  const sparkBars = bars.some((b) => b) ? bars : [2, 3, 2, 4, 3, 5, 4, 6, 5, 7, 6, 8];

  // donut: domain breakdown
  const domCounts: Record<string, number> = {};
  events.forEach((e) => { domCounts[e.domain] = (domCounts[e.domain] || 0) + 1; });
  const domEntries = Object.entries(domCounts).sort((a, b) => b[1] - a[1]);
  const donutN = events.length || 1;
  let acc = 0;
  const segs = domEntries.map(([d, n]) => {
    const s = (acc / donutN) * 100; acc += n; const e = (acc / donutN) * 100;
    return `${DCOLOR[d] || DCOLOR.other} ${s}% ${e}%`;
  });
  const conic = segs.length ? `conic-gradient(${segs.join(",")})` : `conic-gradient(var(--line) 0 100%)`;

  // right-rail insights
  const themes: Record<string, number> = {};
  events.forEach((e) => { const a = e.action; if (a && (a.urgency === "act" || a.urgency === "review")) themes[a.label] = (themes[a.label] || 0) + 1; });
  const topTheme = Object.entries(themes).sort((a, b) => b[1] - a[1])[0];
  const topSerious = [...events].sort((a, b) => (b.severity || 1) * (b.confidence || 0) - (a.severity || 1) * (a.confidence || 0))[0];
  const avg = events.length ? events.reduce((s, e) => s + (e.sentiment || 0), 0) / events.length : 0;
  const moodWord = avg < -0.2 ? "Cautious" : avg < -0.05 ? "Slightly negative" : avg > 0.2 ? "Upbeat" : avg > 0.05 ? "Slightly positive" : "Mixed";

  const clearFilters = () => { setSearch(""); setDomain("all"); setTab("all"); setSort("new"); };

  return (
    <div className="tablewrap">
      <div className="tablemain">
        <div className="exphead">
          <div>
            <h1>Events table</h1>
            <div className="esub">Browse, filter, and dig into every analysed event in one place.</div>
          </div>
          <div className="exhbtns">
            <button className="ebtn primary" onClick={() => location.assign("/search")}><SparkleIcon /> Ask AI</button>
            <button className="ebtn" onClick={() => downloadCsv("events.csv", rows.map((e) => ({
              title: e.title, source: e.source, domain: DLABEL[e.domain] || e.domain,
              severity: e.severity, priority: e.action?.urgency || "none",
              confidence_pct: Math.round((e.confidence || 0) * 100), when: ago(e.ts),
            })))}><MiniIcon name="download" /> Export</button>
          </div>
        </div>

        <div className="statgrid">
          <StatCard icon="spark" color="#9D86FF" label="Total events" value={total.toLocaleString()} delta="in the recent window" bars={sparkBars} />
          <StatCard icon="chart" color="#0E9F6E" label="Analysed" value={analyzed.toLocaleString()} delta={`${pct(analyzed)}% of total`} bars={sparkBars} />
          <StatCard icon="eye" color="#22B8DD" label="Act now" value={acts} delta="need action" bars={sparkBars} />
          <StatCard icon="filter" color="#F5A93D" label="Worth a look" value={reviews} delta="review soon" bars={sparkBars} />
          <StatCard icon="sort" color="#F0564A" label="High severity" value={high} delta={`${pct(high)}% of total`} bars={sparkBars} />
        </div>

        <div className="tabs2">
          {TABS.map(([k, label]) => (
            <button key={k} className={`tab2 ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>
              {label} ({tabCount(k)})
            </button>
          ))}
        </div>

        <div className="toolbar2">
          <div className="t2search">
            <SearchIcon />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search events…" />
          </div>
          <select className="t2sel" value={domain} onChange={(e) => setDomain(e.target.value)}>
            <option value="all">All topics</option>
            {DOMAINS.map((d) => <option key={d} value={d}>{DLABEL[d]}</option>)}
          </select>
          <select className="t2sel" value={sort} onChange={(e) => setSort(e.target.value as SortBy)}>
            <option value="new">Newest</option>
            <option value="impact">Most important</option>
          </select>
          <button className="t2btn"><MiniIcon name="filter" /> More filters</button>
        </div>

        <div className="evtable">
          <div className="evrow head">
            <span>Event</span><span className="hideS">Topic</span><span className="hideS">Severity</span>
            <span>Priority</span><span className="hideS">Certainty</span><span className="hideS">Last seen</span><span>Actions</span>
          </div>
          {!evData ? (
            <div className="evempty">Loading events…</div>
          ) : rows.length ? (
            rows.map((e) => {
              const urg = urgOf(e);
              const conf = Math.round((e.confidence || 0) * 100);
              const link = `/event/${encodeURIComponent(e.dedupe_key)}`;
              return (
                <div key={e.dedupe_key} className="evrow r">
                  <div className="evname">
                    <Link href={link}>{e.title}</Link>
                    <div className="es">{e.source}</div>
                  </div>
                  <div className="evarea hideS">
                    <span className="evdot" style={{ background: DCOLOR[e.domain] || DCOLOR.other }} />{DLABEL[e.domain] || "Other"}
                  </div>
                  <div className="hideS">
                    <span className="phasepill" style={{ "--sev": SEV[e.severity] || SEV[1] } as CSSProperties}>{SEVWORD[e.severity] || "Info"}</span>
                  </div>
                  <div>
                    <span className={`statuspill ${urg}`}>{urg === "none" ? "Info" : ULABEL[urg]}</span>
                  </div>
                  <div className="hideS">
                    <span className="evcert">{conf}%</span>
                    <div className="evbar"><i style={{ width: `${conf}%`, background: "var(--accent)" }} /></div>
                  </div>
                  <div className="es hideS">{ago(e.ts)}</div>
                  <div className="evact">
                    <Link href={link} title="View"><MiniIcon name="eye" /></Link>
                    <Link href={`/view/${e.domain}`} title="Topic"><MiniIcon name="chart" /></Link>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="evempty">No events match these filters.</div>
          )}
        </div>
      </div>

      <div className="rail">
        <div className="filtercard">
          <div className="filterhead"><h4>Filters</h4><button className="clr" onClick={clearFilters}>Clear all</button></div>
          <div className="t2search" style={{ marginTop: 4 }}>
            <SearchIcon /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search in results…" />
          </div>
          <div className="flabel">Topic</div>
          <select className="fsel" value={domain} onChange={(e) => setDomain(e.target.value)}>
            <option value="all">All topics</option>
            {DOMAINS.map((d) => <option key={d} value={d}>{DLABEL[d]}</option>)}
          </select>
          <div className="flabel">Priority</div>
          <select className="fsel" value={tab} onChange={(e) => setTab(e.target.value)}>
            {TABS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <div className="flabel">Sort</div>
          <select className="fsel" value={sort} onChange={(e) => setSort(e.target.value as SortBy)}>
            <option value="new">Newest first</option>
            <option value="impact">Most important first</option>
          </select>
          <button className="applybtn" onClick={clearFilters}>Reset filters</button>
        </div>

        <div className="donutcard">
          <div className="filterhead" style={{ width: "100%" }}><h4>By topic</h4></div>
          <div className="donut" style={{ background: conic }}>
            <div className="donutc"><div className="dn">{total.toLocaleString()}</div><div className="dl">Total</div></div>
          </div>
          <div className="donutleg">
            {domEntries.map(([d, n]) => (
              <div key={d} className="dlrow">
                <span className="dlsw" style={{ background: DCOLOR[d] || DCOLOR.other }} />
                {DLABEL[d] || "Other"}<b>{n}</b>
              </div>
            ))}
          </div>
        </div>

        <div className="filtercard" style={{ marginTop: 16 }}>
          <div className="filterhead"><h4>AI Insights <span className="beta">LIVE</span></h4></div>
          {topTheme && (
            <div className="insight g2"><div className="il">Top priority</div><h5>{topTheme[0]}</h5>
              <p>{topTheme[1]} event{topTheme[1] !== 1 ? "s" : ""} point the same way.</p></div>
          )}
          {topSerious && (
            <Link href={`/event/${encodeURIComponent(topSerious.dedupe_key)}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div className="insight g1"><div className="il">Most serious</div><h5>{DLABEL[topSerious.domain] || "Event"}</h5>
                <p>{topSerious.title}</p></div>
            </Link>
          )}
          <div className="insight g3"><div className="il">Overall mood</div><h5>{moodWord}</h5>
            <p>{DDESC[domEntries[0]?.[0]] ? `Most activity in ${DLABEL[domEntries[0][0]]}. ` : ""}Tone {avg >= 0 ? "+" : ""}{avg.toFixed(2)} on average.</p></div>
        </div>
      </div>
    </div>
  );
}
