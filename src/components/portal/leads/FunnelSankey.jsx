// src/components/portal/leads/FunnelSankey.jsx
// Spec: docs/specs/2026-05-15-kanban-sankey-analytics.md
//
// Renders a Source -> Pool -> Outcome Sankey for the lead funnel panel.
// Uses recharts <Sankey> with custom node + link renderers so the colors
// mirror the source badges in LeadCard.jsx.

import { ResponsiveContainer, Sankey, Tooltip, Layer, Rectangle } from "recharts";
import {
  sourceFill,
  sourceText,
  POOL_FILL,
  POOL_TEXT,
  OUTCOME_FILL,
  OUTCOME_TEXT,
} from "@/lib/leadFunnelColors";

function fillFor(node) {
  if (!node) return POOL_FILL;
  if (node.nodeType === "source") return sourceFill(node.name);
  if (node.nodeType === "outcome") return OUTCOME_FILL[node.outcome];
  return POOL_FILL;
}

function FunnelNode(props) {
  const { x, y, width, height, index, payload } = props;
  if (!payload) return null;
  const fill = fillFor(payload);
  const isLeft = payload.nodeType === "source";
  const isRight = payload.nodeType === "outcome";
  const isPool = payload.nodeType === "pool";

  // Label positioning: source -> right of node; outcome -> left of node;
  // pool -> centered below node so it doesn't overlap the bands.
  const labelX = isLeft ? x + width + 8 : isRight ? x - 8 : x + width / 2;
  const labelY = isPool ? y + height + 14 : y + height / 2;
  const anchor = isLeft ? "start" : isRight ? "end" : "middle";
  const labelFill = isPool || isRight ? "#0f172a" : "#0f172a";
  const subFill = "#64748b";

  return (
    <Layer key={`fn-node-${index}`}>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={Math.max(height, 1)}
        fill={fill}
        fillOpacity={1}
        stroke="#fff"
        strokeWidth={isPool ? 0 : 1}
      />
      {isPool ? (
        // Pool gets its label inside (white text on dark slate)
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={11}
          fontWeight={600}
          fill={POOL_TEXT}
          style={{ pointerEvents: "none" }}
        >
          Pool
        </text>
      ) : null}
      <text
        x={labelX}
        y={labelY}
        textAnchor={anchor}
        dominantBaseline="middle"
        fontSize={12}
        fontWeight={600}
        fill={isRight ? OUTCOME_FILL[payload.outcome] : isLeft ? sourceText(payload.name) : labelFill}
        style={{ pointerEvents: "none" }}
      >
        {payload.name}{" "}
        <tspan fill={subFill} fontWeight={400}>
          ({payload.count})
        </tspan>
      </text>
    </Layer>
  );
}

function FunnelLink(props) {
  const {
    sourceX,
    targetX,
    sourceY,
    targetY,
    sourceControlX,
    targetControlX,
    linkWidth,
    payload,
    index,
  } = props;
  const fill = fillFor(payload?.source);
  return (
    <path
      key={`fn-link-${index}`}
      d={`M${sourceX},${sourceY}C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
      fill="none"
      stroke={fill}
      strokeOpacity={0.5}
      strokeWidth={Math.max(linkWidth, 1)}
    />
  );
}

function FunnelTooltip({ payload, total }) {
  if (!payload || !payload.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;

  // Recharts passes either a link (has .source/.target objects) or a node.
  if (p.source && p.target && typeof p.value === "number") {
    const v = p.value;
    const pct = total > 0 ? ((v / total) * 100).toFixed(1) : "0.0";
    return (
      <div className="bg-white border border-slate-200 rounded shadow-md px-2.5 py-1.5 text-xs">
        <div className="font-medium text-slate-900">
          {p.source.name} <span className="text-slate-400">→</span> {p.target.name}
        </div>
        <div className="text-slate-600 mt-0.5">
          {v} lead{v === 1 ? "" : "s"} · {pct}%
        </div>
      </div>
    );
  }

  const pct = total > 0 ? ((p.count / total) * 100).toFixed(1) : "0.0";
  return (
    <div className="bg-white border border-slate-200 rounded shadow-md px-2.5 py-1.5 text-xs">
      <div className="font-medium text-slate-900">{p.name}</div>
      <div className="text-slate-600 mt-0.5">
        {p.count} lead{p.count === 1 ? "" : "s"} · {pct}%
      </div>
    </div>
  );
}

export function FunnelSankey({ data, total, height = 280 }) {
  if (!data || data.links.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-slate-400 text-sm italic"
        style={{ height }}
      >
        No leads in this timeframe yet — adjust the filter or wait for new prospects.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <Sankey
        data={data}
        nodePadding={18}
        nodeWidth={10}
        linkCurvature={0.5}
        iterations={32}
        margin={{ top: 8, right: 120, bottom: 24, left: 110 }}
        node={<FunnelNode />}
        link={<FunnelLink />}
        sort={false}
      >
        <Tooltip content={<FunnelTooltip total={total} />} />
      </Sankey>
    </ResponsiveContainer>
  );
}
