# Investor Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Reports page to the investor portal where investors see monthly financial summaries and download legacy PDF reports, filtered to their properties only. Admin can upload reports with financial data and optional PDF attachments.

**Architecture:** New `investor_reports` table stores per-property monthly reports with revenue/expense/net/distribution numbers plus an optional PDF URL. Investor-side page queries reports filtered by their `investments`. Admin-side form on a new section of the existing AdminInvestorsPage handles upload. Supabase storage bucket `investor-reports` holds PDFs. RLS ensures investors only see their properties' reports.

**Tech Stack:** React, Supabase (Postgres + Storage + RLS), Tailwind CSS, existing design system (Plus Jakarta Sans / Manrope / Inter fonts, #006b5f / #121c2a / #eff4ff palette)

---

### Task 1: Database Migration — Create `investor_reports` table

**Files:**
- Create: Supabase migration (via `mcp__supabase__apply_migration`)

- [ ] **Step 1: Create the `investor_reports` table**

```sql
CREATE TABLE investor_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id),
  month DATE NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Monthly P&L',
  file_url TEXT,
  total_revenue NUMERIC DEFAULT 0,
  total_expenses NUMERIC DEFAULT 0,
  net_income NUMERIC DEFAULT 0,
  distribution_amount NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one report per property per month per category
ALTER TABLE investor_reports
  ADD CONSTRAINT investor_reports_property_month_category_key
  UNIQUE (property_id, month, category);

-- Index for investor queries (filter by property + order by month)
CREATE INDEX idx_investor_reports_property_month
  ON investor_reports (property_id, month DESC);
```

- [ ] **Step 2: Add RLS policies**

```sql
ALTER TABLE investor_reports ENABLE ROW LEVEL SECURITY;

-- Investors can read reports for properties they have investments in
CREATE POLICY "investors_read_own_reports"
  ON investor_reports FOR SELECT
  USING (
    property_id IN (
      SELECT inv.property_id FROM investments inv
      JOIN investors i ON i.id = inv.investor_id
      WHERE i.user_id = auth.uid()
    )
  );

-- Admin full access
CREATE POLICY "admin_full_access_reports"
  ON investor_reports FOR ALL
  USING (
    (SELECT get_user_role(auth.uid())) = 'ADMIN'
  );
```

- [ ] **Step 3: Create storage bucket**

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('investor-reports', 'investor-reports', true);
```

- [ ] **Step 4: Add storage policies**

```sql
-- Admin can upload
CREATE POLICY "admin_upload_investor_reports"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'investor-reports'
    AND (SELECT get_user_role(auth.uid())) = 'ADMIN'
  );

-- Anyone authenticated can read (RLS on table handles filtering)
CREATE POLICY "authenticated_read_investor_reports"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'investor-reports'
    AND auth.role() = 'authenticated'
  );

-- Admin can delete
CREATE POLICY "admin_delete_investor_reports"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'investor-reports'
    AND (SELECT get_user_role(auth.uid())) = 'ADMIN'
  );
```

- [ ] **Step 5: Verify migration**

Run a quick SELECT to confirm table exists:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'investor_reports' ORDER BY ordinal_position;
```

---

### Task 2: Investor Reports Page — Data Hook

**Files:**
- Create: `src/hooks/useInvestorReports.js`

- [ ] **Step 1: Create the hook**

```jsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useInvestorReports(investorId) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!investorId) {
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);

      // Get investor's property IDs from investments
      const { data: investments } = await supabase
        .from("investments")
        .select("property_id")
        .eq("investor_id", investorId);

      const propertyIds = (investments ?? []).map((i) => i.property_id);

      if (propertyIds.length === 0) {
        setReports([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("investor_reports")
        .select("*, properties(name, code)")
        .in("property_id", propertyIds)
        .order("month", { ascending: false });

      if (error) {
        console.error("Error fetching investor reports:", error);
      }

      setReports(data ?? []);
      setLoading(false);
    }

    load();
  }, [investorId]);

  return { reports, loading };
}
```

