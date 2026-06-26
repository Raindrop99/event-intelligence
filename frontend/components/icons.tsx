import type { ReactElement } from "react";

const sw = {
  fill: "none", stroke: "currentColor", strokeWidth: 2,
  strokeLinecap: "round", strokeLinejoin: "round",
} as const;

export function BrandLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

const ICONS: Record<string, ReactElement> = {
  all: (
    <svg viewBox="0 0 24 24" {...sw}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  market: (
    <svg viewBox="0 0 24 24" {...sw}>
      <polyline points="3 17 9 11 13 15 21 7" /><polyline points="15 7 21 7 21 13" />
    </svg>
  ),
  policy: (
    <svg viewBox="0 0 24 24" {...sw}>
      <path d="M3 10l9-6 9 6" /><line x1="5" y1="10" x2="5" y2="20" /><line x1="9.5" y1="10" x2="9.5" y2="20" />
      <line x1="14.5" y1="10" x2="14.5" y2="20" /><line x1="19" y1="10" x2="19" y2="20" /><line x1="3" y1="21" x2="21" y2="21" />
    </svg>
  ),
  disaster: (
    <svg viewBox="0 0 24 24" {...sw}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  health: (
    <svg viewBox="0 0 24 24" {...sw}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  supply_chain: (
    <svg viewBox="0 0 24 24" {...sw}>
      <rect x="1" y="4" width="14" height="12" rx="1" /><path d="M15 9h4l4 4v3h-8V9z" transform="translate(-1 0)" />
      <circle cx="5.5" cy="18.5" r="2" /><circle cx="17.5" cy="18.5" r="2" />
    </svg>
  ),
  defence: (
    <svg viewBox="0 0 24 24" {...sw}>
      <path d="M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z" />
      <polyline points="9 12 11 14 15 9.5" />
    </svg>
  ),
};

export function DomainIcon({ d }: { d: string }) {
  return ICONS[d] ?? ICONS.all;
}

export function InsightsIcon() {
  return (
    <svg viewBox="0 0 24 24" {...sw}>
      <line x1="5" y1="20" x2="5" y2="11" /><line x1="11" y1="20" x2="11" y2="4" />
      <line x1="17" y1="20" x2="17" y2="14" /><line x1="23" y1="20" x2="23" y2="8" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" {...sw}>
      <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" />
    </svg>
  );
}

export function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" {...sw}>
      <path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z" />
      <path d="M19 14l.7 1.8L21.5 16.5 19.7 17.2 19 19l-.7-1.8L16.5 16.5l1.8-.7L19 14z" />
    </svg>
  );
}

export function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" {...sw}>
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="13 6 19 12 13 18" />
    </svg>
  );
}

export function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" {...sw}>
      <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" />
    </svg>
  );
}

