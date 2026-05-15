// src/lib/leadFunnel.js
// Spec: docs/specs/2026-05-15-kanban-sankey-analytics.md
//
// Pure aggregation helpers for the lead-funnel Sankey panel.
// No React, no Supabase — easy to unit-test from a Node REPL:
//   node --input-type=module -e 'import { computeKpis } from "./src/lib/leadFunnel.js"; console.log(computeKpis([]));'

export const OUTCOME_BUCKETS = {
  won: new Set(["signed", "closed_won"]),
  lost: new Set(["lost", "closed_lost"]),
  cold: new Set(["cold"]),
  // 'active' = anything else
};

export function bucketOf(status) {
  if (OUTCOME_BUCKETS.won.has(status)) return "won";
  if (OUTCOME_BUCKETS.lost.has(status)) return "lost";
  if (OUTCOME_BUCKETS.cold.has(status)) return "cold";
  return "active";
}

export const TIMEFRAME_DAYS = { "7d": 7, "30d": 30, "90d": 90, all: null };

export function filterByTimeframe(leads, timeframe, now = Date.now()) {
  const days = TIMEFRAME_DAYS[timeframe];
  if (days == null) return leads;
  const cutoff = now - days * 86_400_000;
  return leads.filter((l) => {
    if (!l.created_at) return false;
    return new Date(l.created_at).getTime() >= cutoff;
  });
}

const OUTCOME_ORDER = ["active", "won", "lost", "cold"];
const OUTCOME_LABELS = { active: "Active", won: "Won", lost: "Lost", cold: "Cold" };

export function buildSankeyData(leads) {
  const sourceCounts = new Map();
  const outcomeCounts = { active: 0, won: 0, lost: 0, cold: 0 };

  for (const l of leads) {
    const src = l.source || "other";
    sourceCounts.set(src, (sourceCounts.get(src) || 0) + 1);
    outcomeCounts[bucketOf(l.status)]++;
  }

  const sources = [...sourceCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, nodeType: "source", count }));

  const total = leads.length;
  const poolNode = { name: `All leads (${total})`, nodeType: "pool", count: total };

  const outcomes = OUTCOME_ORDER.map((o) => ({
    name: OUTCOME_LABELS[o],
    nodeType: "outcome",
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
    // Only leads currently sitting in viewing_booked have a reliable
    // "time to viewing booked" delta — see spec §3.1 limitation.
    if (l.status === "viewing_booked" && l.created_at && l.status_changed_at) {
      const ms =
        new Date(l.status_changed_at).getTime() -
        new Date(l.created_at).getTime();
      if (ms > 0) {
        viewingDays += ms / 86_400_000;
        viewingCount++;
      }
    }
  }

  return {
    total,
    activeInPipeline: buckets.active,
    wonCount: buckets.won,
    lostCount: buckets.lost,
    coldCount: buckets.cold,
    conversionPct:
      total === 0 ? 0 : Math.round((buckets.won / total) * 1000) / 10,
    avgDaysToViewing:
      viewingCount === 0
        ? null
        : Math.round((viewingDays / viewingCount) * 10) / 10,
  };
}
