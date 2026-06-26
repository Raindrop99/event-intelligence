"use client";
import Link from "next/link";
import { useApi } from "@/app/providers";
import { DCOLOR } from "@/lib/ui";
import type { DashboardData } from "@/lib/types";
import { AreaChart } from "@/components/charts";
import { SparkleIcon } from "@/components/icons";

const SEV_COLOR: Record<number, string> = {
  5: "var(--coral)", 4: "var(--amber)", 3: "var(--accent)", 2: "var(--accent)", 1: "var(--mint)",
};
const SEV_BAR: Record<string, string> = {
  Critical: "var(--coral)", High: "var(--amber)", Medium: "var(--accent)", Low: "var(--mint)",
};

function Delta({ value, up }: { value: number; up?: boolean }) {
  const positive = up ?? value >= 0;
  return <span className={`dpill ${positive ? "up" : "down"}`}>{positive ? "▲" : "▼"} {Math.abs(value)}%</span>;
}

export default function DashboardPage() {
  const { data, error } = useApi<DashboardData>("/api/dashboard");

  if (error) return <><h1 className="bigtitle">Dashboard</h1><div className="empty">Couldn&apos;t load the dashboard — is the backend running?</div></>;
  if (!data) return <><h1 className="bigtitle">Dashboard</h1><div className="skel" /><div className="skel" /></>;

  const { severity, ingested, gauges, briefing, topEvents, domains, channels } = data;
  const sevMax = Math.max(...severity.bars.map((b) => b.count), 1);
  const chMax = Math.max(...channels.map((c) => c.value), 1);
  const domMax = Math.max(...domains.map((d) => d.value), 1);

  return (
    <>
      <div className="exphead">
        <div>
          <h1 className="bigtitle">Dashboard</h1>
          <div className="esub">What&apos;s moving Abu Dhabi&apos;s economy today — live across all sources.</div>
        </div>
      </div>

      <div className="db-grid">
        {/* Severity mix */}
        <div className="panelcard">
          <div className="pch"><h3>Severity mix</h3></div>
          <div className="esub" style={{ marginTop: -2 }}>All live events right now</div>
          <div className="db-big"><span className="db-num">{severity.total.toLocaleString()}</span><Delta value={severity.delta} /></div>
          <div className="db-bars">
            {severity.bars.map((b) => (
              <div className="hbar" key={b.label}>
                <span className="hlabel">{b.label}</span>
                <span className="htrack"><i style={{ width: `${(b.count / sevMax) * 100}%`, background: SEV_BAR[b.label] || "var(--accent)" }} /></span>
                <span className="hval">{b.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Events ingested */}
        <div className="panelcard">
          <div className="pch"><h3>Events ingested</h3><span className="chip">7 days</span></div>
          <div className="esub" style={{ marginTop: -2 }}>Across all sources</div>
          <div className="db-big"><span className="db-num">{ingested.total.toLocaleString()}</span><Delta value={ingested.delta} /></div>
          <div style={{ marginTop: 6 }}>
            <AreaChart
              series={[{ key: "v", color: DCOLOR.market, values: ingested.series.map((s) => s.v), label: "Events" }]}
              labels={ingested.series.map((s) => s.d)}
              height={120}
              tooltip
              fillOpacity={0.28}
            />
          </div>
        </div>

        {/* Market gauges */}
        <div className="panelcard">
          <div className="pch"><h3>Market gauges</h3></div>
          <div className="esub" style={{ marginTop: -2, marginBottom: 12 }}>Live risk signals</div>
          {gauges.length ? (
            <div className="db-gauges">
              {gauges.map((g) => (
                <div className="db-gauge" key={g.label}>
                  <span className="db-gauge-l">{g.label}</span>
                  <span className="db-gauge-v">{g.value}</span>
                  <span className={`dpill ${g.up ? "up" : "down"}`}>{g.up ? "▲" : "▼"} {Math.abs(g.delta)}%</span>
                </div>
              ))}
            </div>
          ) : <div className="ilbl">No market gauges available (PostgreSQL offline).</div>}
        </div>

        {/* AI situation briefing */}
        <div className="panelcard db-span2">
          <div className="db-brief-tag"><SparkleIcon /> AI SITUATION BRIEFING</div>
          <h2 className="db-brief-h">{briefing.headline}</h2>
          <p className="db-brief-b">{briefing.body}</p>
          <div className="chips" style={{ marginTop: 14 }}>
            {briefing.chips.map((c) => <span className="chip" key={c}>{c}</span>)}
          </div>
        </div>

        {/* Top events */}
        <div className="panelcard">
          <div className="pch"><h3>Top events</h3></div>
          <div className="esub" style={{ marginTop: -2, marginBottom: 8 }}>Highest severity now</div>
          <div className="db-top">
            {topEvents.map((e, i) => {
              const color = SEV_COLOR[e.sev] || "var(--accent)";
              return (
                <Link className="db-trow" key={e.key || i} href={e.key ? `/event/${encodeURIComponent(e.key)}` : "#"}>
                  <span className="db-tdot" style={{ background: color }} />
                  <div className="db-ttext">
                    <span className="db-ttitle">{e.title}</span>
                    <span className="db-tmeta">{e.domain} · {e.ago}</span>
                  </div>
                  <span className="db-tsev" style={{ color, background: `color-mix(in srgb, ${color} 15%, transparent)` }}>SEV {e.sev}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Events by domain */}
        <div className="panelcard db-span2">
          <div className="pch"><h3>Events by domain</h3><span className="chip">Today</span></div>
          <div className="esub" style={{ marginTop: -2 }}>Live event volume across domains</div>
          <div className="db-domains">
            {domains.map((d) => (
              <div className="db-domcol" key={d.key}>
                <div className="db-domtrack">
                  <div className="db-dombar" style={{ height: `${(d.value / domMax) * 100}%`, background: DCOLOR[d.key] || DCOLOR.other }} title={`${d.value}`} />
                </div>
                <span className="db-domlabel">{d.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Impact channels */}
        <div className="panelcard">
          <div className="pch"><h3>Impact channels</h3></div>
          <div className="esub" style={{ marginTop: -2 }}>Most-activated this week</div>
          <div className="db-bars">
            {channels.map((c) => (
              <div className="hbar" key={c.label}>
                <span className="hlabel">{c.label}</span>
                <span className="htrack"><i style={{ width: `${(c.value / chMax) * 100}%`, background: "var(--amber)" }} /></span>
                <span className="hval">{c.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
