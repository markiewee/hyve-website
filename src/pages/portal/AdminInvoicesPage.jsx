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
  DRAFT: "bg-gray-100 text-gray-600",
  ISSUED: "bg-yellow-100 text-yellow-800",
  PARTIALLY_PAID: "bg-orange-100 text-orange-800",
  PAID: "bg-green-100 text-green-800",
  VOID: "bg-gray-100 text-gray-500",
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
        <h2 className="font-['Plus_Jakarta_Sans'] text-2xl font-extrabold text-[#1F2937] tracking-tight mb-1">
          Invoice Management
        </h2>
        <p className="text-[#6B7280] font-['Manrope'] font-medium">
          View, manage, and reconcile tenant invoices.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-6 border border-[#E8E0CE]/15 shadow-sm mb-6">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block font-['Inter'] text-xs uppercase tracking-widest text-[#6B7280] font-bold mb-1">Property</label>
            <select
              value={filterProperty}
              onChange={(e) => setFilterProperty(e.target.value)}
              className="bg-[#F2D88A] border-0 rounded-xl px-3 py-2 font-['Manrope'] text-sm text-[#1F2937]"
            >
              <option value="">All</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-['Inter'] text-xs uppercase tracking-widest text-[#6B7280] font-bold mb-1">Month</label>
            <input
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="bg-[#F2D88A] border-0 rounded-xl px-3 py-2 font-['Manrope'] text-sm text-[#1F2937]"
            />
          </div>
          <div>
            <label className="block font-['Inter'] text-xs uppercase tracking-widest text-[#6B7280] font-bold mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-[#F2D88A] border-0 rounded-xl px-3 py-2 font-['Manrope'] text-sm text-[#1F2937]"
            >
              <option value="">All</option>
              <option value="ISSUED">Issued</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="PAID">Paid</option>
              <option value="VOID">Void</option>
            </select>
          </div>
          <div>
            <label className="block font-['Inter'] text-xs uppercase tracking-widest text-[#6B7280] font-bold mb-1">Search Code</label>
            <input
              type="text"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              placeholder="HV-TG-..."
              className="bg-[#F2D88A] border-0 rounded-xl px-3 py-2 font-['Manrope'] text-sm text-[#1F2937]"
            />
          </div>
        </div>
      </div>

      {/* Invoice Table */}
      <div className="bg-white rounded-2xl border border-[#E8E0CE]/15 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#A87813]" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-12 text-[#6B7280] font-['Manrope']">No invoices found.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E8E0CE]/20 bg-[#FAF6EC]">
                <th className="text-left px-4 py-3 font-['Manrope'] text-xs text-[#6B7280] font-semibold">Code</th>
                <th className="text-left px-4 py-3 font-['Manrope'] text-xs text-[#6B7280] font-semibold">Tenant</th>
                <th className="text-left px-4 py-3 font-['Manrope'] text-xs text-[#6B7280] font-semibold">Room</th>
                <th className="text-right px-4 py-3 font-['Manrope'] text-xs text-[#6B7280] font-semibold">Due</th>
                <th className="text-right px-4 py-3 font-['Manrope'] text-xs text-[#6B7280] font-semibold">Paid</th>
                <th className="text-center px-4 py-3 font-['Manrope'] text-xs text-[#6B7280] font-semibold">Status</th>
                <th className="text-center px-4 py-3 font-['Manrope'] text-xs text-[#6B7280] font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E0CE]/10">
              {filtered.map((inv) => (
                <tr key={inv.id} className="hover:bg-[#FAF6EC] transition-colors">
                  <td className="px-4 py-3 font-['Manrope'] text-sm font-bold text-[#1F2937]">{inv.invoice_code}</td>
                  <td className="px-4 py-3 font-['Manrope'] text-sm text-[#6B7280]">{inv.tenant_profiles?.username ?? "—"}</td>
                  <td className="px-4 py-3 font-['Manrope'] text-sm text-[#6B7280]">{inv.tenant_profiles?.rooms?.unit_code ?? "—"}</td>
                  <td className="px-4 py-3 font-['Manrope'] text-sm text-[#1F2937] text-right">{formatSGD(inv.total_due)}</td>
                  <td className="px-4 py-3 font-['Manrope'] text-sm text-green-700 text-right">{formatSGD(inv.total_paid)}</td>
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
                          className="text-[#A87813] hover:underline font-['Manrope'] text-xs font-bold"
                        >
                          Mark Paid
                        </button>
                      )}
                      {inv.status !== "PAID" && inv.status !== "VOID" && (
                        <button
                          onClick={() => handleVoid(inv)}
                          className="text-[#ba1a1a] hover:underline font-['Manrope'] text-xs font-bold"
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
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#1F2937] mb-4">
              Mark as Paid — {payModal.invoice_code}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block font-['Inter'] text-xs uppercase tracking-widest text-[#6B7280] font-bold mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full bg-[#F2D88A] border-0 rounded-xl px-3 py-2 font-['Manrope'] text-sm"
                />
              </div>
              <div>
                <label className="block font-['Inter'] text-xs uppercase tracking-widest text-[#6B7280] font-bold mb-1">Bank Reference</label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="Transfer reference..."
                  className="w-full bg-[#F2D88A] border-0 rounded-xl px-3 py-2 font-['Manrope'] text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setPayModal(null)}
                className="px-4 py-2 font-['Manrope'] text-sm text-[#6B7280] hover:text-[#1F2937]"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkPaid}
                disabled={payProcessing || !payAmount}
                className="px-4 py-2 bg-[#A87813] text-white rounded-xl font-['Manrope'] font-bold text-sm hover:opacity-90 disabled:opacity-50"
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
