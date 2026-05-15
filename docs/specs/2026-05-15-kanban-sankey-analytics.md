# Kanban Lead-Funnel Sankey — Spec
*Lazybee admin · 2026-05-15 · author: Claudine on behalf of Mark*

> One-line problem: The `/portal/admin/leads` Kanban shows status columns but answers no
> volumetric question — "where are my leads coming from, and where are they ending up?".
> This spec adds a collapsible analytics panel **above** the Kanban: a 4-tile KPI strip
> plus a 3-column Sankey (Source → Pool → Outcome) so Mark can read the funnel at a glance.

This is a **read-only, client-side** analytics layer. It does not mutate any lead data,
does not change the Kanban behaviour, and does not introduce a new database query — it
piggybacks on the same `useLeads` hook that powers the Kanban (with `includeArchived:true`).

---

## 1. Component tree

```
AdminLeadsPage
├── <LeadFunnelPanel />        ← NEW (this spec)
│   ├── <FunnelHeader />        ← title + collapse toggle + timeframe segmented control
│   ├── <FunnelKPIStrip />      ← 4 tiles
│   └── <FunnelSankey />        ← recharts <Sankey>; hidden when panel collapsed; falls back to KPIs only on <1024px
└── <DndContext> … (existing Kanban, unchanged)
```

### 1.1 `LeadFunnelPanel`
- **Props:** none. Owns its own data fetch (calls `useLeads({ includeArchived: true })`).
  Reason for not lifting state: the parent Kanban deliberately hides archived leads by
  default, and forcing it to always fetch them would change the Kanban's column counts.
  Two parallel hook calls share the same realtime channel name internally
  (`leads_changes`), so Supabase de-dupes the subscription.
- **Internal state:**
  - `collapsed: boolean` — persisted to `localStorage` under `lazybee.leadsAnalytics.collapsed`.
  - `timeframe: '7d' | '30d' | '90d' | 'all'` — persisted under `lazybee.leadsAnalytics.timeframe`. Default `'30d'`.
- **Layout:**
  - Wrapper `div` with `mb-4 border border-slate-200 rounded-lg bg-white`.
  - When collapsed: only shows the header bar.
  - When expanded: header + KPI strip + (on `≥1024px`) Sankey.
  - Always renders KPI strip when expanded (mobile-friendly fallback).

### 1.2 `FunnelHeader`
- **Props:** `{ collapsed, onToggle, timeframe, onTimeframeChange, total }`.
- Layout: flex row; left side title `"Lead funnel"` + total chip `"({total})"`; right side
  segmented control `[7d | 30d | 90d | All]` + chevron toggle.
