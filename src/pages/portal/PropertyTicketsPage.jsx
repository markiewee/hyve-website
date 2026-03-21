import { useAuth } from "../../hooks/useAuth";
import { useTickets } from "../../hooks/useTickets";
import { supabase } from "../../lib/supabase";
import { notifyTicketStatusChange } from "../../lib/notify";
import PortalLayout from "../../components/portal/PortalLayout";
import TicketCard from "../../components/portal/TicketCard";

const OPEN_STATUSES = ["OPEN", "IN_PROGRESS", "ESCALATED"];

export default function PropertyTicketsPage() {
  const { user, profile } = useAuth();
  const propertyId = profile?.property_id ?? profile?.rooms?.property_id;

  const { tickets, loading } = useTickets(null, propertyId, "property");

  const openTickets = tickets.filter((t) => OPEN_STATUSES.includes(t.status));
  const resolvedTickets = tickets.filter((t) => !OPEN_STATUSES.includes(t.status));

  async function handleAction(ticketId, action) {
    let updates = {};

    if (action === "assign") {
      updates = { status: "IN_PROGRESS", assigned_to: user.id };
    } else if (action === "escalate") {
      updates = { status: "ESCALATED" };
    } else if (action === "resolve") {
      const note = window.prompt("Resolution note (optional):");
      if (note === null) return; // user cancelled
      updates = {
        status: "RESOLVED",
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
        resolution_note: note || null,
      };
    }

    const { error } = await supabase
      .from("maintenance_tickets")
      .update(updates)
      .eq("id", ticketId);

    if (error) {
      console.error("Error updating ticket:", error);
      return;
    }

    // Fire-and-forget email notification to the tenant
    const ticket = tickets.find((t) => t.id === ticketId);
    if (ticket && updates.status) {
      await notifyTicketStatusChange(
        ticket,
        updates.status,
        updates.resolution_note
      );
    }
  }

  return (
    <PortalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          Property Tickets
          {!loading && (
            <span className="ml-2 text-base font-medium text-muted-foreground">
              ({openTickets.length} open)
            </span>
          )}
        </h1>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded-lg p-4 space-y-3">
              <div className="flex gap-2">
                <div className="h-5 w-20 bg-gray-100 animate-pulse rounded" />
                <div className="h-5 w-16 bg-gray-100 animate-pulse rounded" />
              </div>
              <div className="h-4 w-3/4 bg-gray-100 animate-pulse rounded" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Open tickets */}
          {openTickets.length === 0 ? (
            <p className="text-sm text-muted-foreground mb-8">No open tickets.</p>
          ) : (
            <div className="space-y-4 mb-8">
              {openTickets.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  onAction={handleAction}
                />
              ))}
            </div>
          )}

          {/* Resolved tickets */}
          {resolvedTickets.length > 0 && (
            <>
              <h2 className="text-base font-semibold text-muted-foreground mb-3">
                Resolved ({resolvedTickets.length})
              </h2>
              <div className="space-y-4">
                {resolvedTickets.map((ticket) => (
                  <TicketCard key={ticket.id} ticket={ticket} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </PortalLayout>
  );
}
