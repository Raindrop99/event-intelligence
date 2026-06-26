"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useApi } from "@/app/providers";
import type { RecoData } from "@/lib/types";
import { Donut, MiniBars } from "@/components/charts";
import { downloadJson, copyText } from "@/lib/download";
import { MiniIcon, TryIcon, ClockIcon } from "@/components/icons";

const RISK_BARS: Record<string, number[]> = {
  "High Risk": [5, 7, 6, 8, 9, 8, 9], "Medium Risk": [3, 5, 4, 6, 5, 6, 7], "Low Risk": [2, 3, 2, 4, 3, 4, 5],
};
const RISK_COLOR: Record<string, string> = { "High Risk": "#F0564A", "Medium Risk": "#F5A93D", "Low Risk": "#3DF0A8" };
const lvl = (s: string) => s.toLowerCase().split(" ")[0]; // "high" | "medium" | "low"

function Sim({ rows, kind, title }: { rows: NonNullable<RecoData["similar_pos"]>; kind: "pos" | "neg"; title: string }) {
  return (
    <div className="panelcard">
      <div className="pch"><h3>{title}</h3><Link className="viewall" href="/table">View all →</Link></div>
      {rows.length ? rows.map((r) => (
        <Link key={r.key} className={`simrow ${kind}`} href={`/event/${encodeURIComponent(r.key)}`}>
          <span className="sicon"><MiniIcon name={kind === "pos" ? "checkc" : "alert"} /></span>
          <span className="stitle">{r.title}</span>
          <span className="smatch">{r.match}%</span>
        </Link>
      )) : <div className="kwempty">No comparable events found.</div>}
    </div>
  );
}