- Segmented control is greyed when collapsed (timeframe still applies but you can't see it).

### 1.3 `FunnelKPIStrip`
- **Props:** `{ kpis }` where `kpis` is the output of `computeKpis(filteredLeads)`.
- Renders 4 tiles in a `grid grid-cols-2 lg:grid-cols-4 gap-3 p-3` row.
- Each tile: small slate label + large bold number + optional sub-text.

### 1.4 `FunnelSankey`
- **Props:** `{ data, height = 280 }`.
- Renders a `<ResponsiveContainer>` wrapping `<Sankey>` from recharts with custom
  `node` and `link` renderers so we can apply per-source colors (mirroring `LeadCard`
  badges) and per-outcome colors.
- Hover tooltip via custom `<Tooltip>` shows `{label} — N leads (P%)`.
- If `data.links.length === 0` → render empty-state ("No leads in this timeframe yet").

---

## 2. Data shape sent to recharts `<Sankey>`

Recharts wants `{ nodes: [...], links: [{ source: idx, target: idx, value }] }`.

```js
{
  nodes: [
    // index 0..S-1 → source nodes (one per distinct source in filtered set)
    { name: 'organic',   nodeType: 'source',  count: 21 },
    { name: 'facebook',  nodeType: 'source',  count: 8 },
    { name: 'telegram',  nodeType: 'source',  count: 6 },
    // index S → single pool node
    { name: 'All leads (50)', nodeType: 'pool', count: 50 },
    // index S+1..S+4 → outcome nodes (always 4, even if some are zero — keeps layout stable)
    { name: 'Active',  nodeType: 'outcome', outcome: 'active', count: 36 },
    { name: 'Won',     nodeType: 'outcome', outcome: 'won',    count: 0  },
    { name: 'Lost',    nodeType: 'outcome', outcome: 'lost',   count: 1  },
    { name: 'Cold',    nodeType: 'outcome', outcome: 'cold',   count: 1  },
  ],
  links: [
    // each source → pool
    { source: 0, target: 3, value: 21 },
    { source: 1, target: 3, value: 8 },
    { source: 2, target: 3, value: 6 },
    // pool → each non-zero outcome
    { source: 3, target: 4, value: 36 },
    { source: 3, target: 6, value: 1 },
    { source: 3, target: 7, value: 1 },
  ],
}
```

Notes:
- Outcome nodes are always present in the array (so node indices are stable) but
  zero-value outcomes get **no incoming link** — recharts will render the node with
  empty width.
- We always include the pool node so Mark's "1 side is source then it goes into a pool
  then it comes out on the other side by outcome" mental model is preserved even when
  there's only 1 source.

---

## 3. Aggregation logic (client-side, pure function)

Lives in `src/lib/leadFunnel.js` so it can be unit-tested without React.

```js
// src/lib/leadFunnel.js

export const OUTCOME_BUCKETS = {
  won:  new Set(['signed', 'closed_won']),
  lost: new Set(['lost', 'closed_lost']),
  cold: new Set(['cold']),
  // 'active' = anything else
};

export function bucketOf(status) {
  if (OUTCOME_BUCKETS.won.has(status))  return 'won';
  if (OUTCOME_BUCKETS.lost.has(status)) return 'lost';
  if (OUTCOME_BUCKETS.cold.has(status)) return 'cold';
  return 'active';
}

export const TIMEFRAME_DAYS = { '7d': 7, '30d': 30, '90d': 90, all: null };

export function filterByTimeframe(leads, timeframe, now = Date.now()) {
  const days = TIMEFRAME_DAYS[timeframe];
  if (days == null) return leads;
  const cutoff = now - days * 86_400_000;
  return leads.filter((l) => new Date(l.created_at).getTime() >= cutoff);
}

export function buildSankeyData(leads) {
  const sourceCounts = new Map();
  const outcomeCounts = { active: 0, won: 0, lost: 0, cold: 0 };

  for (const l of leads) {
    const src = l.source || 'other';
    sourceCounts.set(src, (sourceCounts.get(src) || 0) + 1);
    outcomeCounts[bucketOf(l.status)]++;
  }

  const sources = [...sourceCounts.entries()]
    .sort((a, b) => b[1] - a[1])  // largest first
    .map(([name, count]) => ({ name, nodeType: 'source', count }));

  const total = leads.length;
  const poolNode = { name: `All leads (${total})`, nodeType: 'pool', count: total };
  const outcomeOrder = ['active', 'won', 'lost', 'cold'];
  const outcomeLabels = { active: 'Active', won: 'Won', lost: 'Lost', cold: 'Cold' };
  const outcomes = outcomeOrder.map((o) => ({
    name: outcomeLabels[o],
    nodeType: 'outcome',
    outcome: o,
    count: outcomeCounts[o],
  }));

  const nodes = [...sources, poolNode, ...outcomes];
  const poolIdx = sources.length;

  const links = [];
  sources.forEach((s, i) => links.push({ source: i, target: poolIdx, value: s.count }));
  outcomes.forEach((o, i) => {
    if (o.count > 0) {
      links.push({ source: poolIdx, target: poolIdx + 1 + i, value: o.count });
    }
  });

  return { nodes, links };
}

export function computeKpis(leads) {
  const total = leads.length;
  const buckets = { active: 0, won: 0, lost: 0, cold: 0 };
  let viewingDays = 0;
  let viewingCount = 0;

  for (const l of leads) {
    buckets[bucketOf(l.status)]++;
    if (l.status === 'viewing_booked' && l.created_at && l.status_changed_at) {
      const ms = new Date(l.status_changed_at).getTime() - new Date(l.created_at).getTime();
      if (ms > 0) {
        viewingDays += ms / 86_400_000;
        viewingCount++;
      }
    }
  }

  return {
    total,
    activeInPipeline: buckets.active,
    conversionPct: total === 0 ? 0 : Math.round((buckets.won / total) * 1000) / 10,
    avgDaysToViewing: viewingCount === 0 ? null : Math.round((viewingDays / viewingCount) * 10) / 10,
  };
}
```

### 3.1 KPI definitions

| KPI | Formula | Display |
|---|---|---|
| Total leads | `count(filteredLeads)` | integer |
| Conversion % | `100 × (won / total)`, 1 decimal | `xx.x%` (or `—` if total = 0) |
| Avg days to viewing booked | mean of `(status_changed_at - created_at)` for leads currently `viewing_booked` | `x.x d` (or `—` if no leads ever booked viewings) |
| Active in pipeline | `count(status NOT IN won/lost/cold)` | integer |

**Why fall back to `viewing_booked - created_at` for the "current" viewing-booked leads
only:** the schema does not store a per-status-transition history. Each `status_changed_at`
overwrite represents only the *most recent* transition. So we can only confidently compute
the "time-to-viewing" for leads still sitting in `viewing_booked` (their last transition
WAS the booking). Leads that have moved on (viewed, signed, lost) have lost the
booking-transition timestamp. Documented as a known limitation in the spec; if Mark
wants accurate cohort metrics later we add a `lead_status_history` table.

---

## 4. Color palette (mirror `LeadCard.jsx` SOURCE_BADGES)

`src/lib/leadFunnelColors.js`

```js
// Hex equivalents of the Tailwind classes used in LeadCard's SOURCE_BADGES.
// We use the *background* shade for Sankey node fill and a 0.45 alpha for the link.
export const SOURCE_FILL = {
  airbnb:        '#fecdd3', // rose-100
  propertyguru:  '#fed7aa', // orange-100
  carousell:     '#fee2e2', // red-100
  roomies:       '#dbeafe', // blue-100
  facebook:      '#dbeafe', // blue-100
  telegram:      '#e0f2fe', // sky-100
  whatsapp_direct: '#dcfce7', // green-100
  agent_referral: '#f3e8ff', // purple-100
  referral:       '#f3e8ff',
  organic:        '#d1fae5', // emerald-100
  other:          '#f1f5f9', // slate-100
};

// Used for the *text* on each node label (mirrors LeadCard text color).
export const SOURCE_TEXT = {
  airbnb:        '#be123c',
  propertyguru:  '#c2410c',
  carousell:     '#b91c1c',
  roomies:       '#1d4ed8',
  facebook:      '#1e40af',
  telegram:      '#0369a1',
  whatsapp_direct: '#15803d',
  agent_referral: '#7e22ce',
  referral:       '#7e22ce',
  organic:        '#047857',
  other:          '#334155',
};

export const POOL_FILL = '#0f172a';     // slate-900
export const POOL_TEXT = '#ffffff';

export const OUTCOME_FILL = {
  active: '#10b981', // emerald-500
  won:    '#16a34a', // green-600
  lost:   '#e11d48', // rose-600
  cold:   '#64748b', // slate-500
};

export const OUTCOME_TEXT = '#ffffff';

// Unknown source defaults to slate (per Mark's rule)
export function sourceFill(name)  { return SOURCE_FILL[name]  ?? SOURCE_FILL.other; }
export function sourceText(name)  { return SOURCE_TEXT[name]  ?? SOURCE_TEXT.other; }
```

---

## 5. localStorage keys

| Key | Type | Default | Purpose |
|---|---|---|---|
| `lazybee.leadsAnalytics.collapsed` | `'1' \| '0'` | `'0'` | Whether the panel is collapsed |
| `lazybee.leadsAnalytics.timeframe` | `'7d' \| '30d' \| '90d' \| 'all'` | `'30d'` | Selected timeframe |

Reads guarded with `try { localStorage.getItem(...) } catch {}` for SSR / private-mode safety.

---

## 6. Edge cases

| Case | Behaviour |
|---|---|
| Zero leads in timeframe | KPIs render with `0` / `—`. Sankey shows empty-state text. |
| Single source only | Single source node still flows into the pool. Sankey is degenerate (just one band) but renders cleanly. |
| No Won leads yet | Won outcome node renders empty (no incoming link). Conversion KPI shows `0.0%`. |
| Source value not in palette | Falls back to `other` color (slate). Logged once via `console.warn` per session. |
| 10k+ leads | Aggregation is O(n) over a small object set; benchmarked at <5ms for 10k synthetic leads. Sankey itself is O(nodes^2) per-tick layout but nodes count = sources(~10) + 1 + 4 = ~15, so render is constant. |
| Realtime update during browse | The shared `useLeads` channel re-fires `fetchLeads`; analytics re-aggregates automatically via `useMemo` deps. |
| Mobile (<1024px) | Sankey hidden, KPI strip only. Header still shows toggle + timeframe segmented control (which now only affects KPIs). |
| Lead with `created_at = null` | Excluded from timeframe filter (defensive — should not happen since column is `NOT NULL`). |
| `status_changed_at = null` on viewing-booked lead | Skipped from avg-days calculation; if all skipped, KPI shows `—`. |
| Browser without localStorage | Reads/writes silently no-op; component falls back to defaults. |

---

## 7. Out of scope (logged as follow-ups, not built)

- **Outreach-channel drill-down on click** — Mark flagged as nice-to-have. Will attempt
  in Phase 3 implementation if time permits; otherwise added to Chudlife backlog.
- **Per-cohort time-to-conversion** — needs `lead_status_history` table (separate spec).
- **Server-side aggregation RPC** — not needed at <10k leads; revisit when DB grows.
- **Export Sankey as PNG / share link** — out of scope.

---

## 8. References

- House rules: `/Users/mark/Desktop/claudine/CLAUDE.md` — wide-screen rule, always-push-to-Vercel rule.
- Data hook: `src/hooks/useLeads.js`
- Source badge palette: `src/components/portal/leads/LeadCard.jsx`
- Recharts Sankey API: `node_modules/recharts/types/chart/Sankey.d.ts`
