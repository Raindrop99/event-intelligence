"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApi, useTheme, useRefresh } from "@/app/providers";
import { SearchIcon, MiniIcon } from "@/components/icons";
import type { Stats, Todos } from "@/lib/types";

export default function Taskbar() {
  const router = useRouter();
  const { mode, toggle, density, toggleDensity } = useTheme();
  const { refreshing, refreshNow } = useRefresh();
  const { data: stats } = useApi<Stats>("/api/stats");
  const { data: todos } = useApi<Todos>("/api/todos");
  const live = !!stats;

  const [notifOpen, setNotifOpen] = useState(false);
  const acts = (todos?.items || []).filter((i) => i.urgency === "act").slice(0, 6);
  const actCount = todos?.counts.act ?? 0;

  return (
    <header className="mtop">
      <div className="greet">
        <h1 className="greet-title">Hello, Official <span suppressHydrationWarning>👋</span></h1>
        <p className="greet-sub">{"Today's signals for Abu Dhabi's economy"}</p>
      </div>

      <div className="top-actions">
        <span className={`live-dot${live ? " on" : ""}`}><i /> {live ? "Live" : "Connecting…"}</span>

        <button type="button" className="icon-btn" aria-label="Search" onClick={() => router.push("/search")}>
          <SearchIcon />
        </button>

        <div className="notif-wrap">
          <button type="button" className="icon-btn" aria-label="Notifications" onClick={() => setNotifOpen((o) => !o)}>
            <MiniIcon name="bell" />
            {actCount > 0 && <span className="notif-badge">{actCount > 9 ? "9+" : actCount}</span>}
          </button>
          {notifOpen && (
            <>
              <div className="notif-ov" onClick={() => setNotifOpen(false)} role="presentation" />
              <div className="notif-panel" role="dialog" aria-label="Notifications">
                <div className="notif-head">Needs action now <span>{actCount}</span></div>
                {acts.length ? acts.map((i) => (
                  <Link key={i.key} className="notif-item" href={`/event/${encodeURIComponent(i.key)}`} onClick={() => setNotifOpen(false)}>
                    <span className="notif-dot" />
                    <div className="notif-text">
                      <div className="notif-title">{i.title}</div>
                      <div className="notif-step">{i.step}</div>
                    </div>
                  </Link>
                )) : <div className="notif-empty">Nothing needs immediate action right now.</div>}
                <Link className="notif-all" href="/" onClick={() => setNotifOpen(false)}>View all events →</Link>
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          className="icon-btn"
          aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          onClick={toggle}
        >
          <span style={{ fontSize: 16 }} suppressHydrationWarning>{mode === "dark" ? "☀" : "☾"}</span>
        </button>

        <button type="button" className={`btn-ghost${density === "compact" ? " on" : ""}`} onClick={toggleDensity}>
          <MiniIcon name="edit" /> {density === "compact" ? "Comfortable" : "Compact"} view
        </button>

        <button type="button" className="btn-primary" onClick={refreshNow} disabled={refreshing}>
          <MiniIcon name="refresh" /> {refreshing ? "Refreshing…" : "Refresh now"}
        </button>
      </div>
    </header>
  );
}