export default function RecommendationsPage() {
  const [q, setQ] = useState("");
  const [input, setInput] = useState("");
  const [shared, setShared] = useState(false);
  const { data } = useApi<RecoData>(`/api/recommend?q=${encodeURIComponent(q)}`);

  const submit = (e: FormEvent) => { e.preventDefault(); setQ(input.trim()); };

  if (!data) return <><h1 className="bigtitle">Recommendations</h1><div className="skel" /><div className="skel" /></>;
  if (data.empty)
    return (
      <>
        <h1 className="bigtitle">Recommendations</h1>
        <div className="empty">No analysed events to base a recommendation on yet. Click <b>Refresh now</b> to fetch live data.</div>
      </>
    );

  const d = data.data!;
  const success = data.success ?? 0;
  const verdict = data.verdict || "Proceed";
  const verdictColor = verdict.includes("High") ? "var(--coral)" : verdict.includes("Caution") ? "var(--amber)" : "var(--mint)";
  const cnt = data.counts!;

  return (
    <>
      <div className="exphead">
        <div>
          <h1 className="bigtitle" style={{ display: "flex", alignItems: "center", gap: 9 }}>Recommendations <span className="beta">AI</span></h1>
          <div className="esub">AI-powered recommendations grounded in your live event database.</div>
        </div>
        <div className="exhbtns" style={{ marginLeft: "auto" }}>
          <button className="ebtn" onClick={async () => {
            const u = new URL(window.location.href);
            if (q) u.searchParams.set("q", q); else u.searchParams.delete("q");
            await copyText(u.toString());
            setShared(true); setTimeout(() => setShared(false), 1500);
          }}><MiniIcon name="share" /> {shared ? "Link copied" : "Share"}</button>
          <button className="ebtn" onClick={() => downloadJson("recommendation.json", data)}><MiniIcon name="download" /> Export</button>
          <button className="ebtn primary" onClick={() => { setInput(""); setQ(""); }}><MiniIcon name="plus" /> New analysis</button>
        </div>
      </div>

      <div className="qcard">
        <div className="qlabel">Research question</div>
        <div className="qtext">&ldquo;{data.question}&rdquo;</div>
        <div className="qmeta">
          <span className="qstat ok"><MiniIcon name="checkc" /> Analysis completed</span>
          <span className="qstat neutral"><ClockIcon /> Grounded in {d.events} events</span>
        </div>
      </div>

      <div className="recgrid">
        <div>
          <div className="ministats">
            <div className="ministat"><div className="mv">{d.events}</div><div className="ml">Events analysed</div></div>
            <div className="ministat"><div className="mv">{d.sources}</div><div className="ml">Distinct sources</div></div>
            <div className="ministat"><div className="mv">{d.domains}</div><div className="ml">Topic areas</div></div>
            <div className="ministat"><div className="mv">{d.confidence}%</div><div className="ml">Overall confidence</div><div className="mhint">High confidence</div></div>
          </div>

          <div className="col2" style={{ gridTemplateColumns: "1.3fr 1fr" }}>
            <div className="aicard">
              <span className="verdict" style={{ color: verdictColor, background: "transparent", border: `1px solid ${verdictColor}` }}>
                <MiniIcon name="alert" /> {verdict}
              </span>
              <p>{data.answer}</p>
              <div className="chips2">
                {(data.chips || []).map((ch, i) => <span key={i} className="chip2">{ch}</span>)}
              </div>
            </div>
            <div className="panelcard spbox">
              <div className="pch" style={{ width: "100%" }}><h3>Success signal</h3></div>
              <Donut segments={[{ color: "var(--accent)", value: success }, { color: "var(--line)", value: 100 - success }]} label={`${success}%`} size={132} />
              <div className="spci" style={{ marginTop: 8 }}>Interval {data.ci?.[0]}% – {data.ci?.[1]}%</div>
              <div className="spark12" style={{ width: "100%", marginTop: 12 }}>
                {Array.from({ length: 12 }, (_, i) => <i key={i} style={{ height: `${30 + i * 5}%`, background: "var(--accent)", opacity: 0.4 + i * 0.05 }} />)}
              </div>
            </div>
          </div>

          <div className="panelcard" style={{ marginTop: 16 }}>
            <div className="pch"><h3>Risk assessment</h3><Link className="viewall" href="/table">Full risk analysis →</Link></div>
            <div className="riskgrid">
              {(data.risks || []).map((r, i) => (
                <div key={i} className="riskcard">
                  <h5>{r.label}</h5>
                  <span className={`riskpill ${lvl(r.level)}`}>{r.level}</span>
                  <div className="rmeta">Observed: {r.observed}<br />Confidence: {r.confidence}%</div>
                  <MiniBars values={RISK_BARS[r.level] || RISK_BARS["Medium Risk"]} color={RISK_COLOR[r.level] || "#F5A93D"} />
                </div>
              ))}
            </div>
          </div>

          {!!(data.factors && data.factors.length) && (
            <div className="panelcard" style={{ marginTop: 16 }}>
              <div className="pch"><h3>Success factors</h3></div>
              {data.factors.map((f, i) => (
                <div key={i} className="hbar full">
                  <span className="hlabel">{f.label}</span>
                  <span className="htrack"><i style={{ width: `${f.pct}%` }} /></span>
                  <span className="hval">{f.pct}%</span>
                </div>
              ))}
            </div>
          )}

          <div className="simgrid">
            <Sim rows={data.similar_pos || []} kind="pos" title="Similar supporting events" />
            <Sim rows={data.similar_neg || []} kind="neg" title="Similar cautionary events" />
          </div>
        </div>

        <div className="rail">
          <div className="panelcard">
            <div className="pch"><h3>Why this recommendation?</h3></div>
            <p style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5, marginBottom: 4 }}>The agent read the live feed to find patterns, outcomes, and exposure.</p>
            <div className="whyrow2"><span className="wic"><TryIcon name="flask" /></span><span className="wt">Events analysed</span><b>{cnt.events}</b></div>
            <div className="whyrow2"><span className="wic"><TryIcon name="doc" /></span><span className="wt">With action plans</span><b>{cnt.reports}</b></div>
            <div className="whyrow2"><span className="wic"><MiniIcon name="alert" /></span><span className="wt">High severity</span><b>{cnt.high}</b></div>
            <div className="whyrow2"><span className="wic"><TryIcon name="bar" /></span><span className="wt">Distinct sources</span><b>{cnt.sources}</b></div>
          </div>

          <div className="panelcard">
            <div className="pch"><h3>Evidence &amp; sources used</h3><span className="beta">{success >= 70 ? "STRONG" : "MODERATE"}</span></div>
            <div className="evchips">
              {(data.evidence || []).map((e, i) => <span key={i} className="evchip">{e}</span>)}
            </div>
            {data.focus && (
              <Link className="exaction" href={`/event/${encodeURIComponent(data.focus.key)}`} style={{ marginTop: 10, display: "inline-block" }}>
                Open the focal event →
              </Link>
            )}
          </div>

          <div className="panelcard">
            <div className="pch"><h3>Recommended actions</h3></div>
            {(data.actions || []).length ? data.actions!.map((a, i) => (
              <div key={i} className="actrow">
                <span className="ac"><MiniIcon name="checkc" /></span>
                <div><div className="at">{a.title}</div><div className="an">{a.note}</div></div>
              </div>
            )) : <div className="kwempty">No specific actions for this one.</div>}
          </div>

        </div>
      </div>

      <form className="followbar" onSubmit={submit}>
        <TryIcon name="search" />
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a different question, e.g. 'how will oil supply affect airlines?'" />
        <button type="submit"><MiniIcon name="send" /> Analyse</button>
      </form>
    </>
  );
}
