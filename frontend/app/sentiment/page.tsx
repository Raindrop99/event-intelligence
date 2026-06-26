"use client";
import Link from "next/link";
import { useApi } from "@/app/providers";
import type { SentimentData } from "@/lib/types";
import { SentimentIcon, MiniIcon } from "@/components/icons";

const toneWord = (v: number) => (v > 0.15 ? "Positive" : v < -0.15 ? "Negative" : "Neutral");
const toneColor = (v: number) => (v > 0.15 ? "var(--mint)" : v < -0.15 ? "var(--coral)" : "var(--amber)");

export default function SentimentPage() {
  const { data } = useApi<SentimentData>("/api/sentiment");

  if (!data)
    return <><h1 className="bigtitle">Sentiment scores</h1><div className="skel" /><div className="skel" /></>;
  if (!data.count)
    return (
      <>
        <h1 className="bigtitle">Sentiment scores</h1>
        <div className="empty">No analysed events yet. Click <b>Refresh now</b> to fetch live data.</div>
      </>
    );

  const pct = (x: number) => Math.round((x / data.count) * 100);

  return (
    <>
      <div className="exphead">
        <div>
          <h1 className="bigtitle" style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <SentimentIcon /> Sentiment scores
          </h1>
          <div className="esub">How positive or negative the live feed is for Abu Dhabi — overall and by area.</div>
        </div>
      </div>

      <div className="statgrid">
        <div className="statcard"><div className="sh">Overall tone</div>
          <div className="sv" style={{ color: toneColor(data.avg) }}>{toneWord(data.avg)}</div>
          <div className="sd">avg score {data.avg.toFixed(2)}</div></div>
        <div className="statcard"><div className="sh">Positive</div>
          <div className="sv" style={{ color: "var(--mint)" }}>{data.positive}</div>
          <div className="sd">{pct(data.positive)}% of events</div></div>
        <div className="statcard"><div className="sh">Neutral</div>
          <div className="sv" style={{ color: "var(--amber)" }}>{data.neutral}</div>
          <div className="sd">{pct(data.neutral)}% of events</div></div>
        <div className="statcard"><div className="sh">Negative</div>
          <div className="sv" style={{ color: "var(--coral)" }}>{data.negative}</div>
          <div className="sd">{pct(data.negative)}% of events</div></div>
      </div>

      <div className="recgrid">
        <div>
          <div className="panelcard">
            <div className="pch"><h3>Sentiment by topic area</h3></div>
            {data.by_domain.map((d) => (
              <div key={d.key} className="hbar">
                <span className="hlabel">{d.label}</span>
                <span className="htrack"><i style={{ width: `${Math.max(6, Math.round(Math.abs(d.avg) * 100))}%`, background: toneColor(d.avg) }} /></span>
                <span className="hval" style={{ color: toneColor(d.avg) }}>{d.avg.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="simgrid">
            <div className="panelcard">
              <div className="pch"><h3>Most positive</h3></div>
              {data.top_positive.length ? data.top_positive.map((r) => (
                <Link key={r.key} className="simrow pos" href={`/event/${encodeURIComponent(r.key)}`}>
                  <span className="sicon"><MiniIcon name="checkc" /></span>
                  <span className="stitle">{r.title}</span>
                  <span className="smatch" style={{ color: "var(--mint)" }}>+{r.sentiment.toFixed(2)}</span>
                </Link>
              )) : <div className="kwempty">No positive events.</div>}
            </div>
            <div className="panelcard">
              <div className="pch"><h3>Most negative</h3></div>
              {data.top_negative.length ? data.top_negative.map((r) => (
                <Link key={r.key} className="simrow neg" href={`/event/${encodeURIComponent(r.key)}`}>
                  <span className="sicon"><MiniIcon name="alert" /></span>
                  <span className="stitle">{r.title}</span>
                  <span className="smatch" style={{ color: "var(--coral)" }}>{r.sentiment.toFixed(2)}</span>
                </Link>
              )) : <div className="kwempty">No negative events.</div>}
            </div>
          </div>
        </div>

        <div className="rail">
          <div className="panelcard">
            <div className="pch"><h3>The split</h3></div>
            <div className="hbar full"><span className="hlabel">Positive</span><span className="htrack"><i style={{ width: `${pct(data.positive)}%`, background: "var(--mint)" }} /></span><span className="hval">{pct(data.positive)}%</span></div>
            <div className="hbar full"><span className="hlabel">Neutral</span><span className="htrack"><i style={{ width: `${pct(data.neutral)}%`, background: "var(--amber)" }} /></span><span className="hval">{pct(data.neutral)}%</span></div>
            <div className="hbar full"><span className="hlabel">Negative</span><span className="htrack"><i style={{ width: `${pct(data.negative)}%`, background: "var(--coral)" }} /></span><span className="hval">{pct(data.negative)}%</span></div>
            <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 8, lineHeight: 1.5 }}>
              Across {data.count} recent analysed events. Score runs from -1 (very negative) to +1 (very positive).
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
