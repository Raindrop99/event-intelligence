// Shared display maps and small formatters (ported from the original dashboard).
import type { Urgency } from "./types";

export const SEV: Record<number, string> = {
  5: "var(--sev5)", 4: "var(--sev4)", 3: "var(--sev3)", 2: "var(--sev2)", 1: "var(--sev1)",
};
export const UC: Record<string, string> = {
  act: "var(--act)", review: "var(--review)", watch: "var(--watch)",
};
export const ULABEL: Record<string, string> = {
  act: "Act now", review: "Worth a look", watch: "Keep watch",
};
export const SEVWORD: Record<number, string> = {
  5: "Critical", 4: "Major", 3: "Notable", 2: "Minor", 1: "Info",
};
export const SEVDESC: Record<number, string> = {
  5: "Severity 5/5 — macro-scale: many sectors or countries affected",
  4: "Severity 4/5 — a whole sector or region affected",
  3: "Severity 3/5 — significant, with ripples beyond itself",
  2: "Severity 2/5 — real but local and limited",
  1: "Severity 1/5 — routine or informational",
};
export const CLABEL: Record<string, string> = {
  cost: "Costs & prices", demand: "Demand", rates: "Interest rates",
  confidence: "Market mood", currency_trade: "Currency & trade",
};
export const DLABEL: Record<string, string> = {
  market: "Market", policy: "Policy", disaster: "Disaster",
  health: "Health", supply_chain: "Supply chain", other: "Other",
};
export const DTITLE: Record<string, string> = {
  all: "All events", market: "Market", policy: "Policy", disaster: "Disaster",
  health: "Health", supply_chain: "Supply chain",
};
export const DDESC: Record<string, string> = {
  market: "Company earnings, prices, and market-structure moves.",
  policy: "Government schemes, regulation, budgets, tenders, and court rulings.",
  disaster: "Natural and physical events — floods, storms, quakes — and their aftermath.",
  health: "Outbreaks, drugs, and health-system developments.",
  supply_chain: "Inputs, chokepoints, shortages, and dependencies.",
};
export const URANK: Record<string, number> = { act: 0, review: 1, watch: 2 };

// fixed dot/donut colours per domain (work in light and dark)
export const DCOLOR: Record<string, string> = {
  market: "#5B8CFF", policy: "#9D86FF", disaster: "#F0564A",
  health: "#0E9F6E", supply_chain: "#F5A93D", other: "#8DA0C5",
};

export const DOMAINS = ["market", "policy", "disaster", "health", "supply_chain"];

export const sevWord = (s: number) => SEVWORD[s] || "Info";
export const sevColor = (s: number) => SEV[s] || SEV[1];
export const certWord = (c: number) => (c >= 0.7 ? "High" : c >= 0.45 ? "Medium" : "Low");

export const ago = (ts: number): string => {
  const m = Math.max(1, Math.round((Date.now() / 1000 - ts) / 60));
  if (m < 60) return m + "m ago";
  const h = Math.round(m / 60);
  return h < 24 ? h + "h ago" : Math.round(h / 24) + "d ago";
};

export const safeUrl = (u?: string | null): string =>
  typeof u === "string" && /^https?:\/\//i.test(u) ? u : "";

export const sortEvents = <T extends { severity: number; confidence: number; ts: number }>(
  arr: T[], by: "impact" | "new",
): T[] =>
  [...arr].sort((a, b) =>
    by === "impact"
      ? (b.severity || 1) * (b.confidence || 0) - (a.severity || 1) * (a.confidence || 0) ||
        b.ts - a.ts
      : b.ts - a.ts);

export type SortBy = "impact" | "new";
export type { Urgency };
