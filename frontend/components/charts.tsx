"use client";
import { useRef, useState, type CSSProperties, type MouseEvent } from "react";

/* Catmull-Rom → cubic-bezier smoothing through a set of points. */
function smooth(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return pts.length ? `M ${pts[0].x} ${pts[0].y}` : "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x} ${p2.y.toFixed(1)}`;
  }
  return d;
}

const W = 1000;

export interface ChartSeries {
  key: string;
  color: string;
  values: number[];
  label?: string;
}

/* Multi-series smooth area chart. `stacked` for the Trends stream; otherwise the
   series overlay each other. With `tooltip`, a guide line + readout follows the cursor. */
export function AreaChart({
  series, labels, height = 220, stacked = false, tooltip = false, yTicks = 0, fillOpacity = 0.5,
}: {
  series: ChartSeries[]; labels: string[]; height?: number; stacked?: boolean;
  tooltip?: boolean; yTicks?: number; fillOpacity?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const n = labels.length || 1;
  const H = height;
  const x = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W);

  let max = 1;
  if (stacked) {
    for (let i = 0; i < n; i++) max = Math.max(max, series.reduce((s, ss) => s + (ss.values[i] || 0), 0));
  } else {
    series.forEach((ss) => ss.values.forEach((v) => (max = Math.max(max, v))));
  }
  const y = (v: number) => H - 6 - (v / max) * (H - 16);

  // build per-series paths
  const base = new Array(n).fill(0);
  const layers = series.map((ss) => {
    const top = ss.values.map((v, i) => {
      const acc = stacked ? base[i] + v : v;
      if (stacked) base[i] = acc;
      return { x: x(i), y: y(acc) };
    });
    const bottomY = stacked ? top.map((_, i) => y(base[i] - ss.values[i])) : top.map(() => H - 6);
    const line = smooth(top);
    const area = `${line} L ${x(n - 1)} ${bottomY[n - 1]} ` +
      smooth(top.map((p, i) => ({ x: p.x, y: bottomY[i] })).reverse()).replace(/^M/, "L") +
      ` Z`;
    return { ss, line, area };
  });

  const onMove = (e: MouseEvent) => {
    if (!tooltip || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / r.width) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <div className="chartwrap" ref={ref} style={{ position: "relative" }}
      onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H} style={{ display: "block" }}>
        {Array.from({ length: yTicks }, (_, i) => {
          const gy = (i / (yTicks - 1 || 1)) * (H - 16) + 6;
          return <line key={i} x1="0" x2={W} y1={gy} y2={gy} stroke="var(--line)" strokeWidth="1" opacity="0.5" />;
        })}
        {layers.map(({ ss, line, area }) => (
          <g key={ss.key}>
            <path d={area} fill={ss.color} opacity={fillOpacity} />
            <path d={line} fill="none" stroke={ss.color} strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
          </g>
        ))}
        {hover != null && (
          <line x1={x(hover)} x2={x(hover)} y1="0" y2={H} stroke="var(--muted)" strokeWidth="1"
            strokeDasharray="3 3" vectorEffect="non-scaling-stroke" opacity="0.7" />
        )}
      </svg>
      {tooltip && hover != null && (
        <div className="charttip" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <div className="cttitle">{labels[hover]}</div>
          {series.map((ss) => (
            <div key={ss.key} className="ctrow">
              <span className="ctsw" style={{ background: ss.color }} />
              {ss.label || ss.key}<b>{ss.values[hover] ?? 0}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* Single smooth line with dots, dashed grid and labelled markers (momentum timeline). */
export function LineChart({
  values, labels, color = "var(--accent)", markers = [], height = 200,
}: {
  values: number[]; labels: string[]; color?: string; height?: number;
  markers?: { x: number; text: string }[];
}) {
  const n = values.length || 1;
  const H = height;
  const max = Math.max(...values, 1);
  const x = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => H - 22 - (v / max) * (H - 40);
  const pts = values.map((v, i) => ({ x: x(i), y: y(v) }));
  const line = smooth(pts);
  return (
    <div className="linewrap">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H} style={{ display: "block" }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
          <line key={i} x1="0" x2={W} y1={6 + f * (H - 40)} y2={6 + f * (H - 40)}
            stroke="var(--line)" strokeWidth="1" strokeDasharray="4 5" opacity="0.5" />
        ))}
        <path d={`${line} L ${x(n - 1)} ${H - 22} L ${x(0)} ${H - 22} Z`} fill={color} opacity="0.1" />
        <path d={line} fill="none" stroke={color} strokeWidth="2.4" vectorEffect="non-scaling-stroke" />
        {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} vectorEffect="non-scaling-stroke" />)}
      </svg>
      {markers.map((m, i) => (
        <div key={i} className="lmarker" style={{ left: `${(x(m.x) / W) * 100}%` }}>{m.text}</div>
      ))}
      <div className="lxaxis">
        {labels.map((l, i) => (i % 2 === 0 ? <span key={i}>{l}</span> : null))}
      </div>
    </div>
  );
}

/* Radar / spider chart across labelled axes (0–100). */
export function Radar({
  axes, size = 230,
}: { axes: { label: string; value: number; color?: string }[]; size?: number }) {
  const c = size / 2;
  const r = c - 26;
  const n = axes.length || 1;
  const pt = (i: number, frac: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [c + Math.cos(a) * r * frac, c + Math.sin(a) * r * frac];
  };
  const poly = axes.map((ax, i) => pt(i, Math.max(0.04, ax.value / 100)).join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="radarsvg">
      {[0.25, 0.5, 0.75, 1].map((f, i) => (
        <polygon key={i} points={axes.map((_, j) => pt(j, f).join(",")).join(" ")}
          fill="none" stroke="var(--line)" strokeWidth="1" />
      ))}
      {axes.map((_, i) => {
        const [px, py] = pt(i, 1);
        return <line key={i} x1={c} y1={c} x2={px} y2={py} stroke="var(--line)" strokeWidth="1" />;
      })}
      <polygon points={poly} fill="var(--accent)" fillOpacity="0.18" stroke="var(--accent)" strokeWidth="2" />
      {axes.map((ax, i) => {
        const [px, py] = pt(i, 1.16);
        return (
          <text key={i} x={px} y={py} fontSize="10" fill="var(--muted)"
            textAnchor="middle" dominantBaseline="middle">{ax.label}</text>
        );
      })}
    </svg>
  );
}

/* Tiny vertical bars (the risk mini-charts). */
export function MiniBars({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className="minibars">
      {values.map((v, i) => (
        <i key={i} style={{ height: `${Math.max(12, (v / max) * 100)}%`, background: color }} />
      ))}
    </div>
  );
}

/* Conic-gradient donut with a centre label. */
export function Donut({
  segments, label, sub, size = 150,
}: { segments: { color: string; value: number }[]; label: string; sub?: string; size?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let acc = 0;
  const stops = segments.map((s) => {
    const a = (acc / total) * 100; acc += s.value; const b = (acc / total) * 100;
    return `${s.color} ${a}% ${b}%`;
  });
  const bg = stops.length ? `conic-gradient(${stops.join(",")})` : "conic-gradient(var(--line) 0 100%)";
  return (
    <div className="donut" style={{ background: bg, width: size, height: size } as CSSProperties}>
      <div className="donutc"><div className="dn">{label}</div>{sub && <div className="dl">{sub}</div>}</div>
    </div>
  );
}
