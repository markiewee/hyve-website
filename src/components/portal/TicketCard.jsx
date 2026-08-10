import { useState } from "react";
import { supabase } from "../../lib/supabase";
import CaptainBadge from "./CaptainBadge";

const CATEGORY_BADGE = "bg-secondary text-secondary-foreground";

const STATUS_CONFIG = {
  OPEN: { label: "Open", class: "bg-red-500/15 text-red-300" },
  ACKNOWLEDGED: { label: "Acknowledged", class: "bg-blue-500/15 text-blue-300" },
  IN_PROGRESS: { label: "In Progress", class: "bg-yellow-500/15 text-amber-300" },
  ESCALATED: { label: "Escalated", class: "bg-amber-500/15 text-amber-300" },
  RESOLVED: { label: "Resolved", class: "bg-emerald-500/15 text-emerald-300" },
};

export default function TicketCard({ ticket, onAction, onWithdraw }) {
  const {
    id,
    category,
    status = "OPEN",
    description,
    resolution_note,
    ticket_photos = [],
    rooms,
    created_at,
    submitter,
    is_flagged,
  } = ticket;

  const isCaptainTicket = submitter?.role === "HOUSE_CAPTAIN";

  const [withdrawing, setWithdrawing] = useState(false);

  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.OPEN;
  const unitCode = rooms?.unit_code;
  const dateStr = created_at ? new Date(created_at).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" }) : "";

  const canWithdraw = status === "OPEN" || status === "IN_PROGRESS";

  async function handleWithdraw() {
    if (!window.confirm("Are you sure you want to withdraw this request?")) return;

    setWithdrawing(true);
    try {
      // Delete related photos first
      if (ticket_photos.length > 0) {
        const { error: photosError } = await supabase
          .from("ticket_photos")
          .delete()
          .eq("ticket_id", id);
        if (photosError) throw photosError;
      }

      // Delete the ticket
      const { error: ticketError } = await supabase
        .from("maintenance_tickets")
        .delete()
        .eq("id", id);
      if (ticketError) throw ticketError;

      // Notify parent to refresh if callback provided
      if (onWithdraw) onWithdraw(id);
    } catch (err) {
      console.error("Error withdrawing ticket:", err);
      alert("Failed to withdraw request. Please try again.");
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <div
      className={`rounded-lg p-4 space-y-3 bg-card border ${
        is_flagged ? "border-red-500/50 border-2 ring-1 ring-red-500/25" : ""
      }`}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Flag indicator */}
        {is_flagged && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-500/15 text-red-300"
            title="Flagged urgent"
          >
            <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>flag</span>
            Urgent
          </span>
        )}

        {/* Category badge */}
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_BADGE}`}
        >
          {category}
        </span>

        {/* Status badge */}
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusCfg.class}`}
        >
          {statusCfg.label}
        </span>

        {/* Date + Unit code + Captain badge */}
        <span className="text-xs text-muted-foreground ml-auto flex items-center gap-2">
          {isCaptainTicket && <CaptainBadge size="sm" />}
          {dateStr}
          {unitCode && (
            <span className="font-mono bg-muted px-2 py-0.5 rounded">
              {unitCode}
            </span>
          )}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-foreground leading-relaxed">{description}</p>

      {/* Photo thumbnails */}
      {ticket_photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {ticket_photos.map((photo) => (
            <a
              key={photo.id}
              href={photo.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src={photo.url}
                alt="Ticket photo"
                className="h-16 w-16 object-cover rounded"
              />
            </a>
          ))}
        </div>
      )}

      {/* Resolution note */}
      {resolution_note && (
        <div className="bg-emerald-500/10 border border-emerald-500/25 rounded p-3">
          <p className="text-xs font-medium text-emerald-300 mb-0.5">Resolution</p>
          <p className="text-sm text-emerald-300">{resolution_note}</p>
        </div>
      )}

      {/* Action buttons (captain/admin) */}
      {onAction && (
        <div className="flex flex-wrap gap-2 pt-1">
          {/* Flag toggle, always available unless resolved */}
          {status !== "RESOLVED" && (
            <button
              type="button"
              onClick={() => onAction(id, is_flagged ? "unflag" : "flag")}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors inline-flex items-center gap-1 ${
                is_flagged
                  ? "bg-red-500/15 text-red-300 hover:bg-red-500/25"
                  : "bg-surface-container text-foreground hover:bg-white/5"
              }`}
            >
              <span className="material-symbols-outlined text-[14px]" style={is_flagged ? { fontVariationSettings: "'FILL' 1" } : {}}>flag</span>
              {is_flagged ? "Unflag" : "Flag"}
            </button>
          )}
          {(status === "OPEN" || status === "ESCALATED") && (
            <button
              type="button"
              onClick={() => onAction(id, "acknowledge")}
              className="px-3 py-1 rounded text-xs font-medium bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 transition-colors"
              title="Tell the resident we've seen this"
            >
              Acknowledge
            </button>
          )}
          {(status === "OPEN" || status === "ACKNOWLEDGED" || status === "ESCALATED") && (
            <button
              type="button"
              onClick={() => onAction(id, "assign")}
              className="px-3 py-1 rounded text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
            >
              Assign to me
            </button>
          )}
          {(status === "OPEN" || status === "ACKNOWLEDGED" || status === "IN_PROGRESS") && (
            <button
              type="button"
              onClick={() => onAction(id, "escalate")}
              className="px-3 py-1 rounded text-xs font-medium bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 transition-colors"
            >
              Escalate
            </button>
          )}
          {status !== "RESOLVED" && (
            <button
              type="button"
              onClick={() => onAction(id, "resolve")}
              className="px-3 py-1 rounded text-xs font-medium bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 transition-colors"
            >
              Resolve
            </button>
          )}
        </div>
      )}

      {/* Withdraw button for members */}
      {canWithdraw && (
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={handleWithdraw}
            disabled={withdrawing}
            className="px-3 py-1 rounded text-xs font-medium bg-red-500/15 text-red-300 hover:bg-red-500/25 transition-colors disabled:opacity-50"
          >
            {withdrawing ? "Withdrawing..." : "Withdraw"}
          </button>
        </div>
      )}
    </div>
  );
}
