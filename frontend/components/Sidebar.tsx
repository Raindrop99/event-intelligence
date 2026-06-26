"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme, useRefresh } from "@/app/providers";
import Modal from "./Modal";
import {
  BrandLogo, DashboardIcon, AnalyticsIcon, DomainIcon, SearchIcon,
  TableIcon, TrendsIcon, RecommendIcon, ReportsIcon, MiniIcon,
} from "./icons";

type Item = { href: string; label: string; icon: ReactNode; tag?: string };

const MENU: Item[] = [
  { href: "/dashboard", label: "Overview", icon: <DashboardIcon /> },
  { href: "/analytics", label: "Analytics", icon: <AnalyticsIcon /> },
  { href: "/view/market", label: "Market", icon: <DomainIcon d="market" /> },
  { href: "/view/policy", label: "Policy", icon: <DomainIcon d="policy" /> },
  { href: "/view/disaster", label: "Disaster", icon: <DomainIcon d="disaster" />, tag: "New" },
  { href: "/view/health", label: "Health", icon: <DomainIcon d="health" /> },
  { href: "/view/supply_chain", label: "Supply chain", icon: <DomainIcon d="supply_chain" /> },
  { href: "/search", label: "AI Search", icon: <SearchIcon /> },
];

const WORKSPACE: Item[] = [
  { href: "/", label: "All events", icon: <DomainIcon d="all" /> },
  { href: "/table", label: "Events table", icon: <TableIcon /> },
  { href: "/trends", label: "Trends", icon: <TrendsIcon /> },
  { href: "/recommendations", label: "Recommendations", icon: <RecommendIcon /> },
  { href: "/reports", label: "Reports", icon: <ReportsIcon /> },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { mode, toggle, density, toggleDensity } = useTheme();
  const { refreshNow, refreshing } = useRefresh();
  const [dlg, setDlg] = useState<null | "help" | "settings">(null);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const NavItem = ({ item }: { item: Item }) => (
    <Link href={item.href} className={`nitem ${isActive(item.href) ? "on" : ""}`}>
      {item.icon}<span className="nav-label">{item.label}</span>
      {item.tag && <span className="nav-tag">{item.tag}</span>}
    </Link>
  );

  return (
    <>
    <aside className="side">
      <div className="brand">
        <span className="blogo"><BrandLogo /></span>
        <span className="bname">Abu Dhabi<br /><em>Economic Intel</em></span>
      </div>

      <div className="sidescroll">
        <div className="navh">Menu</div>
        {MENU.map((m) => <NavItem key={m.href} item={m} />)}

        <div className="navh">Workspace</div>
        {WORKSPACE.map((m) => <NavItem key={m.href} item={m} />)}

        <div className="side-foot">
          <button type="button" className="nitem" onClick={() => setDlg("help")}><MiniIcon name="help" /><span className="nav-label">Help</span></button>
          <button type="button" className="nitem" onClick={() => setDlg("settings")}><MiniIcon name="gear" /><span className="nav-label">Settings</span></button>
          <div className="profile">
            <span className="avatar">VD</span>
            <div className="profile-text">
              <span className="profile-name">Gov Analyst</span>
              <span className="profile-sub">Abu Dhabi · government</span>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <Modal open={dlg === "help"} onClose={() => setDlg(null)} title="How to use this">
      <ul className="dlg-list">
        <li><b>Dashboard</b> — the day&apos;s signals for Abu Dhabi at a glance.</li>
        <li>Open any event for its <b>Official Action Brief</b>: the bottom line, the immediate move, who should lead, and the risk of inaction.</li>
        <li><b>AI Search</b> — ask a question; the agent answers from the live feed.</li>
        <li><b>Trends / Analytics / Reports</b> — patterns, distribution, and every analysed event.</li>
        <li>Use <b>Refresh now</b> to pull the latest news, and the bell for what needs action.</li>
      </ul>
    </Modal>

    <Modal open={dlg === "settings"} onClose={() => setDlg(null)} title="Settings">
      <div className="dlg-row"><span>Theme</span>
        <button type="button" className="dlg-btn" onClick={toggle}>{mode === "dark" ? "Dark" : "Light"} — switch</button></div>
      <div className="dlg-row"><span>Density</span>
        <button type="button" className="dlg-btn" onClick={toggleDensity}>{density === "compact" ? "Compact" : "Comfortable"} — switch</button></div>
      <div className="dlg-row"><span>Live data</span>
        <button type="button" className="dlg-btn" onClick={refreshNow} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh now"}</button></div>
    </Modal>
    </>
  );
}
