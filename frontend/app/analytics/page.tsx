"use client";
import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/app/providers";
import { DLABEL, DCOLOR } from "@/lib/ui";
import type { AnalyticsData } from "@/lib/types";
import { AreaChart, Radar, Donut } from "@/components/charts";
import { downloadCsv } from "@/lib/download";
import { MiniIcon, TryIcon } from "@/components/icons";

const PERIODS = ["Daily", "Weekly", "Monthly", "Quarterly"];
const SER = {
  events: { color: "#5B8CFF", label: "Events" },
  analyzed: { color: "#22B8DD", label: "Analysed" },
  high: { color: "#F0564A", label: "High severity" },
  act: { color: "#9D86FF", label: "Act now" },
} as Record<string, { color: string; label: string }>;

function Stat({ label, value, delta, color, icon }:
  { label: string; value: string; delta: number; color: string; icon: string }) {
  const up = delta >= 0;
  return (
    <div className="statcard">
      <div className="sh">{label}<span className="si" style={{ background: color + "22", color }}><TryIcon name={icon} /></span></div>
      <div className="sv">{value}</div>
      <div className="sd"><span className={`dpill ${up ? "up" : "down"}`}>{up ? "▲" : "▼"} {Math.abs(delta)}%</span><span className="sub">vs previous</span></div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { data } = useApi<AnalyticsData>("/api/analytics");
  const [period, setPeriod] = useState("Weekly");

  if (!data) return <><div className="eyebrow">Analytics</div><h1 className="bigtitle">Loading…</h1><div className="skel" /></>;
  const c = data.cards;
  const series = data.series.map((s) => ({ key: s.key, color: SER[s.key]?.color || "#8DA0C5", values: s.values, label: SER[s.key]?.label || s.key }));
  const maxPct = Math.max(...data.distribution.map((d) => d.pct), 1);
  const sm = data.summary;

  return (
    <>
      <div className="panelcard" style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow">Analytics</div>
          <h1 className="bigtitle" style={{ marginTop: 4 }}>Live news, turned into actionable intelligence.</h1>
        </div>
        <div className="headtools" style={{ marginLeft: "auto" }}>
          <button className="pickbtn"><MiniIcon name="chart" /> {data.range}</button>
          <button className="pickbtn">Compare: previous</button>
          <button className="ebtn primary" onClick={() => downloadCsv("analytics-by-domain.csv", data.distribution.map((d) => ({
            domain: DLABEL[d.key] || d.key, events: d.count, share_pct: d.pct, change_pct: d.delta,
          })))}><MiniIcon name="download" /> Export report</button>
        </div>
      </div>

      <div className="statgrid">
        <Stat label="Total events" value={c.total.value.toLocaleString()} delta={c.total.delta} color="#5B8CFF" icon="bar" />
        <Stat label="In recent window" value={c.events.value.toLocaleString()} delta={c.events.delta} color="#22B8DD" icon="flask" />
        <Stat label="Action plans" value={c.insights.value.toLocaleString()} delta={c.insights.delta} color="#9D86FF" icon="bulb" />
        <Stat label="High severity" value={c.high.value.toLocaleString()} delta={c.high.delta} color="#F0564A" icon="bar" />
        <Stat label="Avg confidence" value={`${c.confidence.value}%`} delta={c.confidence.delta} color="#0E9F6E" icon="target" />
      </div>

      <div className="recgrid">
        <div>
          <div className="panelcard">
            <div className="pch">
              <h3><MiniIcon name="chart" /> Activity command center</h3>
              <div className="segctl">
                {PERIODS.map((p) => <button key={p} className={`segbtn ${period === p ? "on" : ""}`} onClick={() => setPeriod(p)}>{p}</button>)}
              </div>
            </div>
            <div className="legend" style={{ marginTop: 4, marginBottom: 4 }}>
              {series.map((s) => <span key={s.key} className="legitem"><span className="legdot" style={{ background: s.color }} />{s.label}</span>)}
            </div>
            <AreaChart series={series} labels={data.labels} height={250} tooltip yTicks={5} fillOpacity={0.16} />
            <div className="lxaxis">{data.labels.map((l, i) => (i % 2 === 0 ? <span key={i}>{l}</span> : null))}</div>
          </div>

          <div className="col2">
            <div className="panelcard">
              <div className="pch"><h3>By topic area</h3></div>
              <Radar axes={data.distribution.slice(0, 6).map((d) => ({ label: DLABEL[d.key], value: Math.round((d.pct / maxPct) * 100) }))} size={230} />
              <div className="legend" style={{ justifyContent: "center" }}>
                {data.distribution.slice(0, 3).map((d) => <span key={d.key} className="legitem"><span className="legdot" style={{ background: DCOLOR[d.key] || DCOLOR.other }} />{DLABEL[d.key]} {d.pct}%</span>)}
              </div>
            </div>
            <div className="panelcard">
              <div className="pch"><h3>Top categories</h3></div>
              {data.distribution.map((d) => (
                <div key={d.key} className="hbar">
                  <span className="hlabel">{DLABEL[d.key]}</span>
                  <span className="htrack"><i style={{ width: `${(d.pct / maxPct) * 100}%`, background: DCOLOR[d.key] || DCOLOR.other }} /></span>
                  <span className="hval">{d.count}</span>
                  <span className="hdir" style={{ color: d.delta >= 0 ? "var(--mint)" : "var(--coral)", fontSize: 11, fontWeight: 700, width: 42, textAlign: "right" }}>
                    {d.delta >= 0 ? "+" : ""}{d.delta}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rail">
          <div className="panelcard">
            <div className="pch"><h3>AI insights summary</h3></div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 6 }}>Executive intelligence highlights</div>
            {sm.top_area && (
              <div className="exrow" style={{ display: "block" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="exk">Most active area</span><span className="exbadge g">{sm.top_area.pct}% of activity</span>
                </div>
                <h5>{DLABEL[sm.top_area.key]}</h5>
                <p>The busiest topic in the feed right now. <Link className="exaction" href={`/view/${sm.top_area.key}`}>Review topic →</Link></p>
              </div>
            )}
            {sm.top_insight && (
              <div className="exrow" style={{ display: "block" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="exk">Top performing insight</span><span className="exbadge g">{sm.top_insight.confidence}% confidence</span>
                </div>
                <h5>{sm.top_insight.title}</h5>
                <Link className="exaction" href={`/event/${encodeURIComponent(sm.top_insight.key)}`}>View full analysis →</Link>
              </div>
            )}
            {sm.gap && (
              <div className="exrow" style={{ display: "block" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="exk">Knowledge gap alert</span><span className="exbadge a">Thin coverage</span>
                </div>
                <h5>{DLABEL[sm.gap.key]}</h5>
                <p>Only {sm.gap.count} event{sm.gap.count !== 1 ? "s" : ""} in this area — a potential blind spot. <Link className="exaction" href={`/view/${sm.gap.key}`}>Open →</Link></p>
              </div>
            )}
          </div>

          <div className="panelcard donutcard">
            <div className="pch" style={{ width: "100%" }}><h3>Knowledge coverage</h3></div>
            <Donut segments={[{ color: "var(--accent)", value: data.coverage }, { color: "var(--line)", value: 100 - data.coverage }]} label={`${data.coverage}%`} sub="areas mapped" size={150} />
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 12, textAlign: "center" }}>Share of topic areas with live coverage.</div>
          </div>
        </div>
      </div>
    </>
  );
}
