"use client";
import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/app/providers";
import { DCOLOR, DLABEL } from "@/lib/ui";
import type { TrendsData } from "@/lib/types";
import { AreaChart, Radar, LineChart, MiniBars } from "@/components/charts";
import { MiniIcon, TryIcon, TrendsIcon } from "@/components/icons";

const PERIODS = ["Daily", "Weekly", "Monthly", "Quarterly"];
const KIND_LABEL: Record<string, string> = { rising: "Rising opportunity", emerging: "Emerging opportunity", declining: "Declining attention" };

function Stat({ label, value, delta, color, icon }:
  { label: string; value: string; delta: number; color: string; icon: string }) {
  const up = delta >= 0;
  return (
    <div className="statcard">
      <div className="sh">{label}<span className="si" style={{ background: color + "22", color }}><TryIcon name={icon} /></span></div>
      <div className="sv">{value}</div>
      <div className="sd">
        <span className={`dpill ${up ? "up" : "down"}`}>{up ? "▲" : "▼"} {Math.abs(delta)}%</span>
        <span className="sub">vs previous period</span>
      </div>
    </div>
  );
}

export default function TrendsPage() {
  const { data } = useApi<TrendsData>("/api/trends");
  const [period, setPeriod] = useState("Weekly");
  const [mode, setMode] = useState("Absolute Trend");

  if (!data) return <><h1 className="bigtitle">Trends</h1><div className="skel" /><div className="skel" /></>;
  const c = data.cards;
  const seriesByKey: Record<string, number[]> = Object.fromEntries(data.stream.series.map((s) => [s.key, s.values]));
  const streamSeries = data.stream.series.map((s) => ({ key: s.key, color: DCOLOR[s.key] || DCOLOR.other, values: s.values, label: DLABEL[s.key] }));
  const maxArea = Math.max(...data.areas.map((a) => a.pct), 1);

  return (
    <>
      <div className="exphead">
        <div>
          <h1 className="bigtitle" style={{ display: "flex", alignItems: "center", gap: 9 }}>Trends <TrendsIcon /></h1>
          <div className="esub">Discover emerging patterns, forecast opportunities, and stay ahead of what&apos;s next.</div>
        </div>
        <div className="headtools" style={{ marginLeft: "auto" }}>
          <div className="segctl">
            {PERIODS.map((p) => <button key={p} className={`segbtn ${period === p ? "on" : ""}`} onClick={() => setPeriod(p)}>{p}</button>)}
          </div>
          <div className="segctl">
            {["Absolute Trend", "Relative Growth"].map((m) => <button key={m} className={`segbtn alt ${mode === m ? "on" : ""}`} onClick={() => setMode(m)}>{m}</button>)}
          </div>
          <button className="pickbtn"><MiniIcon name="filter" /> Filter topics</button>
          <button className="pickbtn"><MiniIcon name="chart" /> {data.range}</button>
        </div>
      </div>

      <div className="statgrid g4">
        <Stat label="Emerging topics" value={String(c.emerging_topics.value)} delta={c.emerging_topics.delta} color="#9D86FF" icon="bulb" />
        <Stat label="Growth rate" value={`${c.growth_rate.value}%`} delta={c.growth_rate.delta} color="#5B8CFF" icon="bar" />
        <Stat label="Signal quality" value={`${c.signal_quality.value}%`} delta={c.signal_quality.delta} color="#0E9F6E" icon="target" />
        <Stat label="Momentum score" value={`${c.momentum.value}/100`} delta={c.momentum.delta} color="#F5A93D" icon="bar" />
      </div>

      <div className="recgrid">
        <div className="panelcard">
          <div className="pch">
            <h3>Emerging research topics</h3>
            <Link className="viewall" href="/table">Explore all topics →</Link>
          </div>
          <div className="streambox">
            <div className="peaks">
              {data.stream.peaks.map((p, i) => (
                <div key={i} className="peak">
                  <div className="pdot" style={{ background: DCOLOR[p.key] || DCOLOR.other }}><MiniIcon name="chart" /></div>
                  <div className="ptitle">{DLABEL[p.key]}</div>
                  <div className="pdelta" style={{ color: p.delta >= 0 ? "var(--mint)" : "var(--coral)" }}>{p.delta >= 0 ? "▲" : "▼"} {Math.abs(p.delta)}%</div>
                </div>
              ))}
            </div>
            <AreaChart series={streamSeries} labels={data.stream.labels} height={230} stacked fillOpacity={0.42} />
          </div>
          <div className="legend" style={{ marginTop: 12 }}>
            {streamSeries.map((s) => <span key={s.key} className="legitem"><span className="legdot" style={{ background: s.color }} />{s.label}</span>)}
          </div>
        </div>

        <div className="rail">
          <div className="panelcard">
            <div className="pch"><h3>AI Trend Intelligence <TryIcon name="bulb" /></h3></div>
            {data.intel.map((it, i) => (
              <div key={i} className={`intelcard ${it.kind}`}>
                <div className="ictext">
                  <div className="ick">{KIND_LABEL[it.kind]}</div>
                  <h5>{DLABEL[it.key]}</h5>
                  <p>{it.note}</p>
                </div>
                <div className="icspark"><MiniBars values={seriesByKey[it.key] || [1, 2, 3]} color={DCOLOR[it.key] || DCOLOR.other} /></div>
              </div>
            ))}
          </div>

          <div className="panelcard">
            <div className="pch"><h3>Opportunity radar</h3></div>
            <Radar axes={data.radar.map((r) => ({ label: DLABEL[r.key], value: r.value }))} size={240} />
            <div className="legend" style={{ justifyContent: "center" }}>
              {data.radar.slice(0, 3).map((r) => <span key={r.key} className="legitem"><span className="legdot" style={{ background: DCOLOR[r.key] || DCOLOR.other }} />{DLABEL[r.key]} {r.value}</span>)}
            </div>
          </div>
        </div>
      </div>

      <div className="col3">
        <div className="panelcard">
          <div className="pch"><h3>Trending topic areas</h3><Link className="viewall" href="/table">View all →</Link></div>
          {data.areas.map((a) => (
            <div key={a.key} className="hbar">
              <span className="hlabel">{DLABEL[a.key]}</span>
              <span className="htrack"><i style={{ width: `${(a.pct / maxArea) * 100}%`, background: DCOLOR[a.key] || DCOLOR.other }} /></span>
              <span className="hval">{a.pct}%</span>
              <span className="hdir" style={{ color: a.dir === "up" ? "var(--mint)" : a.dir === "down" ? "var(--coral)" : "var(--muted)" }}>{a.dir === "up" ? "↗" : a.dir === "down" ? "↘" : "→"}</span>
            </div>
          ))}
        </div>

        <div className="panelcard">
          <div className="pch"><h3>Rising keywords</h3></div>
          {data.rising.length ? data.rising.map((k, i) => (
            <div key={i} className="kwrow"><span className="kwn">{i + 1}</span><span className="kwt">{k.term}</span><span className="kwd up">▲ {Math.abs(k.pct)}%</span></div>
          )) : <div className="kwempty">No rising keywords in this window.</div>}
        </div>

        <div className="panelcard">
          <div className="pch"><h3>Declining topics</h3></div>
          {data.declining.length ? data.declining.map((k, i) => (
            <div key={i} className="kwrow"><span className="kwn">{i + 1}</span><span className="kwt">{k.term}</span><span className="kwd down">▼ {Math.abs(k.pct)}%</span></div>
          )) : <div className="kwempty">Nothing is losing attention right now.</div>}
        </div>
      </div>

      <div className="panelcard" style={{ marginTop: 16 }}>
        <div className="pch"><h3>Research momentum timeline</h3></div>
        <LineChart values={data.momentum.values} labels={data.momentum.labels} markers={data.momentum.markers} color="#9D86FF" height={210} />
      </div>

      {!!data.recommendations.length && (
        <>
          <div className="pch" style={{ marginTop: 20 }}><h3>AI Trend recommendations</h3></div>
          <div className="col3" style={{ marginTop: 8 }}>
            {data.recommendations.map((r, i) => (
              <div key={i} className="reccard">
                <span className="ricon"><MiniIcon name={["target", "rocket", "shield"][i] || "bulb"} /></span>
                <h5>{r.title}</h5>
                <p>{r.note}</p>
                <span className={`levelpill ${r.level.toLowerCase()}`}>{r.level}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
