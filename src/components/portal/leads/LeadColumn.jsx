// src/components/portal/leads/LeadColumn.jsx
import { useDroppable } from "@dnd-kit/core";
import { LeadCard } from "./LeadCard";

const COLUMN_LABELS = {
  new: "New",
  qualified: "Qualified",
  viewing_booked: "Viewing Booked",
  viewed: "Viewed (legacy)",
  viewing_done: "Viewing Done",
  agreement_sent: "Agreement Sent",
  signed: "Signed",
  closed_won: "Closed Won (legacy)",
  lost: "Lost",
  closed_lost: "Closed Lost (legacy)",
  cold: "Cold",
};

export function LeadColumn({ status, leads, onCardClick }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex flex-col min-w-[260px] w-[260px] bg-slate-50 rounded-lg p-2 flex-shrink-0">
      <div className="px-1 pb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">{COLUMN_LABELS[status] || status}</h3>
        <span className="text-xs text-slate-500 bg-white px-1.5 py-0.5 rounded">
          {leads.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[200px] rounded transition-colors p-1 ${
          isOver ? "bg-slate-200" : ""
        }`}
      >
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} onClick={onCardClick} />
        ))}
        {leads.length === 0 && (
          <div className="text-xs text-slate-400 italic px-2 py-4">No leads</div>
        )}
      </div>
    </div>
  );
}
