"use client";
import { use } from "react";
import Link from "next/link";
import { useApi } from "@/app/providers";
import { ActionRow } from "@/components/EventCard";
import { SparkleIcon } from "@/components/icons";
import { CLABEL, DLABEL, SEVDESC, SEVWORD, certWord, ago, safeUrl } from "@/lib/ui";
import type { EventDetail, EventItem, EconomicImpact, EconSector } from "@/lib/types";

function EventMeta({ e }: { e: EventItem }) {
  const conf = e.confidence || 0;
  const url = safeUrl(e.url);
  return (
    <div className="meta">
      <span className="dchip">{DLABEL[e.domain] || "Other"}</span>
      {url
        ? <a className="srclink" href={url} target="_blank" rel="noopener">{e.source} ↗</a>
        : <span>{e.source}</span>}
      <span>·</span><span>{ago(e.ts)}</span>
      <span className="sevpill" title={SEVDESC[e.severity] || SEVDESC[1]}>{SEVWORD[e.severity] || "Info"}</span>
      <span className="conf">
        <span>{certWord(conf)} certainty</span>
        <span className="confbar"><i style={{ width: `${Math.round(conf * 100)}%` }} /></span>
      </span>
    </div>
  );
}

function WhyList({ names, reasons, kind }: { names?: string[]; reasons?: string[]; kind: "win" | "lose" }) {
  if (!names || !names.length) return null;
  const arrow = kind === "win" ? "▲" : "▼";
  return (
    <div className="whylist">
      {names.map((n, i) => (
        <div key={i} className="whyrow">
          <span className={kind}>{arrow} {n}</span>
          {reasons && reasons[i] ? <span className="whytext">{reasons[i]}</span> : null}
        </div>
      ))}
    </div>
  );
}

function EconScore({ x, label }: { x: EconomicImpact; label: string }) {
  return (
    <>
      <div className="econscore-l">{label}</div>
      <div className={`econscore ${x.level}`}>{x.score}</div>
      <div className="econlevel">Impact level: <b className={`imp ${x.level}`}>{x.level.toUpperCase()}</b></div>
    </>
  );
}

function EconTable({ rows }: { rows: EconSector[] }) {
  return (
    <div className="econtable">
      <div className="ecrow head"><span>Sector</span><span>Impact</span><span>Probability</span><span>Reason</span></div>
      {rows.map((s, i) => (
        <div key={i} className="ecrow">
          <span className="ecs">{s.sector}</span>
          <span><span className={`imp ${s.impact}`}>{s.impact}</span></span>
          <span className="ecp">{s.probability}%</span>
          <span className="ecr">{s.reason}</span>
        </div>
      ))}
    </div>
  );
}

const econOK = (x?: EconomicImpact) => !!x && ((x.score ?? 0) > 0 || (x.sectors?.length ?? 0) > 0);
const IMP_RANK: Record<string, number> = { low: 0, medium: 1, high: 2 };

function RelRow({ e }: { e: EventItem }) {
  return (
    <Link className="relrow" href={`/event/${encodeURIComponent(e.dedupe_key || "")}`}>
      <span className="sevpill" title={SEVDESC[e.severity] || SEVDESC[1]}>{SEVWORD[e.severity] || "Info"}</span>
      <span className="reltitle">{e.title}</span>
      <span className="reldom">{DLABEL[e.domain] || "Other"}</span>
    </Link>
  );
}

