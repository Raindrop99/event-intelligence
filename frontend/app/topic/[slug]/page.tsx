"use client";
import { use, useState, type CSSProperties } from "react";
import { useApi } from "@/app/providers";
import { SEV, SEVWORD, sortEvents, type SortBy } from "@/lib/ui";
import { TOPIC_MAP } from "@/lib/topics";
import type { EventItem } from "@/lib/types";
import EventCard from "@/components/EventCard";
import { TopicIcon } from "@/components/icons";

export default function TopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const topic = TOPIC_MAP[slug];
  const { data } = useApi<EventItem[]>(topic ? `/api/topic?slug=${encodeURIComponent(slug)}` : null);
  const [sortBy, setSortBy] = useState<SortBy>("impact");

  if (!topic)
    return <div className="empty">Unknown section. <a href="/" style={{ color: "var(--accent)" }}>Back to events</a></div>;

  const evs = data ?? [];
  const total = evs.length;
  const serious = evs.filter((e) => (e.severity || 1) >= 4).length;
  const mood = total ? evs.reduce((s, e) => s + (e.sentiment || 0), 0) / total : 0;
  const moodWord = mood < -0.15 ? "negative" : mood > 0.15 ? "positive" : "mixed";
  const sev: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  evs.forEach((e) => { if (sev[e.severity] !== undefined) sev[e.severity]++; });
  const sorted = sortEvents(evs, sortBy);

  return (
    <>
      <div className="dompage">
        <div className="domtitle"><TopicIcon name={topic.icon} /> {topic.label}</div>
        <div className="domdesc">{topic.desc}</div>
        <div className="domstats">
          <span className="bchip"><b>{total}</b> event{total !== 1 ? "s" : ""}</span>
          <span className={`bchip ${serious ? "urgent" : ""}`}><b>{serious}</b> serious</span>
          <span className="bchip"><b>{moodWord}</b> mood</span>
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
          <div className="empty">No {topic.label} events right now. Click <b>Refresh now</b> to fetch more.</div>
        )}
      </div>
    </>
  );
}
