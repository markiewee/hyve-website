// src/pages/portal/AdminLeadsPage.jsx
import { useState } from "react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { useLeads } from "@/hooks/useLeads";
import { LeadColumn } from "@/components/portal/leads/LeadColumn";
import { LeadDrawer } from "@/components/portal/leads/LeadDrawer";
import { Button } from "@/components/ui/button";

// Order: prospect lifecycle, then legacy aliases mixed in where they fit semantically
const ACTIVE_STATUSES = [
  "new",
  "qualified",
  "viewing_booked",
  "viewed",          // legacy — pairs with viewing_booked/done
  "viewing_done",
  "agreement_sent",
];
const ARCHIVED_STATUSES = ["signed", "closed_won", "lost", "closed_lost", "cold"];

export default function AdminLeadsPage() {
  const [showArchived, setShowArchived] = useState(false);
  const { leads, loading, error, updateStatus, updateLead } = useLeads({
    includeArchived: showArchived,
  });
  const [selected, setSelected] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const columns = showArchived ? [...ACTIVE_STATUSES, ...ARCHIVED_STATUSES] : ACTIVE_STATUSES;

  const byStatus = Object.fromEntries(columns.map((s) => [s, []]));
  for (const lead of leads) {
    if (byStatus[lead.status]) byStatus[lead.status].push(lead);
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || !columns.includes(over.id)) return;
    const lead = leads.find((l) => l.id === active.id);
    if (lead && lead.status !== over.id) {
      try {
        await updateStatus(lead.id, over.id);
      } catch (e) {
        console.error("Status update failed", e);
      }
    }
  }

  function handleCardClick(lead) {
    setSelected(lead);
    setDrawerOpen(true);
  }

  return (
    <div className="p-4 max-w-[1800px] mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="text-sm text-slate-500">
            {loading ? "Loading…" : `${leads.length} active prospect${leads.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Button variant="outline" onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? "Hide archived" : "Show archived"}
        </Button>
      </div>

      {error && (
        <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          Failed to load leads: {error.message || String(error)}
        </div>
      )}

      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {columns.map((status) => (
            <LeadColumn
              key={status}
              status={status}
              leads={byStatus[status]}
              onCardClick={handleCardClick}
            />
          ))}
        </div>
      </DndContext>

      <LeadDrawer
        lead={selected}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSave={(draft) => updateLead(draft.id, draft)}
      />
    </div>
  );
}
