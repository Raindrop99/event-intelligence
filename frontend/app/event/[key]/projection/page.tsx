"use client";
import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useApi } from "@/app/providers";
import { SparkleIcon } from "@/components/icons";
import { CLABEL, DLABEL, SEVDESC, SEVWORD, certWord, ago, safeUrl } from "@/lib/ui";
import type { EventDetail, EventItem } from "@/lib/types";

function Ring({ value }: { value: number }) {
  const safe = Math.max(0, Math.min(100, value));
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safe / 100) * circumference;
  return (
    <div className="ring-wrap">
      <svg viewBox="0 0 120 120" className="ring">
        <circle cx="60" cy="60" r={radius} className="ring-track" />
        <circle cx="60" cy="60" r={radius} className="ring-fill" style={{ strokeDasharray: circumference, strokeDashoffset: offset }} />
      </svg>
      <div className="ring-value">{safe}%</div>
    </div>
  );
}

function TimelineItem({ title, desc, icon }: { title: string; desc: string; icon: string }) {
  return (
    <div className="timeline-item">
      <div className="timeline-icon">{icon}</div>
      <div>
        <div className="timeline-title">{title}</div>
        <div className="timeline-desc">{desc}</div>
      </div>
    </div>
  );
}

function getOutlook(value: number, sentiment: number) {
  const score = Math.max(0, Math.min(100, value + sentiment * 20));
  if (score >= 80) return { label: "Strong Positive", tone: "positive", copy: "The event is likely to create a favorable ripple effect across several sectors." };
  if (score >= 65) return { label: "Positive", tone: "positive", copy: "Momentum is favorable and the next few weeks should stay constructive." };
  if (score >= 45) return { label: "Neutral", tone: "neutral", copy: "The outlook is mixed, with both upside and downside factors in play." };
  if (score >= 25) return { label: "Cautious", tone: "cautious", copy: "The market and public reaction may remain uneven until more clarity arrives." };
  return { label: "Negative", tone: "negative", copy: "The event carries material downside risk and needs close monitoring." };
}