export default function EventDetailPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params);
  const { data, error } = useApi<EventDetail>(`/api/event?key=${encodeURIComponent(key)}`);

  if (error)
    return (
      <>
        <Link className="backbtn" href="/">← Back</Link>
        <div className="empty">This event is no longer in the recent window. <Link href="/" style={{ color: "var(--accent)" }}>Back to events</Link></div>
      </>
    );
  if (!data)
    return <><Link className="backbtn" href="/">← Back</Link><div className="skel" /><div className="skel" /></>;

  const e = data.event;
  const url = safeUrl(e.url);
  const b = data.basis;
  const related = data.related || [];

  // economic impact: before (exposure now) and after (once the action plan runs)
  const eiBefore = e.economic_impact;
  const eiAfter = e.economic_impact_after;
  const showBefore = econOK(eiBefore);
  // the points the score drops (never negative — the backend guarantees after <= before)
  const drop = eiBefore && eiAfter ? Math.max(0, eiBefore.score - eiAfter.score) : 0;
  // a sector genuinely improves if its impact band or probability is cut (align by
  // name, mirroring the backend) — reason-only rewording does NOT count as a change.
  const sectorImproved = !!eiBefore && !!eiAfter && eiAfter.sectors.some((s) => {
    const b = eiBefore.sectors.find((x) => x.sector.toLowerCase() === s.sector.toLowerCase());
    return !!b && ((IMP_RANK[s.impact] ?? 1) < (IMP_RANK[b.impact] ?? 1) || s.probability < b.probability);
  });
  const showAfter = econOK(eiAfter) && (drop > 0 || sectorImproved);

  // the flagship Official Action Brief — shown first so an official can act now
  const ob = e.official_brief;
  const showBrief = !!ob && !!(ob.bottom_line || ob.move);
  const tfClass = ob?.timeframe === "now" ? "now" : ob?.timeframe === "this week" ? "soon" : "later";

  return (
    <>
      <Link className="backbtn" href="/">← Back</Link>
      <div className="detail">
        <EventMeta e={e} />
        <h2 className="dtitle">{e.title}</h2>
        {url && <a className="srcbtn" href={url} target="_blank" rel="noopener">Read the original article ↗</a>}

        {showBrief && (
          <div className="obrief">
            <div className="obrief-tag"><SparkleIcon /> OFFICIAL ACTION BRIEF</div>
            {ob!.bottom_line && <div className="obrief-bl">{ob!.bottom_line}</div>}
            {ob!.move && (
              <div className="obrief-move">
                <span className="obrief-move-l">The move</span>
                <span>{ob!.move}</span>
              </div>
            )}
            <div className="obrief-meta">
              {ob!.owner && <span className="obrief-pill owner">Lead: {ob!.owner}</span>}
              {ob!.timeframe && <span className={`obrief-pill tf ${tfClass}`}>Act {ob!.timeframe}</span>}
            </div>
            <div className="obrief-grid">
              {ob!.stakes && <div className="obrief-cell"><span className="obrief-cl">At stake</span><p>{ob!.stakes}</p></div>}
              {ob!.payoff && <div className="obrief-cell good"><span className="obrief-cl">Payoff</span><p>{ob!.payoff}</p></div>}
              {ob!.risk_if_ignored && <div className="obrief-cell bad"><span className="obrief-cl">If ignored</span><p>{ob!.risk_if_ignored}</p></div>}
            </div>
            {!!ob!.options?.length && (
              <>
                <span className="obrief-cl">Policy options</span>
                <div className="chips" style={{ marginTop: 6 }}>{ob!.options.map((o, i) => <span key={i} className="chip">{o}</span>)}</div>
              </>
            )}
            {ob!.talking_point && <div className="obrief-tp">&ldquo;{ob!.talking_point}&rdquo;</div>}
          </div>
        )}

        {e.ai_summary && (
          <div className="aisum">
            <div className="aisum-h"><SparkleIcon /> AI summary</div>
            <p>{e.ai_summary}</p>
          </div>
        )}
        {e.why_it_matters && (
          <div className="whymatters">
            <span className="wm-i">💡</span>
            <div><div className="wm-h">Why it matters to you</div><p>{e.why_it_matters}</p></div>
          </div>
        )}
        <div className="lbl">What it means</div>
        <div className="sum big2">{e.impact_summary}</div>
        {!!(e.channels && e.channels.length) && (
          <>
            <div className="lbl">What it affects</div>
            <div className="chips">{e.channels.map((c, i) => <span key={i} className="ch">{CLABEL[c] || c}</span>)}</div>
          </>
        )}
        {!!(e.winners && e.winners.length) && (
          <><div className="lbl">Why it&apos;s good for some</div><WhyList names={e.winners} reasons={e.winner_reasons} kind="win" /></>
        )}
        {!!(e.losers && e.losers.length) && (
          <><div className="lbl">Why it&apos;s bad for others</div><WhyList names={e.losers} reasons={e.loser_reasons} kind="lose" /></>
        )}
        {e.second_order && (
          <><div className="lbl">Knock-on effect</div><div className="second2">{e.second_order}</div></>
        )}
        <ActionRow a={e.action} />
        {!!(e.action_plan && e.action_plan.length) && (
          <>
            <div className="lbl">Action plan to reduce the impact</div>
            <div className="aptable">
              <div className="aprow head"><span>Action</span><span>Priority</span><span>Expected outcome</span></div>
              {e.action_plan!.map((s, i) => (
                <div key={i} className="aprow">
                  <span className="apa">{s.action}</span>
                  <span><span className={`prio ${s.priority}`}>{s.priority}</span></span>
                  <span className="apo">{s.outcome}</span>
                </div>
              ))}
            </div>
          </>
        )}
        {showBefore && (
          <>
            <div className="lbl">💰 Economic impact assessment</div>
            {showAfter ? (
              <div className="econcompare">
                <div className="econcard"><div className="ectag">Before action</div><EconScore x={eiBefore!} label="Economic impact score" /></div>
                <div className="econarrow">
                  <span>▶</span>
                  <div className="redbadge">{drop > 0 ? `▼ ${drop} pts` : "▼ lower risk"}</div>
                </div>
                <div className="econcard after"><div className="ectag good">After the action plan</div><EconScore x={eiAfter!} label="Projected score" /></div>
              </div>
            ) : (
              <div className="econbox"><EconScore x={eiBefore!} label="Economic impact score" /></div>
            )}

            {!!eiBefore!.sectors?.length && (
              <>
                <div className="lbl2">Before acting — exposure now</div>
                <EconTable rows={eiBefore!.sectors} />
              </>
            )}
            {eiBefore!.summary && <div className="econsummary">{eiBefore!.summary}</div>}

            {showAfter && (
              <>
                <div className="lbl2 good">After following the action plan — projected</div>
                {!!eiAfter!.sectors?.length && <EconTable rows={eiAfter!.sectors} />}
                {eiAfter!.summary && <div className="econsummary after">{eiAfter!.summary}</div>}
              </>
            )}
          </>
        )}
        {b && (
          <>
            <div className="lbl">How this was worked out</div>
            <div className="basisnote">{b.note}</div>
            {!!(b.signals && b.signals.length) && (
              <div className="chips" style={{ marginTop: 9 }}>{b.signals.map((s, i) => <span key={i} className="ch">{s}</span>)}</div>
            )}
            {!!(b.keywords && b.keywords.length) && <div className="ilbl">Matched words: {b.keywords.join(", ")}</div>}
          </>
        )}
      </div>
      <div className="detail">
        <div className="lbl" style={{ marginTop: 0 }}>Related {(DLABEL[e.domain] || "other").toLowerCase()} events</div>
        <div className="rellist">
          {related.length ? related.map((r) => <RelRow key={r.dedupe_key} e={r} />) : <div className="ilbl">No related events found.</div>}
        </div>
      </div>
    </>
  );
}
