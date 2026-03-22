import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { useRentPayments } from "../../hooks/useRentPayments";
import PortalLayout from "../../components/portal/PortalLayout";
import InvoiceCard from "../../components/portal/InvoiceCard";
import RentPaymentCard from "../../components/portal/RentPaymentCard";

export default function BillingPage() {
  const { profile } = useAuth();
  const roomId = profile?.room_id;
  const profileId = profile?.id;

  const { payments: rentPayments, loading: rentLoading } = useRentPayments(profileId);

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) {
      setLoading(false);
      return;
    }

    supabase
      .from("ac_monthly_usage")
      .select("*")
      .eq("room_id", roomId)
      .order("month", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error("Error fetching billing history:", error);
        }
        setInvoices(data ?? []);
        setLoading(false);
      });
  }, [roomId]);

  const lateFeePerDay = profile?.late_fee_per_day ?? 5;

  const pendingRent = rentPayments.filter((p) => p.status !== "PAID").length;
  const totalOwed = rentPayments
    .filter((p) => p.status !== "PAID")
    .reduce((sum, p) => sum + (Number(p.amount_due) || 0), 0);

  return (
    <PortalLayout>
      {/* Page header */}
      <div className="mb-10">
        <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a] tracking-tight">
          Billing & Payments
        </h1>
        <p className="text-[#6c7a77] font-['Manrope'] font-medium mt-1">
          Manage your rent payments and AC usage charges.
        </p>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
        {/* Outstanding balance — prominent card */}
        <div className="sm:col-span-2 bg-[#006b5f] rounded-2xl p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -mr-20 -mt-20 pointer-events-none" />
          <p className="font-['Inter'] text-xs uppercase tracking-widest text-[#71f8e4]/80 font-bold mb-2">
            Outstanding Balance
          </p>
          <p className="font-['Plus_Jakarta_Sans'] text-5xl font-black text-white mb-4">
            ${totalOwed.toLocaleString("en-SG", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-white/60 font-['Manrope'] text-sm">
            {pendingRent} payment{pendingRent !== 1 ? "s" : ""} pending
          </p>
        </div>

        {/* Rent amount stat */}
        <div className="bg-white rounded-2xl p-6 border border-[#bbcac6]/15 shadow-sm flex flex-col justify-between">
          <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-3">
            Monthly Rent
          </p>
          <p className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a]">
            {profile?.rooms?.rent_amount
              ? `$${Number(profile.rooms.rent_amount).toLocaleString("en-SG", { minimumFractionDigits: 2 })}`
              : "—"}
          </p>
          <p className="text-[#6c7a77] font-['Manrope'] text-xs mt-2">Due 1st of each month</p>
        </div>
      </div>

      {/* Rent Payments section */}
      <section className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm mb-8">
        <div className="px-8 py-6 border-b border-[#bbcac6]/15 flex items-center justify-between">
          <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#121c2a] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#006b5f] text-[20px]">receipt_long</span>
            Rent Payments
          </h2>
        </div>

        {rentLoading ? (
          <div className="divide-y divide-[#bbcac6]/15">
            {[1, 2, 3].map((i) => (
              <div key={i} className="px-8 py-5 flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-4 w-28 bg-[#eff4ff] animate-pulse rounded" />
                  <div className="h-3 w-20 bg-[#eff4ff] animate-pulse rounded" />
                </div>
                <div className="h-5 w-16 bg-[#eff4ff] animate-pulse rounded-full" />
              </div>
            ))}
          </div>
        ) : rentPayments.length === 0 ? (
          <div className="px-8 py-12 text-center">
            <p className="text-[#6c7a77] font-['Manrope'] text-sm">No rent records yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#bbcac6]/10">
            {rentPayments.map((payment) => (
              <RentPaymentCard
                key={payment.id}
                payment={payment}
                lateFeePerDay={lateFeePerDay}
              />
            ))}
          </div>
        )}
      </section>

      {/* AC Usage Billing section */}
      <section className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm">
        <div className="px-8 py-6 border-b border-[#bbcac6]/15 flex items-center justify-between">
          <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#121c2a] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#006b5f] text-[20px]">ac_unit</span>
            AC Usage History
          </h2>
        </div>

        {loading ? (
          <div className="divide-y divide-[#bbcac6]/15">
            {[1, 2, 3].map((i) => (
              <div key={i} className="px-8 py-5 flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-4 w-28 bg-[#eff4ff] animate-pulse rounded" />
                  <div className="h-3 w-20 bg-[#eff4ff] animate-pulse rounded" />
                </div>
                <div className="h-5 w-16 bg-[#eff4ff] animate-pulse rounded-full" />
              </div>
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <div className="px-8 py-12 text-center">
            <p className="text-[#6c7a77] font-['Manrope'] text-sm">No billing history yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#bbcac6]/10">
            {invoices.map((invoice) => (
              <InvoiceCard key={invoice.id} invoice={invoice} />
            ))}
          </div>
        )}
      </section>
    </PortalLayout>
  );
}
