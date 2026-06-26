// Shapes returned by the FastAPI backend.

export type Urgency = "act" | "review" | "watch" | "none";

export interface SentRow {
  key: string; title: string; domain: string; label: string;
  sentiment: number; severity: number;
}
export interface SentimentData {
  count: number; avg: number;
  positive: number; neutral: number; negative: number;
  by_domain: { key: string; label: string; avg: number; count: number }[];
  top_positive: SentRow[];
  top_negative: SentRow[];
}

export interface Stats {
  total: number;
  analyzed: number;
  high_severity: number;
  mode: string;       // "live" | "demo"
  analysis: string;   // e.g. "AI (Gemini)"
}

export interface Gauge {
  name: string;
  value: number;
  change_pct: number;
  updated?: number;
}

export interface EventAction {
  key: string;
  label: string;
  detail: string;
  urgency: Urgency;
}

export interface ActionStep {
  action: string;
  priority: "immediate" | "high" | "medium" | "low";
  outcome: string;
}

export type ImpactLevel = "low" | "medium" | "high";

export interface EconSector {
  sector: string;
  impact: ImpactLevel;
  probability: number;   // 0–100
  reason: string;
}

export interface EconomicImpact {
  score: number;         // 0–100
  level: ImpactLevel;
  sectors: EconSector[];
  summary: string;
}

export interface OfficialBrief {
  bottom_line: string;
  stakes: string;
  move: string;
  owner: string;
  timeframe: string;     // "now" | "this week" | "this month"
  payoff: string;
  risk_if_ignored: string;
  options: string[];
  talking_point: string;
}

export interface EventItem {
  dedupe_key: string;
  source: string;
  type?: string;
  title: string;
  url?: string | null;
  ts: number;
  domain: string;
  severity: number;
  sentiment: number;
  ai_summary?: string;
  why_it_matters?: string;
  government_impact?: string;
  impact_summary: string;
  channels: string[];
  winners: string[];
  winner_reasons?: string[];
  losers: string[];
  loser_reasons?: string[];
  second_order: string;
  urgency?: Urgency;
  action_label?: string;
  next_action?: string;
  action_plan?: ActionStep[];
  economic_impact?: EconomicImpact;
  economic_impact_after?: EconomicImpact;
  official_brief?: OfficialBrief;
  confidence: number;
  mode?: string;
  action?: EventAction;
}

export interface TodoItem {
  key: string;
  title: string;
  domain: string;
  urgency: Exclude<Urgency, "none">;
  step: string;
  severity: number;
  score: number;
}

export interface Todos {
  counts: { act: number; review: number; watch: number };
  items: TodoItem[];
}

export interface Overview {
  headline: string;
  lines: string[];
  counts: { total: number; serious: number; actions: number; urgent: number };
}

export interface Basis {
  mode: string;
  note: string;
  signals: string[];
  keywords: string[];
}

export interface EventDetail {
  event: EventItem;
  related: EventItem[];
  basis: Basis;
}

export interface ActionDetail {
  key: string;
  label: string;
  detail: string;
  urgency: Urgency;
  events: EventItem[];
}

export interface SearchResult {
  answer: string;
  events: EventItem[];
  mode?: "ai" | "keyword";
}

/* ---------- intelligence pages (trends / analytics / reports / recommend) ---------- */

export interface StatCardData {
  value: number;
  delta: number;
}

export interface Series {
  key: string;
  values: number[];
}

export interface TrendsData {
  cards: {
    emerging_topics: StatCardData;
    growth_rate: StatCardData;
    signal_quality: StatCardData;
    momentum: StatCardData;
  };
  stream: {
    labels: string[];
    series: Series[];
    peaks: { key: string; x: number; delta: number }[];
  };
  intel: { kind: "rising" | "emerging" | "declining"; key: string; note: string }[];
  areas: { key: string; pct: number; dir: "up" | "down" | "flat" }[];
  rising: { term: string; pct: number }[];
  declining: { term: string; pct: number }[];
  radar: { key: string; value: number }[];
  momentum: { labels: string[]; values: number[]; markers: { x: number; text: string }[] };
  recommendations: { title: string; note: string; level: string }[];
  range: string;
}

export interface AnalyticsData {
  cards: {
    total: StatCardData;
    events: StatCardData;
    insights: StatCardData;
    high: StatCardData;
    confidence: StatCardData;
  };
  labels: string[];
  series: Series[];
  distribution: { key: string; count: number; pct: number; delta: number }[];
  summary: {
    top_area: { key: string; pct: number } | null;
    top_insight: { key: string; title: string; domain: string; confidence: number } | null;
    gap: { key: string; count: number } | null;
  };
  coverage: number;
  range: string;
}

export interface ReportRow {
  key: string;
  title: string;
  subtitle: string;
  type: string;
  domain: string;
  source: string;
  ts: number;
  severity: number;
  urgency: string;
  confidence: number;
}

export interface ReportsData {
  cards: { total: number; high: number; act: number; avg_confidence: number; domains: number };
  rows: ReportRow[];
  by_type: { type: string; count: number }[];
}

export interface DashboardData {
  severity: { total: number; delta: number; bars: { label: string; count: number }[] };
  ingested: { total: number; delta: number; series: { d: string; v: number }[] };
  gauges: { label: string; value: string; delta: number; up: boolean }[];
  briefing: { headline: string; body: string; chips: string[] };
  topEvents: { title: string; domain: string; ago: string; sev: number; key: string }[];
  domains: { name: string; key: string; value: number }[];
  channels: { label: string; value: number }[];
}

export interface RecoSimilar {
  key: string;
  title: string;
  domain: string;
  severity: number;
  match: number;
}

export interface RecoData {
  question: string;
  empty: boolean;
  data?: { events: number; domains: number; sources: number; confidence: number };
  answer?: string;
  verdict?: string;
  chips?: string[];
  success?: number;
  ci?: [number, number];
  factors?: { label: string; pct: number }[];
  risks?: { label: string; level: string; observed: string; confidence: number }[];
  similar_pos?: RecoSimilar[];
  similar_neg?: RecoSimilar[];
  evidence?: string[];
  actions?: { title: string; note: string }[];
  focus?: { key: string; title: string; domain: string };
  counts?: { events: number; reports: number; high: number; sources: number };
}
