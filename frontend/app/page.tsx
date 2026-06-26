"use client";
import { useState } from "react";
import { useApi, useFilter } from "./providers";
import { sortEvents, type SortBy } from "@/lib/ui";
import type { EventItem, Overview, Gauge } from "@/lib/types";
import EventCard from "@/components/EventCard";
import ActionCenter from "@/components/ActionCenter";

function Brief() {
  const { data: o } = useApi<Overview>("/api/overview");
  if (!o) return <div className="brief"><div className="bl">Putting the situation brief together…</div></div>;
  return (
    <div className="brief">
      <h3>{o.headline}</h3>
      {o.lines.map((l, i) => <div key={i} className="bl">{l}</div>)}
      <div className="bchips">
        <span className="bchip"><b>{o.counts.total}</b> events</span>
        <span className="bchip"><b>{o.counts.serious}</b> serious</span>
        <span className="bchip"><b>{o.counts.actions}</b> suggested actions</span>
        {!!o.counts.urgent && <span className="bchip urgent"><b>{o.counts.urgent}</b> need action</span>}
      </div>
    </div>
  );
}

function Gauges() {
  const { data } = useApi<Gauge[]>("/api/gauges");
  const gs = data ?? [];
  if (!gs.length)
    return <div className="gauges"><div className="g"><div className="gn">Gauges</div><div className="gc">No data yet — Refresh now</div></div></div>;
  return (
    <div className="gauges">
      {gs.map((g, i) => {
        const up = g.change_pct >= 0;
        return (
          <div key={i} className="g">
            <div className="gn">{g.name}</div>
            <div className="gv">{g.value?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
            <div className={`gc ${up ? "up" : "down"}`}>{up ? "▲" : "▼"} {Math.abs(g.change_pct).toFixed(2)}%</div>
          </div>
        );
      })}
    </div>
  );
}

export default function Home() {
  const { urgency } = useFilter();
  const { data, error } = useApi<EventItem[]>("/api/events");
  const [sortBy, setSortBy] = useState<SortBy>("new");
  const [showLegend, setShowLegend] = useState(false);

  const events = data ?? [];
  const filtered = sortEvents(
    events.filter((e) => urgency === "all" || (e.action && e.action.urgency === urgency)),
    sortBy,
  );

  return (
    <>
      <Brief />
      <Gauges />
      <div className="layout">
        <div className="main">
          <div className="feedbar">
            <div className="seg">
              <button className={`segb ${sortBy === "impact" ? "on" : ""}`} onClick={() => setSortBy("impact")}>Important first</button>
              <button className={`segb ${sortBy === "new" ? "on" : ""}`} onClick={() => setSortBy("new")}>Newest first</button>
            </div>
            <button className="helpb" onClick={() => setShowLegend((s) => !s)}>? How to read this</button>
          </div>
          {showLegend && (
            <div className="legend">
              <b>Severity</b> — how big the event is: <b>Critical</b> (macro-scale) · <b>Major</b> (a whole sector or region) · <b>Notable</b> (clear ripples) · <b>Minor</b> (local) · <b>Info</b> (routine).<br />
              <b>Certainty</b> — how confident the analysis is in its own reading: High / Medium / Low.<br />
              <b>Priority</b> — <span className="uchip act">Act now</span> serious and confident · <span className="uchip review">Worth a look</span> significant · <span className="uchip watch">Keep watch</span> minor but real.<br />
              <b>▲ / ▼</b> — groups likely to gain / likely to lose from the event.<br />
              Everything here is decision support, not advice — the engine explains, you decide.
            </div>
          )}
          <div>
            {!data && !error ? (
              <><div className="skel" /><div className="skel" /><div className="skel" /></>
            ) : error ? (
              <div className="empty">Could not load events — is the API running at the configured address?</div>
            ) : filtered.length ? (
              filtered.map((e) => <EventCard key={e.dedupe_key} e={e} />)
            ) : (
              <div className="empty">No events in this view. Try another filter, or click <b>Refresh now</b>.</div>
            )}
          </div>
        </div>
        <div className="aside"><ActionCenter /></div>
      </div>
      <div className="foot">This engine detects, verifies, and explains — it does not predict the future, allege wrongdoing, or direct response.</div>
    </>
  );
}
