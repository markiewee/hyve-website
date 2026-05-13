import { useDraggable } from "@dnd-kit/core";
import { evaluateReadiness } from "@/lib/viewingReadiness";

const SOURCE_BADGES = {
  airbnb: "bg-rose-100 text-rose-700",
  propertyguru: "bg-orange-100 text-orange-700",
  carousell: "bg-red-100 text-red-700",
  roomies: "bg-blue-100 text-blue-700",
  whatsapp_direct: "bg-green-100 text-green-700",
  agent_referral: "bg-purple-100 text-purple-700",
  organic: "bg-emerald-100 text-emerald-700",
  other: "bg-slate-100 text-slate-700",
};

// Days since last message above which a card is "stale" for its column.
const STALE_WINDOWS = {
  qualified: 14,
  viewing_done: 7,
  agreement_sent: 7,
};

function isStale(lead) {
  const days = STALE_WINDOWS[lead.status];
  if (!days || !lead.last_message_at) return false;
  const ageMs = Date.now() - new Date(lead.last_message_at).getTime();
  return ageMs > days * 86400000;
}

function timeAgo(iso) {
  if (!iso) return "—";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

export function LeadCard({ lead, onClick }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  const stale = isStale(lead);
  const readiness = evaluateReadiness(lead);

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.5 : 1 }
    : undefined;

  const badgeClass = SOURCE_BADGES[lead.source] || SOURCE_BADGES.other;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        // Only treat as click if not a drag
        if (!isDragging) onClick?.(lead);
      }}
      className={`bg-white rounded-md shadow-sm p-3 mb-2 cursor-grab active:cursor-grabbing
        border-2 ${stale ? "border-yellow-400" : "border-transparent"}
        hover:shadow-md transition-shadow select-none`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="font-medium text-sm truncate">{lead.name || "(no name)"}</div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${badgeClass} whitespace-nowrap`}>
          {lead.source}
        </span>
      </div>

      <div
        className={`inline-flex items-center gap-1 mb-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
          readiness.ready
            ? "bg-emerald-100 text-emerald-700"
            : "bg-amber-50 text-amber-700 border border-amber-200"
        }`}
        title={
          readiness.ready
            ? "All viewing prerequisites met"
            : `Missing: ${readiness.missing.join(", ")}`
        }
      >
        {readiness.ready ? "✓ viewing-ready" : `${readiness.met}/${readiness.total} ready`}
      </div>
      {lead.prospect_summary ? (
        <div className="text-xs text-slate-700 line-clamp-3 mb-2 italic">
          {lead.prospect_summary}
        </div>
      ) : lead.last_message_excerpt ? (
        <div className="text-xs text-slate-600 line-clamp-2 mb-2">
          {lead.last_message_excerpt}
        </div>
      ) : null}
      {lead.matched_room_codes?.length > 0 && (
        <div className="text-[11px] text-slate-500 mb-1">
          {lead.matched_room_codes.join(", ")}
        </div>
      )}
      <div className="text-[10px] text-slate-400">⏱ {timeAgo(lead.last_message_at)}</div>
    </div>
  );
}
