import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";
import { useAdminInvoices } from "../../hooks/useAdminInvoices";
import { confirm } from "../../lib/confirm";

function formatSGD(amount) {
  if (amount == null) return "$0.00";
  return `$${Number(amount).toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getMonthStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

const STATUS_STYLES = {
  DRAFT: "bg-surface-container text-foreground-variant",
  ISSUED: "bg-amber-500/15 text-amber-300",
  PARTIALLY_PAID: "bg-amber-500/15 text-amber-300",
  PAID: "bg-emerald-500/15 text-emerald-300",
  VOID: "bg-surface-container text-foreground-variant",
};

export default function AdminInvoicesPage() {
  const [properties, setProperties] = useState([]);
  const [filterProperty, setFilterProperty] = useState("");
  const [filterMonth, setFilterMonth] = useState(getMonthStr(new Date()));
  const [filterStatus, setFilterStatus] = useState("");
  const [searchCode, setSearchCode] = useState("");

  // Mark as paid modal
  const [payModal, setPayModal] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payRef, setPayRef] = useState("");
  const [payProcessing, setPayProcessing] = useState(false);

  const { invoices, loading, refetch, markAsPaid, voidInvoice } = useAdminInvoices({
    propertyId: filterProperty || undefined,
    month: filterMonth || undefined,
    status: filterStatus || undefined,
  });

  useEffect(() => {
    supabase
      .from("properties")
      .select("id, name, code")
      .order("name")
      .then(({ data }) => setProperties(data ?? []));
  }, []);

  const filtered = searchCode
    ? invoices.filter((inv) => inv.invoice_code.toLowerCase().includes(searchCode.toLowerCase()))
    : invoices;

  async function handleMarkPaid() {
    if (!payModal || !payAmount) return;
    setPayProcessing(true);
    await markAsPaid(payModal.id, Number(payAmount), payRef);
    setPayModal(null);
    setPayAmount("");
    setPayRef("");
    setPayProcessing(false);
  }

  async function handleVoid(inv) {
    if (!await confirm({ title: `Void invoice ${inv.invoice_code}?` })) return;
    await voidInvoice(inv.id);
  }

  return (
    <PortalLayout>
      <div className="mb-6">
        <span className="block text-[11px] uppercase tracking-[0.4em] font-semibold text-accent mb-3">Admin</span>
        <h2 className="font-display text-2xl font-extrabold text-foreground tracking-tight mb-1">
          Invoice Management
        </h2>
        <p className="text-foreground-variant font-['Inter'] font-medium">
          View, manage, and reconcile tenant invoices.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-surface rounded-2xl p-6 border border-border mb-6">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block font-['Inter'] text-xs uppercase tracking-widest text-foreground-variant font-bold mb-1">Property</label>
            <select
              value={filterProperty}
              onChange={(e) => setFilterProperty(e.target.value)}
              className="bg-surface-container border border-border rounded-xl px-3 py-2 font-['Inter'] text-sm text-foreground"
            >
              <option value="">All</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-['Inter'] text-xs uppercase tracking-widest text-foreground-variant font-bold mb-1">Month</label>
            <input
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="bg-surface-container border border-border rounded-xl px-3 py-2 font-['Inter'] text-sm text-foreground"
            />
          </div>
          <div>
            <label className="block font-['Inter'] text-xs uppercase tracking-widest text-foreground-variant font-bold mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-surface-container border border-border rounded-xl px-3 py-2 font-['Inter'] text-sm text-foreground"
            >
              <option value="">All</option>
              <option value="ISSUED">Issued</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="PAID">Paid</option>
              <option value="VOID">Void</option>
            </select>
          </div>
          <div>
            <label className="block font-['Inter'] text-xs uppercase tracking-widest text-foreground-variant font-bold mb-1">Search Code</label>
            <input
              type="text"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              placeholder="HV-TG-..."
              className="bg-surface-container border border-border rounded-xl px-3 py-2 font-['Inter'] text-sm text-foreground"
            />
          </div>
        </div>
      </div>

      {/* Invoice Table */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-12 text-foreground-variant font-['Inter']">No invoices found.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface-container">
                <th className="text-left px-4 py-3 font-['Inter'] text-xs text-foreground-variant font-semibold">Code</th>
                <th className="text-left px-4 py-3 font-['Inter'] text-xs text-foreground-variant font-semibold">Tenant</th>
                <th className="text-left px-4 py-3 font-['Inter'] text-xs text-foreground-variant font-semibold">Room</th>
                <th className="text-right px-4 py-3 font-['Inter'] text-xs text-foreground-variant font-semibold">Due</th>
                <th className="text-right px-4 py-3 font-['Inter'] text-xs text-foreground-variant font-semibold">Paid</th>
                <th className="text-center px-4 py-3 font-['Inter'] text-xs text-foreground-variant font-semibold">Status</th>
                <th className="text-center px-4 py-3 font-['Inter'] text-xs text-foreground-variant font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filtered.map((inv) => (
                <tr key={inv.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 font-['Inter'] text-sm font-bold text-foreground">{inv.invoice_code}</td>
                  <td className="px-4 py-3 font-['Inter'] text-sm text-foreground-variant">{inv.tenant_profiles?.username ?? "—"}</td>
                  <td className="px-4 py-3 font-['Inter'] text-sm text-foreground-variant">{inv.tenant_profiles?.rooms?.unit_code ?? "—"}</td>
                  <td className="px-4 py-3 font-['Inter'] text-sm text-foreground text-right">{formatSGD(inv.total_due)}</td>
                  <td className="px-4 py-3 font-['Inter'] text-sm text-emerald-300 text-right">{formatSGD(inv.total_paid)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_STYLES[inv.status]}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      {inv.status !== "PAID" && inv.status !== "VOID" && (
                        <button
                          onClick={() => {
                            setPayModal(inv);
                            setPayAmount(String(Number(inv.total_due) - Number(inv.total_paid)));
                          }}
                          className="text-accent hover:underline font-['Inter'] text-xs font-bold"
                        >
                          Mark Paid
                        </button>
                      )}
                      {inv.status !== "PAID" && inv.status !== "VOID" && (
                        <button
                          onClick={() => handleVoid(inv)}
                          className="text-red-300 hover:underline font-['Inter'] text-xs font-bold"
                        >
                          Void
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Mark as Paid Modal */}
      {payModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-md">
            <h3 className="font-display font-bold text-lg text-foreground mb-4">
              Mark as Paid — {payModal.invoice_code}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block font-['Inter'] text-xs uppercase tracking-widest text-foreground-variant font-bold mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full bg-surface-container border border-border rounded-xl px-3 py-2 font-['Inter'] text-sm text-foreground"
                />
              </div>
              <div>
                <label className="block font-['Inter'] text-xs uppercase tracking-widest text-foreground-variant font-bold mb-1">Bank Reference</label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="Transfer reference..."
                  className="w-full bg-surface-container border border-border rounded-xl px-3 py-2 font-['Inter'] text-sm text-foreground"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setPayModal(null)}
                className="px-4 py-2 font-['Inter'] text-sm text-foreground-variant hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkPaid}
                disabled={payProcessing || !payAmount}
                className="px-4 py-2 bg-accent text-white rounded-full font-['Inter'] font-bold text-sm hover:opacity-90 disabled:opacity-50"
              >
                {payProcessing ? "Processing..." : "Confirm Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
