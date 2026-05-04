import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useTickets } from "../../hooks/useTickets";
import { supabase } from "../../lib/supabase";
import { notifyTicketStatusChange } from "../../lib/notify";
import PortalLayout from "../../components/portal/PortalLayout";
import TicketCard from "../../components/portal/TicketCard";

const OPEN_STATUSES = ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "ESCALATED"];

// Sort: flagged first, then by created_at desc (newer first within each group).
function sortByFlagThenDate(a, b) {
  if (!!a.is_flagged !== !!b.is_flagged) return a.is_flagged ? -1 : 1;
  return new Date(b.created_at) - new Date(a.created_at);
}

export default function PropertyTicketsPage() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === "ADMIN" || profile?.role === "SUPER_ADMIN";
  const captainPropertyId = profile?.property_id ?? profile?.rooms?.property_id;

  const [propertyFilter, setPropertyFilter] = useState("ALL");
  const [allProperties, setAllProperties] = useState([]);

  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from("properties")
      .select("id, name, code")
      .order("name")
      .then(({ data }) => setAllProperties(data ?? []));
  }, [isAdmin]);

  const scope = isAdmin
    ? propertyFilter === "ALL"
      ? "all"
      : "property"
    : "property";
  const propertyIdForQuery = isAdmin
    ? propertyFilter === "ALL"
      ? null
      : propertyFilter
    : captainPropertyId;

  const { tickets, loading } = useTickets(null, propertyIdForQuery, scope);

  const openTickets = tickets
    .filter((t) => OPEN_STATUSES.includes(t.status))
    .sort(sortByFlagThenDate);
  const resolvedTickets = tickets
    .filter((t) => !OPEN_STATUSES.includes(t.status))
    .sort(sortByFlagThenDate);

  async function handleAction(ticketId, action) {
    let updates = {};

    if (action === "flag") {
      updates = { is_flagged: true };
    } else if (action === "unflag") {
      updates = { is_flagged: false };
    } else if (action === "acknowledge") {
      updates = {
        status: "ACKNOWLEDGED",
        acknowledged_by: user.id,
        acknowledged_at: new Date().toISOString(),
      };
    } else if (action === "assign") {
      updates = { status: "IN_PROGRESS", assigned_to: user.id };
    } else if (action === "escalate") {
      updates = { status: "ESCALATED" };
    } else if (action === "resolve") {
      const note = window.prompt("Resolution note (optional):");
      if (note === null) return;
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

    const ticket = tickets.find((t) => t.id === ticketId);
    if (ticket && updates.status) {
      await notifyTicketStatusChange(ticket, updates.status, updates.resolution_note);
    }
  }

  return (
    <PortalLayout>
      {/* Page header */}
      <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a] tracking-tight">
            {isAdmin ? "All Tickets" : "Property Tickets"}
            {!loading && openTickets.length > 0 && (
              <span className="ml-3 font-['Manrope'] text-lg font-semibold text-[#6c7a77]">
                ({openTickets.length} open)
              </span>
            )}
          </h1>
          <p className="text-[#6c7a77] font-['Manrope'] font-medium mt-1">
            {isAdmin
              ? "Review and action maintenance tickets across all properties."
              : "Manage and action maintenance tickets for this property."}
          </p>
        </div>

        {isAdmin && (
          <select
            value={propertyFilter}
            onChange={(e) => setPropertyFilter(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm bg-white"
          >
            <option value="ALL">All Properties</option>
            {allProperties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-6 border border-[#bbcac6]/15 shadow-sm space-y-3"
            >
              <div className="flex gap-3">
                <div className="h-5 w-20 bg-[#eff4ff] animate-pulse rounded-full" />
                <div className="h-5 w-16 bg-[#eff4ff] animate-pulse rounded-full" />
              </div>
              <div className="h-4 w-3/4 bg-[#eff4ff] animate-pulse rounded" />
              <div className="h-4 w-1/2 bg-[#eff4ff] animate-pulse rounded" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {openTickets.length === 0 && resolvedTickets.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 border border-[#bbcac6]/15 shadow-sm flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-[#eff4ff] rounded-2xl flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-[#006b5f] text-[32px]">check_circle</span>
              </div>
              <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a] text-lg mb-2">
                No tickets
              </h3>
              <p className="text-[#6c7a77] font-['Manrope'] text-sm">
                {isAdmin && propertyFilter === "ALL"
                  ? "There are no maintenance tickets in any property."
                  : "This property has no maintenance tickets."}
              </p>
            </div>
          ) : (
            <>
              {/* Open tickets */}
              {openTickets.length > 0 && (
                <div className="mb-8">
                  <h2 className="font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-4">
                    Open ({openTickets.length})
                  </h2>
                  <div className="space-y-4">
                    {openTickets.map((ticket) => (
                      <TicketCard key={ticket.id} ticket={ticket} onAction={handleAction} />
                    ))}
                  </div>
                </div>
              )}

              {/* Resolved tickets */}
              {resolvedTickets.length > 0 && (
                <div>
                  <h2 className="font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-4">
                    Resolved ({resolvedTickets.length})
                  </h2>
                  <div className="space-y-4">
                    {resolvedTickets.map((ticket) => (
                      <TicketCard key={ticket.id} ticket={ticket} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </PortalLayout>
  );
}
