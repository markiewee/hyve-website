# Kanban Sankey — Implementation Plan
*Companion to `docs/specs/2026-05-15-kanban-sankey-analytics.md` · 2026-05-15*

## Plan structure
Tasks are ordered by dependency. Each is one atomic commit. Run `npm run lint` before
each commit. Push to Vercel after every commit (per house rule "always push to Vercel").

Subagent dispatch grouping (per `superpowers:subagent-driven-development`):
- **Wave 1 (parallel, no shared state):** Task 1 (pure-fn lib), Task 2 (color palette).
- **Wave 2 (sequential, depends on Wave 1):** Task 3 (Sankey component), Task 4 (KPI strip), Task 5 (panel wrapper).
- **Wave 3 (sequential, depends on Wave 2):** Task 6 (mount on AdminLeadsPage), Task 7 (lint + manual smoke).
- **Wave 4 (deferred, optional):** Task 8 (outreach-channel drill-down — only if Wave 3 finishes clean).

---

## Task 1 — Pure aggregation lib + tests

**Files:**
- `src/lib/leadFunnel.js` (new)

**What to do:**
1. Implement `bucketOf`, `filterByTimeframe`, `buildSankeyData`, `computeKpis` per spec §3.
2. Export `OUTCOME_BUCKETS`, `TIMEFRAME_DAYS` constants.

**Skeleton:** see spec §3.

**Test cases (manual smoke + Node REPL — no test framework wired in this repo):**
```bash
node --input-type=module -e '
import { buildSankeyData, computeKpis, filterByTimeframe, bucketOf } from "./src/lib/leadFunnel.js";
const sample = [
  { source: "facebook", status: "new",            created_at: "2026-05-14T00:00:00Z" },
  { source: "facebook", status: "qualified",      created_at: "2026-05-13T00:00:00Z" },
  { source: "organic",  status: "viewing_booked", created_at: "2026-05-10T00:00:00Z", status_changed_at: "2026-05-12T00:00:00Z" },
  { source: "organic",  status: "signed",         created_at: "2026-05-01T00:00:00Z" },
  { source: "carousell",status: "lost",           created_at: "2026-05-01T00:00:00Z" },
  { source: "carousell",status: "cold",           created_at: "2026-05-01T00:00:00Z" },
];
console.log("bucket(signed) =>", bucketOf("signed"));
console.log("bucket(lost) =>", bucketOf("lost"));
console.log("bucket(new) =>", bucketOf("new"));
console.log("filter 7d =>", filterByTimeframe(sample, "7d", new Date("2026-05-15T00:00:00Z").getTime()).length);
console.log("kpis =>", computeKpis(sample));
console.log("sankey =>", JSON.stringify(buildSankeyData(sample), null, 2));
'
```

Expected:
- `bucket(signed)` = `won`; `bucket(lost)` = `lost`; `bucket(new)` = `active`.
- 7d filter returns 3 (Mar 14, 13, 10 — wait, only the first two are within 7d of May 15; recompute — Mar dates all within 7d are 14, 13, 10).
- `kpis.total = 6`, `conversionPct = 16.7`, `activeInPipeline = 3`, `avgDaysToViewing = 2.0`.
- Sankey nodes: 3 sources + 1 pool + 4 outcomes = 8. Links = 3 (sources→pool) + 4 (pool→outcomes minus zero) — should be 3+4 since active=3, won=1, lost=1, cold=1, all >0 ⇒ 7 links.

**Commit:** `feat(leads): add lead funnel aggregation lib (sankey + kpis)`

---

## Task 2 — Color palette

**Files:**
- `src/lib/leadFunnelColors.js` (new)

**What to do:** Drop in the constants + helpers from spec §4.

**Test:** Import in a Node REPL, verify `sourceFill('foo')` returns `'#f1f5f9'` (other / slate).

**Commit:** `feat(leads): add funnel color palette (mirrors LeadCard badges)`

---

## Task 3 — `FunnelSankey` component

**Files:**
- `src/components/portal/leads/FunnelSankey.jsx` (new)

**What to do:**
1. Render `<ResponsiveContainer width="100%" height={height}>` wrapping `<Sankey>`.
2. Custom `node={<FunnelNode />}` and `link={<FunnelLink />}` so we can color nodes
   per source/outcome and links per source.
3. Custom Tooltip via `<Tooltip content={<FunnelTooltip />} />`.
4. Empty state: if `data.links.length === 0`, return centered slate text "No leads in this
   timeframe yet — adjust the filter or wait for new prospects."

