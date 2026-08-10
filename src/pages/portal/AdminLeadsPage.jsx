// src/pages/portal/AdminLeadsPage.jsx
import { useRef, useState } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useLeads } from "@/hooks/useLeads";
import { LeadColumn } from "@/components/portal/leads/LeadColumn";
import { LeadDrawer } from "@/components/portal/leads/LeadDrawer";
import { AddLeadModal } from "@/components/portal/leads/AddLeadModal";
import { LeadFunnelPanel } from "@/components/portal/leads/LeadFunnelPanel";
import { Button } from "@/components/ui/button";

// Order: prospect lifecycle, then legacy aliases mixed in where they fit semantically.
// 'cold' sits between viewing_done and the closed/lost archive lanes, it's a
// parking lane for leads that went silent but might re-warm, NOT a final state.
const ACTIVE_STATUSES = [
  "new",
  "qualified",
  "viewing_booked",
  "viewed",          // legacy, pairs with viewing_booked/done
  "viewing_done",
  "cold",            // holding lane for silent-but-revivable leads
  "agreement_sent",
];
const ARCHIVED_STATUSES = ["signed", "closed_won", "lost", "closed_lost"];

export default function AdminLeadsPage() {
  const [showArchived, setShowArchived] = useState(false);
  const { leads, loading, error, updateStatus, updateLead, addLead } = useLeads({
    includeArchived: showArchived,
  });
  const [selected, setSelected] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  // Require 8px movement before drag starts, otherwise a click never reaches the card.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Tracks whether the most recent pointer interaction was a drag, so we can
  // suppress the click that fires after a successful drop (the card's onClick
  // runs after dragend, by which time isDragging is already false, see
  // https://github.com/clauderic/dnd-kit/issues/591). Without this guard,
  // every drop also opens the LeadDrawer, which Mark perceived as DnD being
  // broken.
  const justDraggedRef = useRef(false);

  const columns = showArchived ? [...ACTIVE_STATUSES, ...ARCHIVED_STATUSES] : ACTIVE_STATUSES;

  const byStatus = Object.fromEntries(columns.map((s) => [s, []]));
  for (const lead of leads) {
    if (byStatus[lead.status]) byStatus[lead.status].push(lead);
  }

  function handleDragStart() {
    justDraggedRef.current = true;
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    // Keep the suppression flag set just long enough for the synthetic click
    // (fired right after pointerup) to bail out inside handleCardClick.
    setTimeout(() => {
      justDraggedRef.current = false;
    }, 0);

    if (!over) return;
    // Allow drops anywhere in the active board, even if the showArchived
    // toggle is off and the target is currently hidden. Validate against the
    // full status whitelist instead of the visible columns subset.
    const allStatuses = [...ACTIVE_STATUSES, ...ARCHIVED_STATUSES];
    if (!allStatuses.includes(over.id)) return;

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
    if (justDraggedRef.current) return;
    setSelected(lead);
    setDrawerOpen(true);
  }

  async function handleArchive(leadId, status) {
    try {
      await updateStatus(leadId, status);
    } catch (e) {
      console.error("Archive failed", e);
    }
  }

  return (
    <div className="p-4 max-w-[1800px] mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-[34px] leading-[1.05] text-foreground">Leads</h1>
          <p className="text-sm text-foreground-variant">
            {loading ? "Loading…" : `${leads.length} active prospect${leads.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setAddOpen(true)}>+ Add lead</Button>
          <Button variant="outline" onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? "Hide archived" : "Show archived"}
          </Button>
        </div>
      </div>

      <LeadFunnelPanel />

      {error && (
        <div className="mb-3 text-sm text-red-300 bg-red-500/10 border border-red-500/25 rounded px-3 py-2">
          Failed to load leads: {error.message || String(error)}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4">
          {columns.map((status) => (
            <LeadColumn
              key={status}
              status={status}
              leads={byStatus[status]}
              onCardClick={handleCardClick}
              onArchive={handleArchive}
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

      <AddLeadModal
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreate={addLead}
      />
    </div>
  );
}
