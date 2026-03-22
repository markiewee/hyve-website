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
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a] tracking-tight">
            My Issues
          </h1>
          <p className="text-[#6c7a77] font-['Manrope'] font-medium mt-1">
            Track and manage your reported maintenance requests.
          </p>
        </div>
        <Link
          to="/portal/issues/new"
          className="bg-[#006b5f] text-white px-6 py-3 rounded-xl font-['Manrope'] font-bold text-sm hover:opacity-90 transition-all flex items-center gap-2 shadow-sm shadow-[#006b5f]/20"
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
      ) : tickets.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-[#bbcac6]/15 shadow-sm flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-[#eff4ff] rounded-2xl flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[#006b5f] text-[32px]">build_circle</span>
          </div>
          <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a] text-lg mb-2">
            No issues reported
          </h3>
          <p className="text-[#6c7a77] font-['Manrope'] text-sm mb-6">
            Everything looking good? If something needs attention, let us know.
          </p>
          <Link
            to="/portal/issues/new"
            className="bg-[#006b5f] text-white px-6 py-3 rounded-xl font-['Manrope'] font-bold text-sm hover:opacity-90 transition-all flex items-center gap-2"
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
