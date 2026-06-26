"use client";
import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/app/providers";
import { DLABEL, DCOLOR } from "@/lib/ui";
import type { ReportsData, ReportRow } from "@/lib/types";
import { Donut } from "@/components/charts";
import { downloadCsv, copyText } from "@/lib/download";
import { MiniIcon, TryIcon, SearchIcon } from "@/components/icons";

const TYPE_DOMAIN: Record<string, string> = {
  "Market Brief": "market", "Policy Note": "policy", "Disaster Report": "disaster",
  "Health Alert": "health", "Supply Note": "supply_chain", "General": "other",
};
const typeColor = (t: string) => DCOLOR[TYPE_DOMAIN[t] || "other"] || DCOLOR.other;
const fmtDate = (ts: number) =>
  new Date(ts * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

function Stat({ label, value, color, icon, hint }:
  { label: string; value: string; color: string; icon: string; hint: string }) {
  return (
    <div className="statcard">
      <div className="sh">{label}<span className="si" style={{ background: color + "22", color }}><TryIcon name={icon} /></span></div>
      <div className="sv">{value}</div>
      <div className="sd">{hint}</div>
    </div>
  );
}

export default function ReportsPage() {
  const { data } = useApi<ReportsData>("/api/reports?limit=120");
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"table" | "grid">("table");
  const [sort, setSort] = useState("new");

  if (!data) return <><h1 className="bigtitle">Reports</h1><div className="skel" /><div className="skel" /></>;
  const c = data.cards;
  const types = data.by_type;

  const rows = data.rows
    .filter((r) => (tab === "all" ? true : tab === "high" ? r.severity >= 4 : r.type === tab))
    .filter((r) => (search ? (r.title + r.source).toLowerCase().includes(search.toLowerCase()) : true))
    .sort((a, b) => (sort === "conf" ? b.confidence - a.confidence : sort === "sev" ? b.severity - a.severity : (b.ts || 0) - (a.ts || 0)));

  const clear = () => { setSearch(""); setTab("all"); setSort("new"); };

  return (
    <div className="tablewrap">
      <div className="tablemain">
        <div className="exphead">
          <div>
            <h1>Reports</h1>
            <div className="esub">Access and explore every analysed event as a one-line research report.</div>
          </div>
          <div className="exhbtns">
            <button className="ebtn" onClick={() => downloadCsv("reports.csv", rows.map((r) => ({
              report: r.title, type: r.type, area: DLABEL[r.domain] || r.domain,
              source: r.source, date: r.ts ? new Date(r.ts * 1000).toISOString().slice(0, 10) : "",
              severity: r.severity, confidence_pct: r.confidence,
            })))}><MiniIcon name="download" /> Export</button>
            <Link className="ebtn primary" href="/recommendations"><MiniIcon name="plus" /> New analysis</Link>
          </div>
        </div>

        <div className="statgrid">
          <Stat label="Total reports" value={c.total.toLocaleString()} color="#5B8CFF" icon="doc" hint="in the recent window" />
          <Stat label="High severity" value={String(c.high)} color="#F0564A" icon="bar" hint="serious events" />
          <Stat label="Act now" value={String(c.act)} color="#9D86FF" icon="bulb" hint="need action" />
          <Stat label="Topic areas" value={String(c.domains)} color="#22B8DD" icon="bar" hint="covered" />
          <Stat label="Avg confidence" value={`${c.avg_confidence}%`} color="#0E9F6E" icon="target" hint="high confidence" />
        </div>

        <div className="tabs2">
          <button className={`tab2 ${tab === "all" ? "on" : ""}`} onClick={() => setTab("all")}>All reports ({c.total})</button>
          <button className={`tab2 ${tab === "high" ? "on" : ""}`} onClick={() => setTab("high")}>High severity ({c.high})</button>
          {types.slice(0, 4).map((t) => (
            <button key={t.type} className={`tab2 ${tab === t.type ? "on" : ""}`} onClick={() => setTab(t.type)}>{t.type} ({t.count})</button>
          ))}
        </div>

        <div className="toolbar2">
          <div className="t2search"><SearchIcon /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reports…" /></div>
          <select className="t2sel" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="new">Newest</option>
            <option value="conf">Highest confidence</option>
            <option value="sev">Most severe</option>
          </select>
          <div className="viewtoggle">
            <button className={view === "table" ? "on" : ""} onClick={() => setView("table")}><MiniIcon name="sort" /> Table</button>
            <button className={view === "grid" ? "on" : ""} onClick={() => setView("grid")}><MiniIcon name="grid" /> Grid</button>
          </div>
        </div>

        {view === "table" ? (
          <div className="evtable">
            <div className="evrow head">
              <span>Report</span><span className="hideS">Type</span><span className="hideS">Area</span>
              <span className="hideS">Source</span><span className="hideS">Date</span><span>Confidence</span><span>Actions</span>
            </div>
            {rows.length ? rows.map((r) => <Row key={r.key} r={r} />) : <div className="evempty">No reports match these filters.</div>}
          </div>
        ) : (
          <div className="col3" style={{ marginTop: 14 }}>
            {rows.slice(0, 18).map((r) => (
              <Link key={r.key} className="panelcard" href={`/event/${encodeURIComponent(r.key)}`} style={{ textDecoration: "none", color: "inherit" }}>
                <span className="typebadge" style={{ color: typeColor(r.type), background: typeColor(r.type) + "1f" }}>{r.type}</span>
                <h5 style={{ fontFamily: "var(--mont)", fontWeight: 700, fontSize: 14.5, margin: "8px 0 4px" }}>{r.title}</h5>
                <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{r.subtitle}</p>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 11.5, color: "var(--muted)" }}>
                  <span>{DLABEL[r.domain]}</span><span style={{ color: "var(--accent)", fontWeight: 700 }}>{r.confidence}%</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="rail">
        <div className="filtercard">
          <div className="filterhead"><h4>Filters</h4><button className="clr" onClick={clear}>Clear all</button></div>
          <div className="t2search" style={{ marginTop: 4 }}><SearchIcon /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reports…" /></div>
          <div className="flabel">Report type</div>
          <select className="fsel" value={tab} onChange={(e) => setTab(e.target.value)}>
            <option value="all">All types</option>
            <option value="high">High severity</option>
            {types.map((t) => <option key={t.type} value={t.type}>{t.type}</option>)}
          </select>
          <div className="flabel">Sort</div>
          <select className="fsel" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="new">Newest first</option>
            <option value="conf">Highest confidence</option>
            <option value="sev">Most severe</option>
          </select>
          <button className="applybtn" onClick={clear}>Reset filters</button>
        </div>

        <div className="donutcard">
          <div className="filterhead" style={{ width: "100%" }}><h4>By type</h4></div>
          <Donut segments={types.map((t) => ({ color: typeColor(t.type), value: t.count }))} label={c.total.toLocaleString()} sub="reports" size={160} />
          <div className="donutleg">
            {types.map((t) => (
              <div key={t.type} className="dlrow"><span className="dlsw" style={{ background: typeColor(t.type) }} />{t.type}<b>{t.count}</b></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ r }: { r: ReportRow }) {
  const link = `/event/${encodeURIComponent(r.key)}`;
  const col = typeColor(r.type);
  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    await copyText(window.location.origin + link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  return (
    <div className="evrow r">
      <div className="evname"><Link href={link}>{r.title}</Link><div className="es">{r.subtitle}</div></div>
      <div className="hideS"><span className="typebadge" style={{ color: col, background: col + "1f" }}>{r.type}</span></div>
      <div className="evarea hideS"><span className="evdot" style={{ background: DCOLOR[r.domain] || DCOLOR.other }} />{DLABEL[r.domain]}</div>
      <div className="rptby hideS"><span className="av" style={{ background: DCOLOR[r.domain] || DCOLOR.other }}>{r.source.slice(0, 2).toUpperCase()}</span>{r.source}</div>
      <div className="es hideS">{r.ts ? fmtDate(r.ts) : "—"}</div>
      <div><span className="evcert">{r.confidence}%</span><div className="evbar"><i style={{ width: `${r.confidence}%`, background: "var(--accent)" }} /></div></div>
      <div className="evact">
        <Link href={link} title="View"><MiniIcon name="eye" /></Link>
        <Link href={link} title="Open"><MiniIcon name="download" /></Link>
        <button type="button" title="Copy link" onClick={copyLink} style={{ background: "none", border: "none", color: copied ? "var(--mint)" : "inherit", cursor: "pointer", padding: 0 }}>
          {copied ? <MiniIcon name="check" /> : <MiniIcon name="share" />}
        </button>
      </div>
    </div>
  );
}