**Skeleton:**
```jsx
import { ResponsiveContainer, Sankey, Tooltip, Layer, Rectangle } from "recharts";
import { sourceFill, sourceText, POOL_FILL, POOL_TEXT, OUTCOME_FILL, OUTCOME_TEXT } from "@/lib/leadFunnelColors";

function fillFor(node) {
  if (node.nodeType === "source")  return sourceFill(node.name);
  if (node.nodeType === "outcome") return OUTCOME_FILL[node.outcome];
  return POOL_FILL;
}
function textFor(node) {
  if (node.nodeType === "source")  return sourceText(node.name);
  if (node.nodeType === "outcome") return OUTCOME_TEXT;
  return POOL_TEXT;
}

function FunnelNode({ x, y, width, height, index, payload, containerWidth }) {
  const isLeft  = payload.nodeType === "source";
  const isRight = payload.nodeType === "outcome";
  const fill = fillFor(payload);
  const txtFill = textFor(payload);
  const labelX = isLeft ? x + width + 6 : isRight ? x - 6 : x + width / 2;
  const anchor = isLeft ? "start" : isRight ? "end" : "middle";
  return (
    <Layer key={`fn-${index}`}>
      <Rectangle x={x} y={y} width={width} height={height} fill={fill} fillOpacity={1} />
      <text x={labelX} y={y + height / 2} textAnchor={anchor} dominantBaseline="middle"
            fontSize={12} fontWeight={600} fill={payload.nodeType === "pool" ? POOL_TEXT : "#0f172a"}>
        {payload.name} <tspan fill="#64748b" fontWeight={400}>({payload.count})</tspan>
      </text>
    </Layer>
  );
}

function FunnelLink(props) {
  const { sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, payload } = props;
  // Color the band by the source-side node fill.
  const fill = fillFor(payload.source);
  return (
    <path d={`M${sourceX},${sourceY}C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
          fill="none" stroke={fill} strokeOpacity={0.45} strokeWidth={linkWidth} />
  );
}

function FunnelTooltip({ payload, total }) {
  if (!payload || !payload.length) return null;
  const p = payload[0].payload;
  // Sankey passes both link and node payloads — handle both.
  if (p.source !== undefined && p.target !== undefined) {
    const v = p.value;
    const pct = total > 0 ? ((v / total) * 100).toFixed(1) : "0.0";
    return (
      <div className="bg-white border border-slate-200 rounded shadow px-2 py-1 text-xs">
        <div className="font-medium">{p.source.name} → {p.target.name}</div>
        <div className="text-slate-600">{v} leads · {pct}%</div>
      </div>
    );
  }
  const pct = total > 0 ? ((p.count / total) * 100).toFixed(1) : "0.0";
  return (
    <div className="bg-white border border-slate-200 rounded shadow px-2 py-1 text-xs">
      <div className="font-medium">{p.name}</div>
      <div className="text-slate-600">{p.count} leads · {pct}%</div>
    </div>
  );
}

export function FunnelSankey({ data, total, height = 280 }) {
  if (!data || data.links.length === 0) {
    return (
      <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm italic">
        No leads in this timeframe yet — adjust the filter or wait for new prospects.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Sankey
        data={data}
        nodePadding={20}
        nodeWidth={12}
        linkCurvature={0.5}
        iterations={32}
        margin={{ top: 8, right: 96, bottom: 8, left: 96 }}
        node={<FunnelNode />}
        link={<FunnelLink />}
      >
        <Tooltip content={<FunnelTooltip total={total} />} />
      </Sankey>
    </ResponsiveContainer>
  );
}
```

**Manual test:** Render in `AdminLeadsPage` once mounted; visually confirm:
- 3 columns visible
- Source nodes colored to match LeadCard badges
- Pool node is dark slate
- Outcomes color-coded (emerald/green/rose/slate)
- Hover shows correct tooltip
- Resizing browser maintains layout

**Commit:** `feat(leads): add FunnelSankey component (recharts + custom render)`

---

## Task 4 — `FunnelKPIStrip` component

**Files:**
- `src/components/portal/leads/FunnelKPIStrip.jsx` (new)

**What to do:**
```jsx
function Tile({ label, value, sub }) {
  return (
    <div className="bg-slate-50 rounded-md px-3 py-2 border border-slate-200">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-2xl font-semibold text-slate-900 leading-tight">{value}</div>
      {sub ? <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div> : null}
    </div>
  );
}

export function FunnelKPIStrip({ kpis }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-3">
      <Tile label="Total leads"    value={kpis.total} />
      <Tile label="Conversion"     value={kpis.total === 0 ? "—" : `${kpis.conversionPct.toFixed(1)}%`} sub="Won / Total" />
      <Tile label="Avg → viewing"  value={kpis.avgDaysToViewing == null ? "—" : `${kpis.avgDaysToViewing}d`} sub="created → viewing_booked" />
      <Tile label="Active in pipeline" value={kpis.activeInPipeline} />
    </div>
  );
}
```

**Manual test:** Plug in `{ total: 50, conversionPct: 0, avgDaysToViewing: 2.5, activeInPipeline: 36 }` — confirm 4 tiles render with correct values.

**Commit:** `feat(leads): add FunnelKPIStrip component`

---

## Task 5 — `LeadFunnelPanel` wrapper

**Files:**
- `src/components/portal/leads/LeadFunnelPanel.jsx` (new)

**What to do:**
1. Mount `useLeads({ includeArchived: true })` — independent fetch from the parent Kanban.
2. `useMemo` filtered + aggregated data on `[leads, timeframe]`.
3. `useState` + localStorage for `collapsed`, `timeframe`.
4. Render `FunnelHeader` (inline component below) + KPI strip + Sankey (hidden <1024px).

**Skeleton:**
```jsx
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useLeads } from "@/hooks/useLeads";
import { buildSankeyData, computeKpis, filterByTimeframe } from "@/lib/leadFunnel";
import { FunnelSankey } from "./FunnelSankey";
import { FunnelKPIStrip } from "./FunnelKPIStrip";

