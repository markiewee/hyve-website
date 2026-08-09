import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { useRentPayments } from "../../hooks/useRentPayments";
import { useInvoices } from "../../hooks/useInvoices";
import { useNavigate } from "react-router-dom";
import PortalLayout from "../../components/portal/PortalLayout";
import InvoiceCard from "../../components/portal/InvoiceCard";
import RentPaymentCard from "../../components/portal/RentPaymentCard";
import ReceiptModal from "../../components/portal/ReceiptModal";

export default function BillingPage() {
  const { profile } = useAuth();
  const roomId = profile?.room_id;
  const profileId = profile?.id;

  const navigate = useNavigate();

  const { payments: rentPayments, loading: rentLoading } = useRentPayments(profileId);
  const { invoices: tenantInvoices } = useInvoices(profileId);

  // Map rent payment month to matching invoice for click-through
  const invoiceByMonth = {};
  for (const inv of tenantInvoices) {
    if (inv.month) invoiceByMonth[inv.month] = inv;
  }

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [receiptPayment, setReceiptPayment] = useState(null);
  const [charges, setCharges] = useState([]);
  const [chargesLoading, setChargesLoading] = useState(true);

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

  useEffect(() => {
    if (!profileId) {
      setChargesLoading(false);
      return;
    }
    supabase
      .from("member_charges")
      .select("*")
      .eq("tenant_profile_id", profileId)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error("Error fetching charges:", error);
        setCharges(data ?? []);
        setChargesLoading(false);
      });
  }, [profileId]);

  const lateFeePerDay = profile?.late_fee_per_day ?? 5;

  const pendingRent = rentPayments.filter((p) => p.status !== "PAID").length;
  const overdueRent = rentPayments.filter((p) => p.status === "OVERDUE").length;
  const hasOverdue = overdueRent > 0;
  const rentOwed = rentPayments
    .filter((p) => p.status !== "PAID")
    .reduce((sum, p) => sum + (Number(p.amount_due || p.rent_amount) || 0), 0);
  const chargesOwed = charges
    .filter((c) => c.status !== "PAID")
    .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const totalOwed = rentOwed + chargesOwed;
  const pendingChargesCount = charges.filter((c) => c.status !== "PAID").length;

  const tenantInfo = {
    name: profile?.full_name ?? profile?.name ?? "Member",
    email: profile?.email ?? null,
    room: profile?.rooms?.unit_code ?? profile?.rooms?.name ?? "—",
    property: profile?.properties?.name ?? null,
  };

  return (
    <PortalLayout>
      {/* Page header */}
      <div className="mb-10">
        <span className="block font-mono text-[11px] uppercase tracking-[0.28em] text-accent mb-3">Billing</span>
        <h1 className="font-display text-[34px] leading-[1.05] text-foreground">
          Billing & Payments
        </h1>
        <p className="text-foreground-variant mt-2 max-w-[62ch]">
          Manage your rent payments and AC usage charges.
        </p>
      </div>

      {/* Summary stat cards */}
      <div className={`grid grid-cols-1 ${profile?.role !== "ADMIN" ? "sm:grid-cols-3" : "sm:grid-cols-1"} gap-6 mb-10`}>
        {/* Outstanding balance — red when overdue, teal when ok */}
        <div className={`sm:col-span-2 p-8 relative overflow-hidden ${hasOverdue ? "bg-[#6E2A1F]" : "bg-[#0E2E20]"}`}>
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20 pointer-events-none" />
          <p className={`font-mono text-[11px] uppercase tracking-[0.22em] mb-3 ${hasOverdue ? "text-[#F0C9BF]" : "text-[#7FA692]"}`}>
            {hasOverdue ? "Overdue Balance" : "Outstanding Balance"}
          </p>
          <p className="font-mono text-[52px] leading-none font-bold tabular-nums tracking-tight text-[#C6A467] mb-5">
            ${totalOwed.toLocaleString("en-SG", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[#EDE6DA]/85 text-sm">
            {hasOverdue
              ? `${overdueRent} overdue payment${overdueRent !== 1 ? "s" : ""} — please pay immediately`
              : `${pendingRent} rent payment${pendingRent !== 1 ? "s" : ""}${pendingChargesCount > 0 ? ` + ${pendingChargesCount} charge${pendingChargesCount !== 1 ? "s" : ""}` : ""} pending`}
          </p>
          {hasOverdue && (
            <div className="mt-3 flex items-center gap-2 text-[#F0C9BF]">
              <span className="material-symbols-outlined text-[18px]">warning</span>
              <span className="font-mono text-xs">Late fees are accruing at SGD {lateFeePerDay}/day</span>
            </div>
          )}
        </div>

        {/* Rent amount stat — hidden for admin */}
        {profile?.role !== "ADMIN" && (
          <div className="bg-surface p-6 border border-border flex flex-col justify-between">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-foreground-variant mb-3">
              Monthly Rent
            </p>
            <p className="font-mono text-3xl font-bold tabular-nums tracking-tight text-foreground">
              {(profile?.monthly_rent || profile?.rooms?.rent_amount)
                ? `$${Number(profile.monthly_rent || profile.rooms?.rent_amount).toLocaleString("en-SG", { minimumFractionDigits: 2 })}`
                : "—"}
            </p>
            <p className="text-foreground-variant text-xs mt-2">Due 1st of each month</p>
          </div>
        )}
      </div>

      {/* Rent Payments section */}
      <section className="bg-surface border border-border mb-8">
        <div className="px-8 py-6 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-xl text-foreground flex items-center gap-2">
            <span className="material-symbols-outlined text-accent text-[20px]">receipt_long</span>
            Rent Payments
          </h2>
        </div>

        {rentLoading ? (
          <div className="divide-y divide-white/10">
            {[1, 2, 3].map((i) => (
              <div key={i} className="px-8 py-5 flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-4 w-28 bg-surface-container animate-pulse rounded" />
                  <div className="h-3 w-20 bg-surface-container animate-pulse rounded" />
                </div>
                <div className="h-5 w-16 bg-surface-container animate-pulse rounded-full" />
              </div>
            ))}
          </div>
        ) : rentPayments.length === 0 ? (
          <div className="px-8 py-12 text-center">
            <p className="text-foreground-variant text-sm">Norent records yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {rentPayments.map((payment) => {
              const matchingInvoice = invoiceByMonth[payment.month];
              return (
              <div
                key={payment.id}
                className={`flex items-center justify-between px-8 py-4${matchingInvoice ? " cursor-pointer hover:bg-white/5 transition-colors" : ""}`}
                onClick={matchingInvoice ? () => navigate(`/portal/billing/${matchingInvoice.id}`) : undefined}
              >
                <div className="flex-1 min-w-0">
                  <RentPaymentCard
                    payment={payment}
                    lateFeePerDay={lateFeePerDay}
                  />
                </div>
                {payment.status === "PAID" && (
                  <button
                    onClick={() => setReceiptPayment({ ...payment, _type: "rent" })}
                    className="ml-4 shrink-0 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-accent border border-accent/40 rounded-full hover:bg-accent/10 whitespace-nowrap"
                  >
                    Receipt
                  </button>
                )}
              </div>
              );
            })}
          </div>
        )}
      </section>

      {/* AC Usage Billing section */}
      <section className="bg-surface border border-border">
        <div className="px-8 py-6 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-xl text-foreground flex items-center gap-2">
            <span className="material-symbols-outlined text-accent text-[20px]">ac_unit</span>
            AC Usage History
          </h2>
        </div>

        {loading ? (
          <div className="divide-y divide-white/10">
            {[1, 2, 3].map((i) => (
              <div key={i} className="px-8 py-5 flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-4 w-28 bg-surface-container animate-pulse rounded" />
                  <div className="h-3 w-20 bg-surface-container animate-pulse rounded" />
                </div>
                <div className="h-5 w-16 bg-surface-container animate-pulse rounded-full" />
              </div>
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <div className="px-8 py-12 text-center">
            <p className="text-foreground-variant text-sm">Nobilling history yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="relative group">
                <InvoiceCard invoice={invoice} />
                {invoice.status === "PAID" && (
                  <div className="absolute right-8 top-1/2 -translate-y-1/2">
                    <button
                      onClick={() => setReceiptPayment({ ...invoice, _type: "ac" })}
                      className="text-xs font-medium text-accent hover:underline whitespace-nowrap"
                    >
                      Receipt
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
      {/* Other Charges section */}
      <section className="bg-surface border border-border mt-8">
        <div className="px-8 py-6 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-xl text-foreground flex items-center gap-2">
            <span className="material-symbols-outlined text-accent text-[20px]">payments</span>
            Other Charges
          </h2>
        </div>

        {chargesLoading ? (
          <div className="divide-y divide-white/10">
            {[1, 2].map((i) => (
              <div key={i} className="px-8 py-5 flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-4 w-28 bg-surface-container animate-pulse rounded" />
                  <div className="h-3 w-20 bg-surface-container animate-pulse rounded" />
                </div>
                <div className="h-5 w-16 bg-surface-container animate-pulse rounded-full" />
              </div>
            ))}
          </div>
        ) : charges.length === 0 ? (
          <div className="px-8 py-12 text-center">
            <p className="text-foreground-variant text-sm">Noadditional charges.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {charges.map((charge) => {
              const isPaid = charge.status === "PAID";
              return (
                <div key={charge.id} className={`px-8 py-5 flex items-center justify-between ${!isPaid ? "bg-amber-500/10" : ""}`}>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-['Inter'] font-bold text-sm text-foreground">
                        {charge.description}
                      </p>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full font-mono text-[11px] uppercase tracking-[0.12em] bg-surface-container text-foreground-variant">
                        {charge.category?.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-foreground-variant font-['Inter']">
                      <span>
                        Due: {charge.due_date ? new Date(charge.due_date).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                      </span>
                      <span>
                        Created: {new Date(charge.created_at).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-mono text-sm font-medium tabular-nums text-foreground">
                      ${Number(charge.amount).toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-mono text-[11px] uppercase tracking-[0.12em] ${
                      isPaid ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"
                    }`}>
                      {charge.status}
                    </span>
                    {!isPaid && (
                      <>
                        <button
                          onClick={() => setReceiptPayment({ ...charge, _type: "charge", _mode: "invoice" })}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-accent/40 text-accent font-mono text-[11px] uppercase tracking-[0.12em] hover:bg-accent/10"
                        >
                          <span className="material-symbols-outlined text-[14px]">receipt</span>
                          Invoice
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const { data: { session } } = await supabase.auth.getSession();
                              const res = await fetch("/api/portal/deposit-checkout", {
                                method: "POST",
                                headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
                                body: JSON.stringify({ type: "charge", charge_id: charge.id }),
                              });
                              const body = await res.json();
                              if (body.checkout_url) window.location.href = body.checkout_url;
                              else alert(body.error || "Payment failed");
                            } catch { alert("Payment failed"); }
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary text-primary-foreground font-mono text-[11px] uppercase tracking-[0.12em] hover:opacity-90"
                        >
                          <span className="material-symbols-outlined text-[14px]">credit_card</span>
                          Pay
                        </button>
                      </>
                    )}
                    {isPaid && (
                      <button
                        onClick={() => setReceiptPayment({ ...charge, _type: "charge" })}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-accent/40 text-accent font-mono text-[11px] uppercase tracking-[0.12em] hover:bg-accent/10"
                      >
                        <span className="material-symbols-outlined text-[14px]">receipt</span>
                        Receipt
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Receipt modal */}
      {receiptPayment && (
        <ReceiptModal
          payment={receiptPayment}
          tenantInfo={tenantInfo}
          onClose={() => setReceiptPayment(null)}
        />
      )}
    </PortalLayout>
  );
}
