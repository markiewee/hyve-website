import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { evaluateReadiness } from "@/lib/viewingReadiness";

const ARCHIVE_OPTIONS = [
  { value: "signed", label: "Mark Signed" },
  { value: "closed_won", label: "Mark Won" },
  { value: "lost", label: "Mark Lost" },
  { value: "closed_lost", label: "Archive (closed_lost)" },
];

const SOURCE_BADGES = {
  airbnb: "bg-pink-500/15 text-pink-300",
  propertyguru: "bg-amber-500/15 text-amber-300",
  carousell: "bg-red-500/15 text-red-300",
  roomies: "bg-blue-500/15 text-blue-300",
  facebook: "bg-blue-500/15 text-blue-300",
  telegram: "bg-blue-500/15 text-blue-300",
  whatsapp_direct: "bg-emerald-500/15 text-emerald-300",
  agent_referral: "bg-purple-500/15 text-purple-300",
  referral: "bg-purple-500/15 text-purple-300",
  organic: "bg-emerald-500/15 text-emerald-300",
  other: "bg-surface-container text-foreground-variant",
};

// Build a sub-source line from intent metadata so Mark can see which
// FB group / Carousell listing / Telegram channel each lead came from.
function buildSubSource(intent) {
  if (!intent || typeof intent !== "object") return null;
  const ch = intent.outreach_channel;
  const handle = intent.outreach_handle;
  const group = intent.fb_group;
  const post = intent.found_via_post || intent.outreach_post_url;
  const listing = intent.carousell_listing_id || intent.propertyguru_listing_id;
  const referrer = intent.referrer_name;

  const parts = [];
  if (ch) parts.push(ch);
  if (group) parts.push(group);
  else if (listing) parts.push(`#${listing}`);
  else if (referrer) parts.push(`ref: ${referrer}`);
  else if (post) parts.push(typeof post === "string" && post.length > 24 ? "post" : `post ${post}`);
  if (handle && !parts.some((p) => String(p).includes(handle))) parts.push(handle);
  return parts.length ? parts.join(" · ") : null;
}

// Days since last message above which a card is "stale" for its column.
const STALE_WINDOWS = {
  qualified: 14,
  viewing_done: 7,
  agreement_sent: 7,
  cold: 30,           // re-warm or move to lost after a month of silence
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

function shortDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-SG", { day: "numeric", month: "short" });
}

export function LeadCard({ lead, onClick, onArchive }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  const stale = isStale(lead);
  const readiness = evaluateReadiness(lead);
  const [menuOpen, setMenuOpen] = useState(false);

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.5 : 1 }
    : undefined;

  const badgeClass = SOURCE_BADGES[lead.source] || SOURCE_BADGES.other;

  function stop(e) {
    e.stopPropagation();
    e.preventDefault();
  }

  function handleArchivePick(e, status) {
    stop(e);
    setMenuOpen(false);
    onArchive?.(lead.id, status);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        if (!isDragging) onClick?.(lead);
      }}
      className={`relative bg-surface rounded-md p-3 mb-2 cursor-grab active:cursor-grabbing
        border-2 ${stale ? "border-amber-400" : "border-border"}
        transition-shadow select-none group`}
    >
      {onArchive && (
        <div
          className="absolute top-1 right-1 z-10"
          onPointerDown={stop}
          onMouseDown={stop}
          onClick={stop}
        >
          <button
            type="button"
            title="Archive lead"
            aria-label="Archive lead"
            onClick={(e) => {
              stop(e);
              setMenuOpen((v) => !v);
            }}
            className="opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity
              w-5 h-5 rounded text-foreground-variant hover:text-foreground hover:bg-white/5
              flex items-center justify-center text-xs leading-none"
          >
            ✕
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-20"
                onPointerDown={(e) => { stop(e); setMenuOpen(false); }}
                onClick={(e) => { stop(e); setMenuOpen(false); }}
              />
              <div className="absolute right-0 top-6 z-30 w-44 bg-surface border border-border rounded-md py-1 text-xs">
                {ARCHIVE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={(e) => handleArchivePick(e, opt.value)}
                    className="w-full text-left px-3 py-1.5 hover:bg-white/5"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      <div className="flex items-start justify-between gap-2 mb-1 pr-5">
        <div className="font-medium text-sm truncate text-foreground">{lead.name || "(no name)"}</div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${badgeClass} whitespace-nowrap`}>
          {lead.source}
        </span>
      </div>
      {(() => {
        const sub = buildSubSource(lead.intent);
        return sub ? (
          <div className="text-[10px] text-foreground-variant mb-1 truncate" title={sub}>
            via {sub}
          </div>
        ) : null;
      })()}

      <div
        className={`inline-flex items-center gap-1 mb-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
          readiness.ready
            ? "bg-emerald-500/15 text-emerald-300"
            : "bg-amber-500/10 text-amber-300 border border-amber-500/25"
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
        <div className="text-xs text-foreground line-clamp-3 mb-2 italic">
          {lead.prospect_summary}
        </div>
      ) : lead.last_message_excerpt ? (
        <div className="text-xs text-foreground-variant line-clamp-2 mb-2">
          {lead.last_message_excerpt}
        </div>
      ) : null}
      {(() => {
        // Quick-glance prospect criteria so Mark can match against inventory
        // without opening the drawer: budget · location · room type · move-in.
        const it = lead.intent || {};
        const chips = [];
        if (it.budget_max) chips.push(`💰 $${Number(it.budget_max).toLocaleString("en-SG")}`);
        if (Array.isArray(it.properties) && it.properties.length) chips.push(`📍 ${it.properties.join("/")}`);
        if (Array.isArray(it.room_types) && it.room_types.length)
          chips.push(it.room_types.map((rt) => rt.charAt(0).toUpperCase() + rt.slice(1)).join("/"));
        if (it.move_in && shortDate(it.move_in)) chips.push(`📥 ${shortDate(it.move_in)}`);
        if (it.tenant_type) chips.push(it.tenant_type.charAt(0).toUpperCase() + it.tenant_type.slice(1));
        return chips.length ? (
          <div className="flex flex-wrap gap-1 mb-2">
            {chips.map((c, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container text-foreground-variant whitespace-nowrap">
                {c}
              </span>
            ))}
          </div>
        ) : null;
      })()}
      {lead.matched_room_codes?.length > 0 && (
        <div className="text-[11px] text-foreground-variant mb-1">
          {lead.matched_room_codes.join(", ")}
        </div>
      )}
      <div className="flex items-center justify-between text-[10px] text-foreground-variant">
        <span>⏱ {timeAgo(lead.last_message_at)}</span>
        {shortDate(lead.date_initiated) && (
          <span title={`Initiated ${new Date(lead.date_initiated).toLocaleString("en-SG")}`}>
            📅 {shortDate(lead.date_initiated)}
          </span>
        )}
      </div>
    </div>
  );
}