const LS_COLLAPSED = "lazybee.leadsAnalytics.collapsed";
const LS_TIMEFRAME = "lazybee.leadsAnalytics.timeframe";
const TIMEFRAMES = [
  { value: "7d",  label: "7d"  },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "all", label: "All" },
];

function readLS(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function writeLS(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}

export function LeadFunnelPanel() {
  const { leads, loading } = useLeads({ includeArchived: true });
  const [collapsed, setCollapsed] = useState(() => readLS(LS_COLLAPSED, "0") === "1");
  const [timeframe, setTimeframe] = useState(() => readLS(LS_TIMEFRAME, "30d"));

  useEffect(() => writeLS(LS_COLLAPSED, collapsed ? "1" : "0"), [collapsed]);
  useEffect(() => writeLS(LS_TIMEFRAME, timeframe), [timeframe]);

  const filtered = useMemo(() => filterByTimeframe(leads, timeframe), [leads, timeframe]);
  const kpis     = useMemo(() => computeKpis(filtered), [filtered]);
  const sankey   = useMemo(() => buildSankeyData(filtered), [filtered]);

  return (
    <div className="mb-4 border border-slate-200 rounded-lg bg-white">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-700">Lead funnel</h2>
          <span className="text-xs text-slate-500">({kpis.total})</span>
          {loading && <span className="text-[11px] text-slate-400">loading…</span>}
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex bg-slate-100 rounded-md p-0.5">
            {TIMEFRAMES.map((t) => (
              <button key={t.value}
                onClick={() => setTimeframe(t.value)}
                className={`px-2.5 py-1 text-xs rounded ${
                  timeframe === t.value ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"
                }`}>
                {t.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="p-1 rounded hover:bg-slate-100 text-slate-500"
            aria-label={collapsed ? "Expand" : "Collapse"}>
            {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
      </div>
      {!collapsed && (
        <>
          <FunnelKPIStrip kpis={kpis} />
          <div className="hidden lg:block px-3 pb-3">
            <FunnelSankey data={sankey} total={kpis.total} height={280} />
          </div>
        </>
      )}
    </div>
  );
}
```

**Manual test:** Toggle collapsed state — confirm localStorage persists across refresh.
Switch timeframe — confirm KPIs and Sankey re-render.

**Commit:** `feat(leads): add LeadFunnelPanel wrapper (collapsible + timeframe + persists)`

---

## Task 6 — Mount panel on `AdminLeadsPage`

**Files:**
- `src/pages/portal/AdminLeadsPage.jsx` (modify)

**What to do:** Add `import { LeadFunnelPanel } from "@/components/portal/leads/LeadFunnelPanel";` and render `<LeadFunnelPanel />` between the header block and the `error` block (above the DndContext).

**Diff:**
```jsx
        </Button>
      </div>

+      <LeadFunnelPanel />
+
      {error && (
        ...
```

**Manual test:** `npm run dev`, visit `/portal/admin/leads`, confirm:
- Panel renders above Kanban columns.
- Default timeframe = `30d`.
- Default state = expanded.
- Toggle collapses → KPIs + Sankey hidden.
- Refresh → toggle state preserved.
- Drag a card to a new column → no flicker on the panel; realtime triggers re-aggregation.

**Commit:** `feat(leads): mount LeadFunnelPanel above kanban on AdminLeadsPage`

---

## Task 7 — Lint + final smoke

**Files:** none

**What to do:**
1. `npm run lint` — fix anything new.
2. `npm run build` — verify production build succeeds (catches any tree-shaking issues with recharts Sankey).
3. Visual smoke at `npm run dev` — resize browser <1024px to confirm Sankey hides + KPIs persist.

**Commit:** (no commit unless lint fixes are needed; if so: `chore(leads): fix lint warnings in funnel components`)

---

## Task 8 (optional, deferred) — Outreach-channel drill-down

**Files:** `FunnelSankey.jsx`, `leadFunnel.js`

**What to do:**
1. Add `onSourceClick(sourceName)` prop on `FunnelSankey`.
2. In panel, track `expandedSource: string | null`.
3. When a source is expanded, replace its single node with N sub-nodes
   (one per `intent.outreach_channel` value among that source's leads).

**Skip if:** Wave 3 finishes with any outstanding lint/build issues. Log to Chudlife backlog instead.

**Commit (if shipped):** `feat(leads): add per-source outreach-channel drill-down`

---

## Vercel deploy
After every commit: `git push origin feature/kanban-sankey`. Vercel auto-builds preview.
After Task 6: capture preview URL; verify `/portal/admin/leads` renders correctly with auth.