---

### Task 3: Investor Reports Page — UI Component

**Files:**
- Create: `src/pages/portal/InvestorReportsPage.jsx`

- [ ] **Step 1: Create the reports page**

```jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useInvestor } from "../../hooks/useInvestor";
import { useInvestorReports } from "../../hooks/useInvestorReports";
import InvestorLayout from "../../components/portal/InvestorLayout";

function formatMonth(monthStr) {
  if (!monthStr) return "—";
  const [year, month] = monthStr.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-SG", { month: "long", year: "numeric" });
}

function formatSGD(amount) {
  if (amount == null) return "—";
  return `$${Number(amount).toLocaleString("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function SkeletonRow() {
  return (
    <div className="bg-white rounded-2xl p-6 border border-[#bbcac6]/10 shadow-sm space-y-3">
      <div className="h-4 w-1/3 bg-[#eff4ff] animate-pulse rounded" />
      <div className="h-4 w-full bg-[#eff4ff] animate-pulse rounded" />
      <div className="h-4 w-2/3 bg-[#eff4ff] animate-pulse rounded" />
    </div>
  );
}

export default function InvestorReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const { investor, isInvestor, loading: invLoading } = useInvestor();
  const { reports, loading: reportsLoading } = useInvestorReports(investor?.id);

  if (authLoading || invLoading) {
    return (
      <InvestorLayout>
        <div className="space-y-4">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </InvestorLayout>
    );
  }

  if (!user) return <Navigate to="/portal/login" replace />;
  if (!isInvestor) return <Navigate to="/portal/dashboard" replace />;

  // Group reports by year
  const byYear = {};
  for (const r of reports) {
    const year = r.month?.slice(0, 4) ?? "Unknown";
    if (!byYear[year]) byYear[year] = [];
    byYear[year].push(r);
  }
  const years = Object.keys(byYear).sort((a, b) => b.localeCompare(a));

  return (
    <InvestorLayout>
      {/* Page header */}
      <section className="mb-12">
        <h2 className="font-['Plus_Jakarta_Sans'] text-4xl font-extrabold text-[#121c2a] tracking-tight mb-2">
          Reports
        </h2>
        <p className="font-['Manrope'] text-[#555f6f] text-lg leading-relaxed">
          Monthly financial reports and payout history for your properties.
        </p>
      </section>

      {reportsLoading ? (
        <div className="space-y-4">
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-[2rem] p-12 border border-[#bbcac6]/10 shadow-sm text-center">
          <span className="material-symbols-outlined text-[48px] text-[#bbcac6] mb-4 block">
            description
          </span>
          <p className="font-['Manrope'] text-[#555f6f] text-lg">
            No reports available yet.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {years.map((year) => (
            <section key={year}>
              <h3 className="font-['Plus_Jakarta_Sans'] text-xl font-bold text-[#121c2a] mb-4">
                {year}
              </h3>
              <div className="space-y-4">
                {byYear[year].map((report) => (
                  <div
                    key={report.id}
                    className="bg-white rounded-2xl p-6 border border-[#bbcac6]/10 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Left: title + property */}
                      <div className="min-w-0">
                        <h4 className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a] text-lg">
                          {report.title}
                        </h4>
                        <p className="font-['Manrope'] text-sm text-[#555f6f] mt-1">
                          {report.properties?.name ?? "—"} &middot; {formatMonth(report.month)}
                        </p>
                        {report.notes && (
                          <p className="font-['Manrope'] text-sm text-[#6c7a77] mt-2 italic">
                            {report.notes}
                          </p>
                        )}
                      </div>

                      {/* Right: financials */}
                      <div className="flex items-center gap-6 flex-shrink-0">
                        <div className="text-right">
                          <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">
                            Revenue
                          </p>
                          <p className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a] tabular-nums">
                            {formatSGD(report.total_revenue)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">
                            Expenses
                          </p>
                          <p className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a] tabular-nums">
                            {formatSGD(report.total_expenses)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">
                            Net
                          </p>
                          <p className={`font-['Plus_Jakarta_Sans'] font-bold tabular-nums ${
                            Number(report.net_income) >= 0 ? "text-[#006b5f]" : "text-[#ba1a1a]"
                          }`}>
                            {formatSGD(report.net_income)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">
                            Distributed
                          </p>
                          <p className="font-['Plus_Jakarta_Sans'] font-bold text-[#006b5f] tabular-nums">
                            {formatSGD(report.distribution_amount)}
                          </p>
                        </div>

                        {/* PDF download */}
                        {report.file_url && (
                          <a
                            href={report.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2.5 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-semibold text-sm hover:bg-[#005a50] transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              download
                            </span>
                            PDF
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </InvestorLayout>
  );
}
```

---

### Task 4: Add Reports to Investor Navigation + Routing

**Files:**
- Modify: `src/components/portal/InvestorLayout.jsx` (line 4-9, add Reports nav item)
- Modify: `src/App.jsx` (line 59-60, add import + line 358-365, add route)

- [ ] **Step 1: Add Reports nav item to InvestorLayout**

In `src/components/portal/InvestorLayout.jsx`, update the `INVESTOR_NAV` array:

```jsx
const INVESTOR_NAV = [
  {
    label: "Dashboard",
    to: "/portal/investor/dashboard",
    icon: "dashboard",
  },
  {
    label: "Reports",
    to: "/portal/investor/reports",
    icon: "description",
  },
];
```

- [ ] **Step 2: Add import in App.jsx**

Add after the InvestorDashboardPage import (line 59):

```jsx
import InvestorReportsPage from './pages/portal/InvestorReportsPage';
```

- [ ] **Step 3: Add route in App.jsx**

Add after the investor dashboard route block (after line 365):

```jsx
<Route
  path="/portal/investor/reports"
  element={
    <AuthGuard>
      <InvestorReportsPage />
    </AuthGuard>
  }
/>
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useInvestorReports.js src/pages/portal/InvestorReportsPage.jsx src/components/portal/InvestorLayout.jsx src/App.jsx
git commit -m "feat: add investor reports page with financial data and PDF downloads"
```

---

### Task 5: Admin Upload UI — Reports Section on AdminInvestorsPage

**Files:**
- Modify: `src/pages/portal/AdminInvestorsPage.jsx` (add reports management section at bottom)

- [ ] **Step 1: Add state for reports section**

Add these state variables near the top of the `AdminInvestorsPage` component (after the existing distribution state around line 43):

```jsx
// Reports state
const [reportMonth, setReportMonth] = useState(getMonthStr(new Date()));
const [reportPropertyId, setReportPropertyId] = useState("");
const [reportTitle, setReportTitle] = useState("");
const [reportCategory, setReportCategory] = useState("Monthly P&L");
const [reportRevenue, setReportRevenue] = useState("");
const [reportExpenses, setReportExpenses] = useState("");
const [reportDistribution, setReportDistribution] = useState("");
const [reportNotes, setReportNotes] = useState("");
const [reportFile, setReportFile] = useState(null);
const [reportSaving, setReportSaving] = useState(false);
const [reportError, setReportError] = useState(null);
const [reportSuccess, setReportSuccess] = useState(null);
const [existingReports, setExistingReports] = useState([]);
const [reportsLoading, setReportsLoading] = useState(false);
```

- [ ] **Step 2: Add fetch and submit functions**

Add after the distribution approval functions (after `handleApproveAll`, around line 324):

```jsx
// ─── Reports ─────────────────────────────────────────────────────────────────

const fetchReports = useCallback(async () => {
  setReportsLoading(true);
  const { data, error } = await supabase
    .from("investor_reports")
    .select("*, properties(name, code)")
    .order("month", { ascending: false })
    .limit(20);

  if (error) console.error("Error fetching reports:", error);
  setExistingReports(data ?? []);
  setReportsLoading(false);
}, []);

useEffect(() => {
  fetchReports();
}, [fetchReports]);

async function handleSaveReport(e) {
  e.preventDefault();
  setReportSaving(true);
  setReportError(null);
  setReportSuccess(null);

  try {
    const revenue = Number(reportRevenue) || 0;
    const expenses = Number(reportExpenses) || 0;
    const net = revenue - expenses;
    const distribution = Number(reportDistribution) || 0;

    let fileUrl = null;

    // Upload PDF if provided
    if (reportFile) {
      const ext = reportFile.name.split(".").pop();
      const path = `${reportPropertyId}/${reportMonth}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("investor-reports")
        .upload(path, reportFile);

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      const { data: urlData } = supabase.storage
        .from("investor-reports")
        .getPublicUrl(path);

      fileUrl = urlData.publicUrl;
    }

    const { error: insertError } = await supabase
      .from("investor_reports")
      .upsert(
        {
          property_id: reportPropertyId,
          month: `${reportMonth}-01`,
          title: reportTitle || `${reportMonth} Monthly Report`,
          category: reportCategory,
          total_revenue: revenue,
          total_expenses: expenses,
          net_income: net,
          distribution_amount: distribution,
          notes: reportNotes || null,
          ...(fileUrl ? { file_url: fileUrl } : {}),
        },
        { onConflict: "property_id,month,category" }
      );

    if (insertError) throw new Error(insertError.message);

    setReportSuccess("Report saved.");
    setReportTitle("");
    setReportRevenue("");
    setReportExpenses("");
    setReportDistribution("");
    setReportNotes("");
    setReportFile(null);
    fetchReports();
  } catch (err) {
    setReportError(err.message);
  } finally {
    setReportSaving(false);
  }
}

async function handleDeleteReport(id) {
  if (!confirm("Delete this report?")) return;
  const { error } = await supabase.from("investor_reports").delete().eq("id", id);
  if (error) console.error("Error deleting report:", error);
  fetchReports();
}
```

- [ ] **Step 3: Add reports UI section**

Add this JSX at the bottom of the return statement, before the closing `</PortalLayout>` tag:

```jsx
{/* ─── Reports Section ───────────────────────────────────────────── */}
<div className="mt-12 pt-8 border-t-2 border-[#bbcac6]/15">
  <h2 className="font-['Plus_Jakarta_Sans'] text-2xl font-extrabold text-[#121c2a] mb-6 flex items-center gap-2">
    <span className="material-symbols-outlined text-[#006b5f]">description</span>
    Investor Reports
  </h2>

  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
    {/* Upload form */}
    <div className="lg:col-span-5">
      <div className="bg-white rounded-2xl p-6 border border-[#bbcac6]/15 shadow-sm">
        <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a] mb-5">
          Add / Update Report
        </h3>
        <form onSubmit={handleSaveReport} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-2">
                Month
              </label>
              <input
                type="month"
                value={reportMonth}
                onChange={(e) => setReportMonth(e.target.value)}
                required
                className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
              />
            </div>
            <div>
              <label className="block font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-2">
                Property
              </label>
              <select
                value={reportPropertyId}
                onChange={(e) => setReportPropertyId(e.target.value)}
                required
                className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
              >
                <option value="">Select...</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-2">
              Title
            </label>
            <input
              type="text"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              placeholder={`${reportMonth} Monthly Report`}
              className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-2">
                Revenue
              </label>
              <input
                type="number"
                step="0.01"
                value={reportRevenue}
                onChange={(e) => setReportRevenue(e.target.value)}
                placeholder="0.00"
                className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none tabular-nums"
              />
            </div>
            <div>
              <label className="block font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-2">
                Expenses
              </label>
              <input
                type="number"
                step="0.01"
                value={reportExpenses}
                onChange={(e) => setReportExpenses(e.target.value)}
                placeholder="0.00"
                className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none tabular-nums"
              />
            </div>
            <div>
              <label className="block font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-2">
                Distributed
              </label>
              <input
                type="number"
                step="0.01"
                value={reportDistribution}
                onChange={(e) => setReportDistribution(e.target.value)}
                placeholder="0.00"
                className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-2">
              Notes (optional)
            </label>
            <textarea
              value={reportNotes}
              onChange={(e) => setReportNotes(e.target.value)}
              rows={2}
              placeholder="Any commentary for investors..."
              className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none resize-none"
            />
          </div>

          <div>
            <label className="block font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-2">
              PDF Report (optional)
            </label>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setReportFile(e.target.files?.[0] ?? null)}
              className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 font-['Manrope'] text-[#121c2a] text-sm file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-[#006b5f] file:text-white file:font-semibold file:text-xs"
            />
          </div>

          {reportError && (
            <p className="text-sm text-red-600 font-['Manrope']">{reportError}</p>
          )}
          {reportSuccess && (
            <p className="text-sm text-green-600 font-['Manrope']">{reportSuccess}</p>
          )}

          <button
            type="submit"
            disabled={reportSaving || !reportPropertyId}
            className="w-full py-3 rounded-xl font-['Manrope'] font-bold text-white bg-[#006b5f] hover:bg-[#005a50] disabled:opacity-50 transition-colors"
          >
            {reportSaving ? "Saving..." : "Save Report"}
          </button>
        </form>
      </div>
    </div>

    {/* Existing reports list */}
    <div className="lg:col-span-7">
      <div className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#bbcac6]/10">
          <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a]">
            Recent Reports
          </h3>
        </div>
        {reportsLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-[#eff4ff] animate-pulse rounded-xl" />
            ))}
          </div>
        ) : existingReports.length === 0 ? (
          <div className="p-6 text-center text-[#6c7a77] font-['Manrope']">
            No reports yet.
          </div>
        ) : (
          <div className="divide-y divide-[#bbcac6]/10">
            {existingReports.map((r) => (
              <div key={r.id} className="px-6 py-4 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="font-['Manrope'] font-semibold text-[#121c2a] text-sm truncate">
                    {r.title}
                  </p>
                  <p className="font-['Inter'] text-xs text-[#6c7a77]">
                    {r.properties?.name ?? "—"} &middot;{" "}
                    {new Date(r.month).toLocaleDateString("en-SG", { month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#006b5f] tabular-nums">
                    {formatSGD(r.net_income)}
                  </span>
                  {r.file_url && (
                    <a
                      href={r.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#006b5f] hover:text-[#005a50]"
                    >
                      <span className="material-symbols-outlined text-[18px]">download</span>
                    </a>
                  )}
                  <button
                    onClick={() => handleDeleteReport(r.id)}
                    className="text-[#6c7a77] hover:text-[#ba1a1a] transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/portal/AdminInvestorsPage.jsx
git commit -m "feat: add admin UI for uploading investor reports with financials"
```

---

### Task 6: Deploy and Verify

- [ ] **Step 1: Run dev server and verify investor reports page**

```bash
cd /Users/mark/Desktop/lazybee-website && npm run dev
```

Open `http://localhost:5173/portal/investor/reports` logged in as an investor. Verify:
- Sidebar shows "Reports" link
- Page loads with empty state ("No reports available yet.")
- Navigation works between Dashboard and Reports

- [ ] **Step 2: Verify admin upload**

Open `http://localhost:5173/portal/admin/investors` logged in as admin. Scroll to "Investor Reports" section. Verify:
- Form shows month picker, property dropdown, financial fields, PDF upload
- Submit a test report with financial data
- Submit a test report with a PDF attachment
- Both appear in the "Recent Reports" list
- Delete button works

- [ ] **Step 3: Verify investor sees the report**

Switch to investor login. Open Reports page. Verify:
- Report appears with correct financial data
- PDF download link works
- Only reports for that investor's properties are visible

- [ ] **Step 4: Commit and push**

```bash
git add -A
git commit -m "feat: investor reports - complete feature with DB, admin upload, investor view"
git push origin master
```
