import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useTickets } from "../../hooks/useTickets";
import PortalLayout from "../../components/portal/PortalLayout";
import TicketCard from "../../components/portal/TicketCard";

export default function IssuesPage() {
  const { profile } = useAuth();
  const roomId = profile?.room_id;

  const { tickets, loading } = useTickets(roomId, null, "room");

  return (
    <PortalLayout>
      {/* Page heading + action */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">My Issues</h1>
        <Link
          to="/portal/issues/new"
          className="inline-flex items-center px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Report Issue
        </Link>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="border rounded-lg p-4 space-y-3">
              <div className="flex gap-2">
                <div className="h-5 w-20 bg-gray-100 animate-pulse rounded" />
                <div className="h-5 w-16 bg-gray-100 animate-pulse rounded" />
              </div>
              <div className="h-4 w-3/4 bg-gray-100 animate-pulse rounded" />
            </div>
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No issues reported yet.{" "}
          <Link to="/portal/issues/new" className="text-primary hover:underline">
            Report one now.
          </Link>
        </p>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </PortalLayout>
  );
}
