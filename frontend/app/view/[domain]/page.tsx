"use client";
import { use, useState, type CSSProperties } from "react";
import { useApi } from "@/app/providers";
import { DDESC, DLABEL, SEV, SEVWORD, ULABEL, URANK, sortEvents, type SortBy } from "@/lib/ui";
import type { EventItem } from "@/lib/types";
import EventCard from "@/components/EventCard";
import { DomainIcon } from "@/components/icons";

const VALID = ["market", "policy", "disaster", "health", "supply_chain"];

export default function DomainPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = use(params);
  const valid = VALID.includes(domain);
  const { data } = useApi<EventItem[]>(valid ? `/api/events?domain=${encodeURIComponent(domain)}` : null);
  const [sortBy, setSortBy] = useState<SortBy>("impact");

  if (!valid)
    return <div className="empty">Unknown topic. <a href="/" style={{ color: "var(--accent)" }}>Back to events</a></div>;

  const evs = data ?? [];
  const total = evs.length;
  const serious = evs.filter((e) => (e.severity || 1) >= 4).length;
  const mood = total ? evs.reduce((s, e) => s + (e.sentiment || 0), 0) / total : 0;
  const moodWord = mood < -0.15 ? "negative" : mood > 0.15 ? "positive" : "mixed";
  const sev: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  evs.forEach((e) => { if (sev[e.severity] !== undefined) sev[e.severity]++; });
  const acts: Record<string, { label: string; urgency: string; count: number }> = {};
  evs.forEach((e) => {
    const a = e.action;
    if (a && a.urgency !== "none") {
      const g = acts[a.key] || (acts[a.key] = { label: a.label, urgency: a.urgency, count: 0 });
      g.count++;
    }
  });
  const top = Object.values(acts).sort((a, b) => URANK[a.urgency] - URANK[b.urgency] || b.count - a.count)[0];
  const sorted = sortEvents(evs, sortBy);

  return (
    <>
      <div className="dompage">
        <div className="domtitle"><DomainIcon d={domain} /> {DLABEL[domain] || "Topic"}</div>
        <div className="domdesc">{DDESC[domain] || ""}</div>
        <div className="domstats">
          <span className="bchip"><b>{total}</b> event{total !== 1 ? "s" : ""}</span>
          <span className={`bchip ${serious ? "urgent" : ""}`}><b>{serious}</b> serious</span>
          <span className="bchip"><b>{moodWord}</b> mood</span>
          {top && (
            <span className="bchip"><b>Top action:</b> {top.label}
              <span className={`uchip ${top.urgency}`} style={{ marginLeft: 6 }}>{ULABEL[top.urgency]}</span>
            </span>
          )}
        </div>
        <div className="domsevs">
          {[5, 4, 3, 2, 1].map((s) => (
            <div key={s} className="domsev">
              <div className="n" style={{ color: sev[s] ? SEV[s] : "var(--muted)" } as CSSProperties}>{sev[s]}</div>
              <div className="w">{SEVWORD[s]}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="feedbar" style={{ marginTop: 16 }}>
        <div className="seg">
          <button className={`segb ${sortBy === "impact" ? "on" : ""}`} onClick={() => setSortBy("impact")}>Important first</button>
          <button className={`segb ${sortBy === "new" ? "on" : ""}`} onClick={() => setSortBy("new")}>Newest first</button>
        </div>
      </div>
      <div className="domfeed">
        {!data ? (
          <><div className="skel" /><div className="skel" /><div className="skel" /></>
        ) : sorted.length ? (
          sorted.map((e) => <EventCard key={e.dedupe_key} e={e} />)
        ) : (
          <div className="empty">No events in this topic right now. Click <b>Refresh now</b> to fetch more.</div>
        )}
      </div>
    </>
  );
}