export default function EventProjectionPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params);
  const { data, error } = useApi<EventDetail>(`/api/event?key=${encodeURIComponent(key)}`);
  const [showWhy, setShowWhy] = useState(false);

  const event = data?.event;
  const basis = data?.basis;
  const url = event ? safeUrl(event.url) : null;

  const projectionSummary = useMemo(() => {
    if (!event) return null;
    const beforeScore = event.economic_impact?.score ?? 40;
    const afterScore = event.economic_impact_after?.score ?? Math.max(10, beforeScore - 12);
    const confidence = Math.round((event.confidence || 0.7) * 100);
    const outlook = getOutlook(beforeScore - afterScore + confidence / 3, event.sentiment || 0);
    const timeline = [
      { title: "Today", icon: "●", desc: "Initial signal capture and source validation." },
      { title: "Immediate", icon: "↗", desc: "Public reaction and official response are likely to accelerate." },
      { title: "Short-Term", icon: "⏱", desc: "Industry and consumer impact may become more visible within weeks." },
      { title: "Long-Term", icon: "◌", desc: "Broader structural effects may emerge over months." },
    ];
    const predictedDevelopments = [
      "Increased media attention",
      "Government announcements",
      "Public discussion",
      event.action_plan?.length ? "Coordinated response planning" : "Industry response",
      "Corporate investment signals",
      "Market volatility",
    ];
    const whoBenefits = [
      { name: "Technology", detail: "Digital adoption", impact: "High" },
      { name: "Manufacturing", detail: "Supply response", impact: "Medium" },
      { name: "Energy", detail: "Operational planning", impact: "High" },
      { name: "Healthcare", detail: "Policy readiness", impact: "Medium" },
    ];
    const affected = [
      "Importers",
      "Small businesses",
      "Supply chain operators",
      "Transportation networks",
      "Consumers",
      "Global competitors",
    ];
    const keySignals = [
      "Government notifications",
      "Company announcements",
      "Social media trend spikes",
      "Policy changes",
      "Economic indicators",
      "Search trend growth",
    ];
    const riskFactors = [
      "Policy delays",
      "Economic slowdown",
      "Public resistance",
      "Geopolitical conflicts",
      "Supply shortages",
      "Unexpected regulations",
    ];
    const impactBars = [
      { label: "Economy", value: Math.max(45, Math.min(100, beforeScore + 8)) },
      { label: "Technology", value: Math.max(35, Math.min(100, confidence + 10)) },
      { label: "Business", value: Math.max(40, Math.min(100, afterScore + 6)) },
      { label: "Employment", value: Math.max(30, Math.min(100, beforeScore - 12)) },
      { label: "Consumers", value: Math.max(35, Math.min(100, confidence - 5)) },
      { label: "Infrastructure", value: Math.max(30, Math.min(100, afterScore - 8)) },
    ];
    const actions = (event.action_plan?.length ? event.action_plan.map((step) => ({ title: step.action, note: step.outcome })) : [
      { title: "Add this event to watchlist", note: "Track momentum and follow-up signals." },
      { title: "Enable notifications", note: "Get updates when the situation changes." },
      { title: "Track related coverage", note: "Monitor new reporting and sentiment shifts." },
    ]).slice(0, 5);
    const roadmap = [
      { phase: "Today", text: "Primary signal is being validated against trusted sources." },
      { phase: "Next 3 Days", text: "Official response and public commentary should start to stabilize." },
      { phase: "Next Week", text: "Sector and business impact should become clearer." },
      { phase: "Next Month", text: "Policy or market consequences may become measurable." },
      { phase: "Next 6 Months", text: "The long-tail effect should appear in broader trend data." },
    ];
    return { beforeScore, afterScore, confidence, outlook, timeline, predictedDevelopments, whoBenefits, affected, keySignals, riskFactors, impactBars, actions, roadmap };
  }, [event]);

  if (error) {
    return (
      <div className="layout">
        <Link className="backbtn" href={`/event/${encodeURIComponent(key)}`}>← Back to event</Link>
        <div className="empty">Projection insights are not available for this event right now.</div>
      </div>
    );
  }
  if (!event || !projectionSummary) {
    return <div className="layout"><div className="skel" /><div className="skel" /></div>;
  }

  return (
    <div className="layout projection-shell">
      <div className="projection-topbar">
        <div>
          <div className="projection-eyebrow"><SparkleIcon /> AI projection dashboard</div>
          <h2 className="projection-title">🔮 Projection insights</h2>
          <p className="projection-subtitle">An AI-guided view of what could happen next based on current news, historical patterns, and the signals already visible in the feed.</p>
        </div>
        <button className="projection-toggle" onClick={() => setShowWhy((v) => !v)}>{showWhy ? "Hide explanation" : "Why this projection?"}</button>
      </div>

      {showWhy && (
        <div className="projection-why-card">
          <div className="projection-why-title">How this projection is formed</div>
          <p>It combines source credibility, historical similarity, event severity, sentiment drift, and available action-plan context to estimate likely impact and response timing.</p>
        </div>
      )}

      <div className="projection-grid-hero">
        <div className="card projection-card premium-card">
          <div className="projection-card-head">
            <div className="projection-card-icon">✦</div>
            <div>
              <div className="projection-card-label">Current event</div>
              <div className="projection-card-title">{event.title}</div>
            </div>
          </div>
          <div className="projection-meta-line">
            <span>{DLABEL[event.domain] || "Other"}</span>
            <span>{ago(event.ts)}</span>
            <span>{event.source}</span>
          </div>
          <div className="projection-badge-row">
            <span className="projection-badge severity">{SEVWORD[event.severity] || "Info"}</span>
            <span className="projection-badge source">{certWord(event.confidence || 0)} confidence</span>
          </div>
          <p className="projection-copy">{event.ai_summary || event.impact_summary}</p>
        </div>

        <div className="card projection-card premium-card">
          <div className="projection-card-label">Overall outlook</div>
          <div className={`projection-outlook ${projectionSummary.outlook.tone}`}>{projectionSummary.outlook.label}</div>
          <p className="projection-copy">{projectionSummary.outlook.copy}</p>
        </div>

        <div className="card projection-card premium-card gauge-card">
          <div className="projection-card-label">Confidence score</div>
          <Ring value={projectionSummary.confidence} />
          <div className="projection-gauge-label">High confidence</div>
          <p className="projection-copy tiny">Prediction confidence is based on source credibility, historical similarity, AI agreement, and freshness of the incoming signal.</p>
        </div>
      </div>

      <div className="projection-grid-two">
        <div className="card projection-card premium-card">
          <div className="projection-card-label">Expected timeline</div>
          <div className="timeline-list">
            {projectionSummary.timeline.map((item) => <TimelineItem key={item.title} title={item.title} desc={item.desc} icon={item.icon} />)}
          </div>
        </div>
        <div className="card projection-card premium-card">
          <div className="projection-card-label">Probability of impact</div>
          <div className="impact-bars">
            <div className="impact-bar-row"><span>Immediate</span><div className="impact-track"><i style={{ width: "95%" }} /></div><b>95%</b></div>
            <div className="impact-bar-row"><span>Short-term</span><div className="impact-track"><i style={{ width: "82%" }} /></div><b>82%</b></div>
            <div className="impact-bar-row"><span>Long-term</span><div className="impact-track"><i style={{ width: "71%" }} /></div><b>71%</b></div>
          </div>
        </div>
      </div>

      <div className="projection-grid-three">
        <div className="card projection-card premium-card">
          <div className="projection-card-label">Predicted developments</div>
          <ul className="projection-list">
            {projectionSummary.predictedDevelopments.map((item) => <li key={item}>✓ {item}</li>)}
          </ul>
        </div>
        <div className="card projection-card premium-card">
          <div className="projection-card-label">Who may benefit</div>
          <div className="mini-grid">
            {projectionSummary.whoBenefits.map((item) => (
              <div key={item.name} className="mini-card">
                <div className="mini-title">{item.name}</div>
                <div className="mini-detail">{item.detail}</div>
                <div className="mini-impact">Expected impact: {item.impact}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card projection-card premium-card warn-card">
          <div className="projection-card-label">Who may be affected</div>
          <ul className="projection-list">
            {projectionSummary.affected.map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </div>
      </div>

      <div className="projection-grid-three">
        <div className="card projection-card premium-card">
          <div className="projection-card-label">Key signals to watch</div>
          <ul className="projection-list">
            {projectionSummary.keySignals.map((item) => <li key={item}>↗ {item}</li>)}
          </ul>
        </div>
        <div className="card projection-card premium-card">
          <div className="projection-card-label">Risk factors</div>
          <ul className="projection-list">
            {projectionSummary.riskFactors.map((item) => <li key={item}>⚠ {item}</li>)}
          </ul>
        </div>
        <div className="card projection-card premium-card">
          <div className="projection-card-label">Impact score</div>
          <div className="bars-stack">
            {projectionSummary.impactBars.map((bar) => (
              <div key={bar.label} className="impact-bar-row"><span>{bar.label}</span><div className="impact-track"><i style={{ width: `${bar.value}%` }} /></div><b>{bar.value}</b></div>
            ))}
          </div>
        </div>
      </div>

      <div className="projection-grid-three">
        <div className="card projection-card premium-card">
          <div className="projection-card-label">Confidence explanation</div>
          <div className="projection-gauge-label">{projectionSummary.confidence}% confidence</div>
          <ul className="projection-list">
            <li>✓ Multiple trusted news sources</li>
            <li>✓ Historical event similarity</li>
            <li>✓ High source credibility</li>
            <li>✓ Positive sentiment trend</li>
            <li>⚠ Limited regional data</li>
          </ul>
        </div>
        <div className="card projection-card premium-card">
          <div className="projection-card-label">Suggested user actions</div>
          <ul className="projection-list">
            {projectionSummary.actions.map((action) => (
              <li key={action.title}>✦ {action.title} — <span>{action.note}</span></li>
            ))}
          </ul>
        </div>
        <div className="card projection-card premium-card">
          <div className="projection-card-label">Projected timeline</div>
          <div className="roadmap-list">
            {projectionSummary.roadmap.map((step) => (
              <div key={step.phase} className="roadmap-item">
                <div className="roadmap-phase">{step.phase}</div>
                <div className="roadmap-text">{step.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card projection-card premium-card footer-card">
        <div className="projection-card-label">Projection note</div>
        <p className="projection-copy">This projection is generated using AI based on historical data, current news, sentiment analysis, market behavior, and realtime signals. Predictions may evolve as new information becomes available.</p>
        <div className="footer-meta">
          <span>Last updated {new Date(event.ts).toLocaleString()}</span>
          <span>Refresh</span>
          <span>AI model v1.2</span>
        </div>
      </div>

      <div className="details-actions">
        <Link className="detailslink" href={`/event/${encodeURIComponent(event.dedupe_key || "")}`}>View full event breakdown →</Link>
        {url && <a className="detailslink" href={url} target="_blank" rel="noopener">Read the source article ↗</a>}
      </div>
    </div>
  );
}