const TRY: Record<string, ReactElement> = {
  search: (<svg viewBox="0 0 24 24" {...sw}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>),
  flask: (<svg viewBox="0 0 24 24" {...sw}><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3" /></svg>),
  bulb: (<svg viewBox="0 0 24 24" {...sw}><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.4 1 2.5h6c0-1.1.3-1.8 1-2.5A6 6 0 0 0 12 3z" /></svg>),
  bar: (<svg viewBox="0 0 24 24" {...sw}><line x1="6" y1="20" x2="6" y2="12" /><line x1="12" y1="20" x2="12" y2="5" /><line x1="18" y1="20" x2="18" y2="9" /></svg>),
  doc: (<svg viewBox="0 0 24 24" {...sw}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="14 3 14 9 20 9" /></svg>),
};

export function TryIcon({ name }: { name: string }) {
  return TRY[name] ?? TRY.search;
}

export function TableIcon() {
  return (
    <svg viewBox="0 0 24 24" {...sw}>
      <rect x="3" y="4" width="18" height="16" rx="2" /><line x1="3" y1="9.5" x2="21" y2="9.5" />
      <line x1="3" y1="15" x2="21" y2="15" /><line x1="10" y1="9.5" x2="10" y2="20" />
    </svg>
  );
}

const MINI: Record<string, ReactElement> = {
  eye: (<svg viewBox="0 0 24 24" {...sw}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>),
  chart: (<svg viewBox="0 0 24 24" {...sw}><line x1="6" y1="20" x2="6" y2="13" /><line x1="12" y1="20" x2="12" y2="7" /><line x1="18" y1="20" x2="18" y2="10" /></svg>),
  dots: (<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>),
  plus: (<svg viewBox="0 0 24 24" {...sw}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>),
  download: (<svg viewBox="0 0 24 24" {...sw}><path d="M12 3v12" /><polyline points="7 11 12 16 17 11" /><line x1="4" y1="20" x2="20" y2="20" /></svg>),
  sort: (<svg viewBox="0 0 24 24" {...sw}><line x1="6" y1="4" x2="6" y2="18" /><polyline points="3 15 6 18 9 15" /><line x1="14" y1="6" x2="20" y2="6" /><line x1="14" y1="12" x2="18" y2="12" /></svg>),
  filter: (<svg viewBox="0 0 24 24" {...sw}><polygon points="22 3 2 3 10 12.5 10 19 14 21 14 12.5 22 3" /></svg>),
  check: (<svg viewBox="0 0 24 24" {...sw}><polyline points="20 6 9 17 4 12" /></svg>),
  checkc: (<svg viewBox="0 0 24 24" {...sw}><circle cx="12" cy="12" r="9" /><polyline points="8.5 12 11 14.5 15.5 9.5" /></svg>),
  x: (<svg viewBox="0 0 24 24" {...sw}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>),
  alert: (<svg viewBox="0 0 24 24" {...sw}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>),
  send: (<svg viewBox="0 0 24 24" {...sw}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>),
  grid: (<svg viewBox="0 0 24 24" {...sw}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>),
  share: (<svg viewBox="0 0 24 24" {...sw}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" /></svg>),
  target: (<svg viewBox="0 0 24 24" {...sw}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.4" fill="currentColor" /></svg>),
  rocket: (<svg viewBox="0 0 24 24" {...sw}><path d="M5 15c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2 0-2.8a2 2 0 0 0-3 0z" /><path d="M9 13c4-6 8-9 12-9 0 4-3 8-9 12l-3-3z" /><circle cx="15" cy="9" r="1.2" /></svg>),
  users: (<svg viewBox="0 0 24 24" {...sw}><path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9" /></svg>),
  shield: (<svg viewBox="0 0 24 24" {...sw}><path d="M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z" /></svg>),
  bell: (<svg viewBox="0 0 24 24" {...sw}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>),
  edit: (<svg viewBox="0 0 24 24" {...sw}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>),
  refresh: (<svg viewBox="0 0 24 24" {...sw}><polyline points="22 4 22 10 16 10" /><path d="M20.5 14a8 8 0 1 1-1.9-8.3L22 10" /></svg>),
  help: (<svg viewBox="0 0 24 24" {...sw}><circle cx="12" cy="12" r="9" /><path d="M9.2 9.3a2.8 2.8 0 0 1 5.4 1c0 1.9-2.6 2.2-2.6 4" /><line x1="12" y1="17.5" x2="12.01" y2="17.5" /></svg>),
  gear: (<svg viewBox="0 0 24 24" {...sw}><circle cx="12" cy="12" r="3" /><path d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1A2 2 0 1 1 7 5.2l.1.1a1.7 1.7 0 0 0 2.9-1.2V4a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9z" /></svg>),
};

export function MiniIcon({ name }: { name: string }) {
  return MINI[name] ?? MINI.dots;
}

export function DashboardIcon() {
  return (<svg viewBox="0 0 24 24" {...sw}><rect x="3" y="3" width="7" height="9" rx="1.6" /><rect x="14" y="3" width="7" height="5" rx="1.6" /><rect x="14" y="12" width="7" height="9" rx="1.6" /><rect x="3" y="16" width="7" height="5" rx="1.6" /></svg>);
}
export function TrendsIcon() {
  return (<svg viewBox="0 0 24 24" {...sw}><polyline points="3 16 8 11 12 14 21 5" /><polyline points="15 5 21 5 21 11" /></svg>);
}
export function RecommendIcon() {
  return (<svg viewBox="0 0 24 24" {...sw}><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.4 1 2.5h6c0-1.1.3-1.8 1-2.5A6 6 0 0 0 12 3z" /></svg>);
}
export function AnalyticsIcon() {
  return (<svg viewBox="0 0 24 24" {...sw}><path d="M3 3v18h18" /><polyline points="7 14 11 9 14 12 20 5" /></svg>);
}
export function ReportsIcon() {
  return (<svg viewBox="0 0 24 24" {...sw}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="14 3 14 9 20 9" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="13" y2="17" /></svg>);
}

const TOPIC: Record<string, ReactElement> = {
  oil: (<svg viewBox="0 0 24 24" {...sw}><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" /></svg>),
  transport: (<svg viewBox="0 0 24 24" {...sw}><rect x="2" y="6" width="13" height="10" rx="1.5" /><path d="M15 9h4l3 3v4h-7z" /><circle cx="6" cy="18.5" r="1.6" /><circle cx="17.5" cy="18.5" r="1.6" /></svg>),
  tourism: (<svg viewBox="0 0 24 24" {...sw}><path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" /></svg>),
  export: (<svg viewBox="0 0 24 24" {...sw}><path d="M14 4h6v6" /><path d="M20 4l-8 8" /><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></svg>),
  import: (<svg viewBox="0 0 24 24" {...sw}><path d="M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" /><path d="M12 3v11" /><polyline points="7 9 12 14 17 9" /></svg>),
  trade: (<svg viewBox="0 0 24 24" {...sw}><polyline points="7 4 3 8 7 12" /><line x1="3" y1="8" x2="16" y2="8" /><polyline points="17 12 21 16 17 20" /><line x1="21" y1="16" x2="8" y2="16" /></svg>),
  ship: (<svg viewBox="0 0 24 24" {...sw}><path d="M3 14l1.4 5a2 2 0 0 0 1.9 1.4h11.4a2 2 0 0 0 1.9-1.4L21 14" /><path d="M5.5 14V9a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v5" /><line x1="12" y1="3" x2="12" y2="8" /></svg>),
  roadalert: (<svg viewBox="0 0 24 24" {...sw}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>),
  crime: (<svg viewBox="0 0 24 24" {...sw}><path d="M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="15" x2="12.01" y2="15" /></svg>),
};

export function TopicIcon({ name }: { name: string }) {
  return TOPIC[name] ?? TOPIC.oil;
}

export function SentimentIcon() {
  return (<svg viewBox="0 0 24 24" {...sw}><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5s1.3 2 3.5 2 3.5-2 3.5-2" /><line x1="9" y1="9.5" x2="9.01" y2="9.5" /><line x1="15" y1="9.5" x2="15.01" y2="9.5" /></svg>);
}
