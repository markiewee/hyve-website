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
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6 mb-8">
        <div>
          <span className="block font-mono text-[11px] uppercase tracking-[0.28em] text-accent mb-3">Maintenance</span>
          <h1 className="font-display text-[34px] leading-[1.05] text-foreground">
            My Issues
          </h1>
          <p className="text-foreground-variant mt-2 max-w-[62ch]">
            Track and manage your reported maintenance requests.
          </p>
        </div>
        <Link
          to="/portal/issues/new"
          className="bg-primary text-primary-foreground px-6 py-3 rounded-full font-mono text-xs uppercase tracking-[0.16em] whitespace-nowrap hover:opacity-90 transition-opacity flex shrink-0 items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Report Issue
        </Link>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-surface p-6 border border-border space-y-3"
            >
              <div className="flex gap-3">
                <div className="h-5 w-20 bg-white/5 animate-pulse rounded-full" />
                <div className="h-5 w-16 bg-white/5 animate-pulse rounded-full" />
              </div>
              <div className="h-4 w-3/4 bg-white/5 animate-pulse rounded" />
              <div className="h-4 w-1/2 bg-white/5 animate-pulse rounded" />
            </div>
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <div className="border border-dashed border-border p-12 flex flex-col items-center text-center">
          <div className="w-14 h-14 border border-accent/40 bg-accent/10 flex items-center justify-center mb-5">
            <span className="material-symbols-outlined text-accent text-[32px]">build_circle</span>
          </div>
          <h3 className="font-display text-2xl text-foreground mb-2">
            No issues reported
          </h3>
          <p className="text-foreground-variant text-sm mb-6 max-w-[46ch]">
            Everything looking good? If something needs attention, let us know.
          </p>
          <Link
            to="/portal/issues/new"
            className="bg-primary text-primary-foreground px-6 py-3 rounded-full font-mono text-xs uppercase tracking-[0.16em] whitespace-nowrap hover:opacity-90 transition-opacity flex shrink-0 items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Report your first issue
          </Link>
        </div>
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
