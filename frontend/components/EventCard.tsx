"use client";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { EventItem, EventAction } from "@/lib/types";
import { CLABEL, DLABEL, SEV, SEVWORD, SEVDESC, ULABEL, certWord, ago, safeUrl } from "@/lib/ui";

export function ActionRow({ a }: { a?: EventAction }) {
  if (!a) return null;
  if (a.urgency === "none")
    return (
      <div className="actrow muted">
        <span className="uchip none">No action</span>
        <span className="atext">Informational — nothing to do here.</span>
      </div>
    );
  return (
    <>
      <div className="lbl">What you should do</div>
      <div className="actrow">
        <span className={`uchip ${a.urgency}`}>{ULABEL[a.urgency]}</span>
        <span className="atext"><b>{a.label}</b> — {a.detail}</span>
      </div>
    </>
  );
}

export default function EventCard({ e }: { e: EventItem }) {
  const url = safeUrl(e.url);
  const link = `/event/${encodeURIComponent(e.dedupe_key || "")}`;
  const conf = e.confidence || 0;
  const wins = e.winners || [];
  const lose = e.losers || [];

  return (
    <div className="card" style={{ "--sev": SEV[e.severity] || SEV[1] } as CSSProperties}>
      <div className="meta">
        <span className="dchip">{DLABEL[e.domain] || "Other"}</span>
        {url
          ? <a className="srclink" href={url} target="_blank" rel="noopener" title="Open the original article">{e.source} ↗</a>
          : <span>{e.source}</span>}
        <span>·</span><span>{ago(e.ts)}</span>
        <span className="sevpill" title={SEVDESC[e.severity] || SEVDESC[1]}>{SEVWORD[e.severity] || "Info"}</span>
        <span className="conf" title={`How sure the analysis is: ${Math.round(conf * 100)}%`}>
          <span>{certWord(conf)} certainty</span>
          <span className="confbar"><i style={{ width: `${Math.round(conf * 100)}%` }} /></span>
        </span>
      </div>
      <div className="title"><Link href={link}>{e.title}</Link></div>
      <div className="lbl">What it means</div>
      <div className="sum">{e.impact_summary}</div>
      {!!(e.channels && e.channels.length) && (
        <div className="chips">
          <span className="chlbl">Affects:</span>
          {e.channels.map((c, i) => <span key={i} className="ch">{CLABEL[c] || c}</span>)}
        </div>
      )}
      {!!(wins.length || lose.length) && (
        <>
          <div className="lbl">Who gains / who&apos;s at risk</div>
          <div className="ledger">
            {wins.map((w, i) => <span key={`w${i}`} className="win">▲ {w}</span>)}
            {lose.map((l, i) => <span key={`l${i}`} className="lose">▼ {l}</span>)}
          </div>
        </>
      )}
      {e.second_order && <div className="second"><b>Knock-on:</b> {e.second_order}</div>}
      <ActionRow a={e.action} />
      <Link className="detailslink" href={link}>View full breakdown →</Link>
    </div>
  );
}
