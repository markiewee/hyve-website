// /portal/admin/billing — unified entry point for the Money domain.
// V1: redirects to the existing Rent or Invoices page based on ?tab.
// V2 (future): merge AdminRentPage + AdminInvoicesPage bodies as
//   tab panels here so they share a single month selector and "mark paid"
//   propagates across both ledgers (rent_payments + invoices). The audit
//   spec is in ADMIN-UX-REVIEW.md section H-1.

import { useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import PortalLayout from "../../components/portal/PortalLayout";
import PageHeader from "../../components/portal/PageHeader";

const TABS = [
  { key: "rent",     label: "Rent",      to: "/portal/admin/rent",      desc: "Generate monthly rent records, track payments, mark paid" },
  { key: "invoices", label: "Invoices",  to: "/portal/admin/invoices",  desc: "Issued invoices, line items, void / reissue" },
  { key: "expenses", label: "Expenses",  to: "/portal/admin/expenses",  desc: "Property expenses, manual + Aspire import" },
  { key: "pl",       label: "P&L",       to: "/portal/admin/financials", desc: "Monthly P&L, distributions, finalize month" },
];

export default function AdminBillingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // If a specific tab was requested, just bounce to that page directly.
  useEffect(() => {
    const tab = searchParams.get("tab");
    const dest = TABS.find((t) => t.key === tab);
    if (dest) navigate(dest.to, { replace: true });
  }, [searchParams, navigate]);

  return (
    <PortalLayout>
      <PageHeader
        title="Money"
        subtitle="One area for everything money — rent, invoices, expenses, and P&L. Pick a destination."
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TABS.map((t) => (
          <Link
            key={t.key}
            to={t.to}
            className="bg-white rounded-2xl border border-[#E8E0CE]/15 p-6 hover:border-[#A87813]/30 hover:shadow-md transition-all flex items-start gap-4"
          >
            <span className="material-symbols-outlined text-[#A87813] text-[28px] shrink-0">
              {t.key === "rent" ? "receipt_long"
                : t.key === "invoices" ? "request_quote"
                : t.key === "expenses" ? "account_balance"
                : "bar_chart"}
            </span>
            <div className="min-w-0">
              <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-[#1F2937] mb-1">
                {t.label}
              </h3>
              <p className="text-sm text-[#6B7280]">{t.desc}</p>
            </div>
            <span className="material-symbols-outlined text-[#9999A1] ml-auto shrink-0">
              chevron_right
            </span>
          </Link>
        ))}
      </div>
      <p className="mt-8 text-xs text-[#9999A1]">
        v1 of the unified Money area. Future: rent + invoices merge into one ledger
        with shared month selector and cascading "mark paid".
      </p>
    </PortalLayout>
  );
}
