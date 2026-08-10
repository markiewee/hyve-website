// src/components/portal/leads/LeadFunnelPanel.jsx
// Spec: docs/specs/2026-05-15-kanban-sankey-analytics.md
// Plan: docs/plans/2026-05-15-kanban-sankey-plan.md (Task 5 + 6)

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useLeads } from "@/hooks/useLeads";
import {
  buildSankeyData,
  computeKpis,
  filterByTimeframe,
} from "@/lib/leadFunnel";
import { FunnelSankey } from "./FunnelSankey";
import { FunnelKPIStrip } from "./FunnelKPIStrip";

const LS_COLLAPSED = "lazybee.leadsAnalytics.collapsed";
const LS_TIMEFRAME = "lazybee.leadsAnalytics.timeframe";

const TIMEFRAMES = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "all", label: "All" },
];

function readLS(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}
function writeLS(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / SSR, silently no-op */
  }
}

export function LeadFunnelPanel() {
  // Independent fetch from the parent Kanban so we always include archived
  // (signed/closed_won/lost/closed_lost/cold) in the funnel buckets, even
  // when the Kanban itself is hiding them.
  const { leads, loading } = useLeads({ includeArchived: true });

  const [collapsed, setCollapsed] = useState(
    () => readLS(LS_COLLAPSED, "0") === "1"
  );
  const [timeframe, setTimeframe] = useState(() =>
    readLS(LS_TIMEFRAME, "30d")
  );

  useEffect(() => writeLS(LS_COLLAPSED, collapsed ? "1" : "0"), [collapsed]);
  useEffect(() => writeLS(LS_TIMEFRAME, timeframe), [timeframe]);

  const filtered = useMemo(
    () => filterByTimeframe(leads, timeframe),
    [leads, timeframe]
  );
  const kpis = useMemo(() => computeKpis(filtered), [filtered]);
  const sankey = useMemo(() => buildSankeyData(filtered), [filtered]);

  return (
    <div className="mb-4 border border-border rounded-lg bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">Lead funnel</h2>
          <span className="text-xs text-foreground-variant">({kpis.total})</span>
          {loading ? (
            <span className="text-[11px] text-foreground-variant">loading…</span>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <div
            className="inline-flex bg-surface-container rounded-md p-0.5"
            role="radiogroup"
            aria-label="Timeframe"
          >
            {TIMEFRAMES.map((t) => (
              <button
                key={t.value}
                role="radio"
                aria-checked={timeframe === t.value}
                onClick={() => setTimeframe(t.value)}
                className={`px-2.5 py-1 text-xs rounded transition-colors ${
                  timeframe === t.value
                    ? "bg-white/5 text-foreground"
                    : "text-foreground-variant hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="p-1 rounded hover:bg-white/5 text-foreground-variant"
            aria-label={collapsed ? "Expand funnel" : "Collapse funnel"}
          >
            {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
      </div>

      {/* Body */}
      {!collapsed ? (
        <>
          <FunnelKPIStrip kpis={kpis} />
          {/* Desktop-only Sankey: collapse to KPI-strip-only on <1024px per spec */}
          <div className="hidden lg:block px-3 pb-3 pt-2">
            <FunnelSankey
              data={sankey}
              total={kpis.total}
              height={280}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
