"use client";
import { use, type CSSProperties } from "react";
import Link from "next/link";
import { useApi } from "@/app/providers";
import { DLABEL, SEVDESC, SEVWORD, UC, ULABEL } from "@/lib/ui";
import type { ActionDetail, EventItem } from "@/lib/types";

function RelRow({ e }: { e: EventItem }) {
  return (
    <Link className="relrow" href={`/event/${encodeURIComponent(e.dedupe_key || "")}`}>
      <span className="sevpill" title={SEVDESC[e.severity] || SEVDESC[1]}>{SEVWORD[e.severity] || "Info"}</span>
      <span className="reltitle">{e.title}</span>
      <span className="reldom">{DLABEL[e.domain] || "Other"}</span>
    </Link>
  );
}

export default function ActionDetailPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params);
  const { data, error } = useApi<ActionDetail>(`/api/action?key=${encodeURIComponent(key)}`);

  if (error)
    return (
      <>
        <Link className="backbtn" href="/">← Back</Link>
        <div className="empty">This action is no longer in the recent window. <Link href="/" style={{ color: "var(--accent)" }}>Back to events</Link></div>
      </>
    );
  if (!data)
    return <><Link className="backbtn" href="/">← Back</Link><div className="skel" /><div className="skel" /></>;

  const evs = data.events || [];
  const uc = UC[data.urgency] || "var(--line)";

  return (
    <>
      <Link className="backbtn" href="/">← Back</Link>
      <div className="detail" style={{ "--uc": uc, borderLeft: `4px solid ${uc}` } as CSSProperties}>
        <div className="meta"><span className={`uchip ${data.urgency}`}>{ULABEL[data.urgency] || "Action"}</span></div>
        <h2 className="dtitle">{data.label}</h2>
        <div className="sum big2">{data.detail}</div>
        <div className="ilbl">{evs.length} event{evs.length !== 1 ? "s" : ""} point to this action — tap any for the full breakdown.</div>
      </div>
      <div className="detail">
        <div className="lbl" style={{ marginTop: 0 }}>Events behind this</div>
        <div className="rellist">
          {evs.length ? evs.map((e) => <RelRow key={e.dedupe_key} e={e} />) : <div className="ilbl">No events under this action right now.</div>}
        </div>
      </div>
    </>
  );
}
