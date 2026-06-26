"use client";
import type { CSSProperties } from "react";
import { useApi } from "@/app/providers";
import { DLABEL, SEV, SEVWORD, UC, ULABEL } from "@/lib/ui";
import type { EventItem } from "@/lib/types";

function Bar({ label, n, m, color }: { label: string; n: number; m: number; color?: string }) {
  return (
    <div className="dbar">
      <span className="dn" style={color ? { color } : undefined}>{label}</span>
      <span className="dtrack"><i style={{ width: `${Math.round((n / m) * 100)}%`, ...(color ? { background: color } : {}) }} /></span>
      <span className="dc">{n}</span>
    </div>
  );
}

export default function InsightsPage() {
  const { data } = useApi<EventItem[]>("/api/events?limit=150");
  const evs = data ?? [];

  // activity — events per hour over the last 24h
  const now = Date.now() / 1000;
  const buckets = new Array(24).fill(0);
  let recent = 0;
  evs.forEach((e) => {
    const h = Math.floor((now - e.ts) / 3600);
    if (h >= 0 && h < 24) { buckets[23 - h]++; recent++; }
  });
  const max = Math.max(...buckets, 1);
  const pts = buckets.map((v, i) => `${(i * (560 / 23)).toFixed(1)},${(138 - (v / max) * 120).toFixed(1)}`);
  const sparkPath = `M${pts.join(" L")} L560,138 L0,138 Z`;

  // by topic / by source
  const dc: Record<string, number> = {}, srcs: Record<string, number> = {};
  evs.forEach((e) => {
    const d = e.domain || "other", s = e.source || "unknown";
    dc[d] = (dc[d] || 0) + 1; srcs[s] = (srcs[s] || 0) + 1;
  });
  const topics = Object.entries(dc).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const sources = Object.entries(srcs).sort((a, b) => b[1] - a[1]).slice(0, 6);

  // severity
  const sc: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  evs.forEach((e) => { if (sc[e.severity] !== undefined) sc[e.severity]++; });
  const smax = Math.max(...Object.values(sc), 1);

  // priority
  const pc: Record<string, number> = { act: 0, review: 0, watch: 0 };
  evs.forEach((e) => { const u = e.action?.urgency; if (u && pc[u] !== undefined) pc[u]++; });
  const pmax = Math.max(pc.act, pc.review, pc.watch, 1);

  // mood
  const avg = evs.length ? evs.reduce((s, e) => s + (e.sentiment || 0), 0) / evs.length : 0;
  const moodWord = avg < -0.25 ? "Negative" : avg < -0.08 ? "Slightly negative"
    : avg > 0.25 ? "Positive" : avg > 0.08 ? "Slightly positive" : "Neutral";

  // mood by topic
  const md: Record<string, number[]> = {};
  evs.forEach((e) => { const d = e.domain || "other"; (md[d] = md[d] || []).push(e.sentiment || 0); });
  const moodDom = Object.entries(md)
    .map(([d, arr]) => [d, arr.reduce((a, b) => a + b, 0) / arr.length] as [string, number])
    .sort((a, b) => a[1] - b[1]);

  return (
    <div className="igrid">
      <div className="ichart wide">
        <h4>Events · last 24 hours</h4>
        <div className="big">{recent}</div>
        <svg className="inspark" viewBox="0 0 560 145" preserveAspectRatio="none">
          <path d={sparkPath} fill="var(--accent)" opacity="0.12" />
          <polyline points={pts.join(" ")} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
        <div className="ilbl" style={{ display: "flex", justifyContent: "space-between" }}>
          <span>24h ago</span><span>12h ago</span><span>now</span>
        </div>
        <div className="ilbl">
          {recent ? `events collected in the last 24 hours · busiest hour: ${max}` : "Quiet — nothing collected in the last 24 hours"}
        </div>
      </div>

      <div className="ichart">
        <h4>By topic</h4>
        {topics.length ? topics.map(([k, n]) => <Bar key={k} label={DLABEL[k] || "Other"} n={n} m={topics[0][1]} />) : <div className="ilbl">No data yet</div>}
      </div>
      <div className="ichart">
        <h4>By source</h4>
        {sources.length ? sources.map(([k, n]) => <Bar key={k} label={k} n={n} m={sources[0][1]} />) : <div className="ilbl">No data yet</div>}
      </div>

      <div className="ichart">
        <h4>Severity</h4>
        <div className="scols">
          {[5, 4, 3, 2, 1].map((s) => (
            <div key={s} className="scol">
              <span className="sc-n">{sc[s]}</span>
              <span className="sc-bar" style={{ height: `${Math.max(3, Math.round((sc[s] / smax) * 100))}%`, background: SEV[s] }} />
              <span className="sc-w">{SEVWORD[s]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="ichart">
        <h4>Suggested priority</h4>
        {(["act", "review", "watch"] as const).map((u) => <Bar key={u} label={ULABEL[u]} n={pc[u]} m={pmax} color={UC[u]} />)}
        <div className="ilbl">Based on the action attached to each event.</div>
      </div>

      <div className="ichart">
        <h4>Overall mood</h4>
        <div className="moodtrack"><i style={{ left: `${50 + avg * 50}%` } as CSSProperties} /></div>
        <div className="ilbl">{`${moodWord} (${avg >= 0 ? "+" : ""}${avg.toFixed(2)}) — average tone across all events`}</div>
      </div>

      <div className="ichart">
        <h4>Mood by topic</h4>
        {moodDom.length ? moodDom.map(([d, m]) => {
          const w = Math.max(1, Math.min(50, Math.abs(m) * 50));
          const pos = m >= 0;
          return (
            <div key={d} className="dbar">
              <span className="dn">{DLABEL[d] || "Other"}</span>
              <span className="divg"><i style={{ left: `${pos ? 50 : 50 - w}%`, width: `${w}%`, background: pos ? "var(--mint)" : "var(--coral)" }} /></span>
              <span className="dc">{m >= 0 ? "+" : ""}{m.toFixed(2)}</span>
            </div>
          );
        }) : <div className="ilbl">No data yet</div>}
      </div>
    </div>
  );
}
