"use client";
import Link from "next/link";
import type { CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useApi, useDone, useFilter } from "@/app/providers";
import { UC, ULABEL } from "@/lib/ui";
import type { Todos } from "@/lib/types";

export default function ActionCenter() {
  const { data } = useApi<Todos>("/api/todos");
  const { done, toggle } = useDone();
  const { urgency, setUrgency } = useFilter();
  const router = useRouter();
  const pathname = usePathname();

  const counts = data?.counts ?? { act: 0, review: 0, watch: 0 };
  const items = data?.items ?? [];
  const total = counts.act + counts.review + counts.watch;

  const clickCount = (u: "act" | "review" | "watch") => {
    setUrgency(urgency === u ? "all" : u);
    if (pathname !== "/") router.push("/");
  };

  const visible = items.filter((t) => urgency === "all" || t.urgency === urgency);
  const ordered = [...visible].sort((a, b) => (done.has(a.key) ? 1 : 0) - (done.has(b.key) ? 1 : 0));
  const firstKey = ordered.find((t) => !done.has(t.key))?.key;

  return (
    <div className="panel">
      <div className="achead">
        <h2>✓ Things to look at</h2>
        <span className="sub">{total ? `${total} to look at` : ""}</span>
      </div>
      <div className="counts">
        {(["act", "review", "watch"] as const).map((u) => (
          <div key={u} className={`count ${u} ${urgency === u ? "on" : ""}`}
            onClick={() => clickCount(u)} title={`Click to show only ${ULABEL[u]} items`}>
            <div className="n">{counts[u]}</div>
            <div className="l">{ULABEL[u]}</div>
          </div>
        ))}
      </div>
      <div className="counthint">Tap a number to filter</div>
      <div className="todolist">
        {!visible.length ? (
          <div className="acempty">
            {total ? `Nothing under “${ULABEL[urgency] ?? ""}” right now.` : "Nothing actionable right now — all clear."}
          </div>
        ) : (
          ordered.map((t) => {
            const isDone = done.has(t.key);
            const first = !isDone && t.key === firstKey;
            return (
              <div key={t.key} className={`todo ${isDone ? "done" : ""} ${first ? "first" : ""}`}
                style={{ "--uc": UC[t.urgency] } as CSSProperties}>
                <div className="tl">
                  <input type="checkbox" checked={isDone} title="Tick when done" onChange={() => toggle(t.key)} />
                  <Link className="tlabel" href={`/event/${encodeURIComponent(t.key)}`} title="Open the full breakdown">
                    {t.title}
                  </Link>
                  {first && <span className="starttag">Start here</span>}
                </div>
                <div className="tdetail">{t.step}</div>
              </div>
            );
          })
        )}
      </div>
      <div className="acfoot">Suggestions, not advice — you decide.</div>
    </div>
  );
}
