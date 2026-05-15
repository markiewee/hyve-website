// src/components/portal/leads/FunnelKPIStrip.jsx
// Spec: docs/specs/2026-05-15-kanban-sankey-analytics.md §1.3

function Tile({ label, value, sub }) {
  return (
    <div className="bg-slate-50 rounded-md px-3 py-2 border border-slate-200">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="text-2xl font-semibold text-slate-900 leading-tight">
        {value}
      </div>
      {sub ? (
        <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>
      ) : null}
    </div>
  );
}

export function FunnelKPIStrip({ kpis }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-3 pt-3">
      <Tile label="Total leads" value={kpis.total} />
      <Tile
        label="Conversion"
        value={
          kpis.total === 0 ? "—" : `${kpis.conversionPct.toFixed(1)}%`
        }
        sub={`Won ${kpis.wonCount} / ${kpis.total}`}
      />
      <Tile
        label="Avg → viewing"
        value={
          kpis.avgDaysToViewing == null ? "—" : `${kpis.avgDaysToViewing}d`
        }
        sub="created → viewing_booked"
      />
      <Tile label="Active in pipeline" value={kpis.activeInPipeline} />
    </div>
  );
}
