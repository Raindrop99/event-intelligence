"use client";
import Link from "next/link";
import { useApi } from "@/app/providers";
import type { EventItem } from "@/lib/types";
import { DLABEL, ago } from "@/lib/ui";

function ProjectionBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="projstat">
      <div className="projstat-top">
        <span>{label}</span>
        <b>{value}/100</b>
      </div>
      <div className="progb"><i style={{ width: `${Math.max(4, value)}%`, background: color }} /></div>
    </div>
  );
}

function getRiskLevel(score: number) {
  if (score >= 80) return { label: "Critical", tone: "critical", copy: "Several high-severity signals are converging and need immediate coordination." };
  if (score >= 60) return { label: "High", tone: "high", copy: "Material exposure is likely and the response window is tightening." };
  if (score >= 40) return { label: "Moderate", tone: "moderate", copy: "The signal is meaningful but still manageable with prompt attention." };
  return { label: "Low", tone: "low", copy: "The outlook is mostly stable with limited spillover risk." };
}

function getSentimentLabel(avg: number) {
  if (avg > 0.2) return "Positive";
  if (avg < -0.2) return "Negative";
  return "Mixed";
}

export default function ProjectionsPage() {
  const { data } = useApi<EventItem[]>('/api/events?limit=80');
  const events = (data ?? []).filter((e) => e.action_plan || e.economic_impact || e.economic_impact_after || e.official_brief);

  const averageBefore = events.length ? Math.round(events.reduce((s, e) => s + (e.economic_impact?.score ?? 0), 0) / events.length) : 0;
  const averageAfter = events.length ? Math.round(events.reduce((s, e) => s + (e.economic_impact_after?.score ?? 0), 0) / events.length) : 0;
  const expectedReduction = Math.max(0, averageBefore - averageAfter);
  const severityAvg = events.length ? events.reduce((s, e) => s + (e.severity || 1), 0) / events.length : 0;
  const urgencyCounts = { act: events.filter((e) => e.action?.urgency === "act").length, review: events.filter((e) => e.action?.urgency === "review").length, watch: events.filter((e) => e.action?.urgency === "watch").length };
  const domainCounts = events.reduce<Record<string, number>>((acc, e) => {
    const key = e.domain || "other";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const channelCounts = events.reduce<Record<string, number>>((acc, e) => {
    (e.channels || []).forEach((c) => { acc[c] = (acc[c] || 0) + 1; });
    return acc;
  }, {});
  const sentimentAvg = events.length ? events.reduce((s, e) => s + (e.sentiment || 0), 0) / events.length : 0;
  const planReady = events.filter((e) => e.action_plan).length;
  const briefReady = events.filter((e) => e.official_brief).length;
  const riskScore = Math.min(100, Math.round((severityAvg / 5) * 45 + (urgencyCounts.act / Math.max(1, events.length)) * 35 + (events.filter((e) => (e.severity || 1) >= 4).length / Math.max(1, events.length)) * 20));
  const riskMeta = getRiskLevel(riskScore);

  const topDomains = Object.entries(domainCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const topChannels = Object.entries(channelCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const networkDomains = topDomains.map(([name], idx) => ({ id: name, x: 38 + idx * 56, y: 92, kind: "domain" as const }));
  const networkChannels = topChannels.map(([name], idx) => ({ id: name, x: 180 + (idx % 2 === 0 ? -10 : 24), y: 38 + idx * 28, kind: "channel" as const }));
  const networkNodes = [
    { id: "Abu Dhabi", x: 120, y: 28, kind: "hub" as const },
    ...networkDomains,
    ...networkChannels,
  ];
  const networkLines = [
    ...networkDomains.map((n) => ({ x1: 120, y1: 28, x2: n.x, y2: n.y })),
    ...networkDomains.flatMap((d, idx) => networkChannels.slice(0, 2).map((n) => ({ x1: d.x, y1: d.y, x2: n.x, y2: n.y + (idx % 2 === 0 ? 0 : 10) }))),
  ];

  return (
    <div className="layout" style={{ display: "block" }}>
      <div className="brief projection-hero">
        <div className="proj-hero-head">
          <div>
            <h3>Projection insights</h3>
            <div className="bl">These events include a projection view: what could change, how it could affect Abu Dhabi, and what a government team should do next.</div>
          </div>
          <div className="proj-kpi">
            <span className="proj-kpi-label">Projected lift</span>
            <span className="proj-kpi-value">{expectedReduction > 0 ? `↓ ${expectedReduction}` : "stable"}</span>
          </div>
        </div>

        <div className="proj-hero-grid">
          <div className="proj-hero-panel">
            <div className="proj-hero-label">Snapshot</div>
            <ProjectionBar label="Current impact" value={averageBefore} color="var(--accent)" />
            <ProjectionBar label="After action" value={averageAfter} color="var(--mint)" />
          </div>
          <div className="proj-hero-panel">
            <div className="proj-hero-label">Coverage</div>
            <div className="bchips">
              <span className="bchip"><b>{events.length}</b> projection-ready events</span>
              <span className="bchip"><b>Live</b> from the latest feed</span>
            </div>
          </div>
        </div>
      </div>

      <div className="insight-grid">
        <div className="card insight-card">
          <div className="insight-title">Risk level</div>
          <div className={`risk-score ${riskMeta.tone}`}>{riskScore}</div>
          <div className="risk-level">{riskMeta.label}</div>
          <div className="risk-copy">{riskMeta.copy}</div>
          <div className="bchips">
            <span className="bchip"><b>{events.filter((e) => (e.severity || 1) >= 4).length}</b> high-severity</span>
            <span className="bchip"><b>{urgencyCounts.act}</b> need action</span>
          </div>
        </div>

        <div className="card insight-card">
          <div className="insight-title">Economic impact</div>
          <div className="impact-row">
            <span className="impact-pill before">Before</span>
            <span className="impact-score">{averageBefore}/100</span>
          </div>
          <div className="impact-row">
            <span className="impact-pill after">After</span>
            <span className="impact-score">{averageAfter}/100</span>
          </div>
          <div className="impact-track">
            <div className="impact-track-fill before" style={{ height: `${Math.max(8, averageBefore)}%` }} />
            <div className="impact-track-fill after" style={{ height: `${Math.max(8, averageAfter)}%` }} />
          </div>
          <div className="projmeta">Projected reduction: <b>{expectedReduction > 0 ? `${expectedReduction} points` : "stable"}</b></div>
        </div>

        <div className="card insight-card insight-graph">
          <div className="insight-title">Network analysis</div>
          <svg className="network-svg" viewBox="0 0 240 140" role="img" aria-label="Network analysis graph">
            {networkLines.map((line, idx) => (
              <line key={`line-${idx}`} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke="var(--accent)" strokeOpacity="0.25" strokeWidth="2" />
            ))}
            {networkNodes.map((node) => (
              <g key={node.id}>
                <circle cx={node.x} cy={node.y} r={node.kind === "hub" ? 10 : 7} fill={node.kind === "hub" ? "var(--accent)" : "var(--panel2)"} stroke="var(--accent)" strokeWidth="2" />
                <text x={node.x} y={node.y + 24} textAnchor="middle" className="network-label">{node.id}</text>
              </g>
            ))}
          </svg>
          <div className="bchips">
            <span className="bchip"><b>{topDomains.length}</b> domains</span>
            <span className="bchip"><b>{topChannels.length}</b> channels</span>
          </div>
        </div>

        <div className="card insight-card">
          <div className="insight-title">Action readiness</div>
          <ProjectionBar label="Action plan" value={Math.round((planReady / Math.max(1, events.length)) * 100)} color="var(--accent)" />
          <ProjectionBar label="Official brief" value={Math.round((briefReady / Math.max(1, events.length)) * 100)} color="var(--mint)" />
          <ProjectionBar label="Sentiment" value={Math.round(Math.max(0, Math.min(100, (sentimentAvg + 1) * 50)))} color="var(--amber)" />
          <div className="projmeta">Signal tone: <b>{getSentimentLabel(sentimentAvg)}</b></div>
        </div>
      </div>

      <div className="card insight-card insight-wide">
        <div className="insight-title">Priority and domain spread</div>
        <div className="insight-bars">
          {(["act", "review", "watch"] as const).map((u) => (
            <div key={u} className="insight-bar-group">
              <div className="insight-bar-label">{u === "act" ? "Act now" : u === "review" ? "Worth a look" : "Keep watch"}</div>
              <div className="insight-bar-track"><i style={{ width: `${Math.max(8, Math.round((urgencyCounts[u] / Math.max(1, events.length)) * 100))}%` }} /></div>
              <span className="insight-bar-value">{urgencyCounts[u]}</span>
            </div>
          ))}
        </div>
        <div className="insight-bars">
          {topDomains.map(([domain, count]) => (
            <div key={domain} className="insight-bar-group">
              <div className="insight-bar-label">{DLABEL[domain] || domain}</div>
              <div className="insight-bar-track"><i style={{ width: `${Math.max(8, Math.round((count / Math.max(1, events.length)) * 100))}%` }} /></div>
              <span className="insight-bar-value">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="main" style={{ marginTop: 18 }}>
        {!events.length ? (
          <div className="empty">No projection-ready events yet. Refresh the feed to populate them.</div>
        ) : (
          <div className="projection-grid">
            {events.map((e) => {
              const before = e.economic_impact?.score ?? 0;
              const after = e.economic_impact_after?.score ?? 0;
              const change = Math.max(0, before - after);
              return (
                <div key={e.dedupe_key} className="card projection-card">
                  <div className="meta">
                    <span className="dchip">{DLABEL[e.domain] || "Other"}</span>
                    <span>·</span>
                    <span>{ago(e.ts)}</span>
                  </div>
                  <div className="title"><Link href={`/event/${encodeURIComponent(e.dedupe_key)}`}>{e.title}</Link></div>
                  <div className="sum">{e.ai_summary || e.impact_summary || "Projection insight is available for this event."}</div>

                  <div className="projection-visual">
                    <div className="projvisual-row">
                      <span>Current</span>
                      <div className="prog"><i style={{ width: `${before}%`, background: "var(--accent)" }} /></div>
                      <b>{before}/100</b>
                    </div>
                    <div className="projvisual-row after">
                      <span>After</span>
                      <div className="prog"><i style={{ width: `${after}%`, background: "var(--mint)" }} /></div>
                      <b>{after}/100</b>
                    </div>
                    <div className="projection-track">
                      <div className="projection-track-fill" style={{ width: `${Math.max(8, Math.min(100, change))}%` }} />
                    </div>
                    <div className="projmeta">Expected change: <b>{change > 0 ? `${change} points lower` : "stable"}</b></div>
                  </div>

                  <div className="bchips">
                    {e.economic_impact && <span className="bchip"><b>Impact</b> {e.economic_impact.level}</span>}
                    {e.action_plan && <span className="bchip"><b>Action</b> ready</span>}
                    {e.official_brief && <span className="bchip"><b>Brief</b> ready</span>}
                  </div>
                  <Link className="detailslink" href={`/event/${encodeURIComponent(e.dedupe_key)}`}>View full breakdown →</Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
