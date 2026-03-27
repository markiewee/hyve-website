import { useEffect, useState } from "react";
import PortalLayout from "../../components/portal/PortalLayout";
import CsvUploader from "../../components/portal/CsvUploader";
import TransactionReviewBoard from "../../components/portal/TransactionReviewBoard";
import { useTransactionImport } from "../../hooks/useTransactionImport";
import { useTransactionReview } from "../../hooks/useTransactionReview";
import { aspire } from "../../lib/aspire";

function MetricCard({ label, value, icon, color }) {
  return (
    <div className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm p-5 flex items-center gap-4">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}18` }}
      >
        <span
          className="material-symbols-outlined text-[20px]"
          style={{ color }}
        >
          {icon}
        </span>
      </div>
      <div>
        <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-0.5">
          {label}
        </p>
        <p className="font-['Plus_Jakarta_Sans'] text-2xl font-bold text-[#121c2a]">
          {value ?? "—"}
        </p>
      </div>
    </div>
  );
}

const TAB_ASPIRE = "aspire";
const TAB_CSV = "csv";

export default function AdminExpenseImportPage() {
  const [activeTab, setActiveTab] = useState(TAB_ASPIRE);

  // Aspire API state
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Active batch for review
  const [batchId, setBatchId] = useState(null);

  const { importFromAspire, importFromCsv, importing, progress, error: importError } =
    useTransactionImport();

  const {
    transactions,
    properties,
    loading: reviewLoading,
    stats,
    confirmTag,
    ignoreTransaction,
    bulkConfirmAutoTagged,
    refresh,
  } = useTransactionReview(batchId);

  // Load Aspire accounts on mount
  useEffect(() => {
    setAccountsLoading(true);
    setAccountsError(null);
    aspire
      .getAccounts()
      .then((data) => {
        setAccounts(data ?? []);
        if (data && data.length > 0) setSelectedAccount(data[0].id ?? data[0]);
      })
      .catch((err) => {
        setAccountsError(
          err?.message?.includes("credentials") || err?.message?.includes("401")
            ? "Aspire credentials are not configured. Please set them in your environment."
            : err?.message ?? "Failed to load Aspire accounts."
        );
      })
      .finally(() => setAccountsLoading(false));
  }, []);

  async function handleAspireImport() {
    if (!selectedAccount || !fromDate || !toDate) return;
    const result = await importFromAspire(selectedAccount, fromDate, toDate);
    if (result?.batchId) {
      setBatchId(result.batchId);
    }
  }

  async function handleCsvUpload(file) {
    const result = await importFromCsv(file);
    if (result?.batchId) {
      setBatchId(result.batchId);
    }
  }

  const hasBatch = !!batchId;

  return (
    <PortalLayout>
      {/* Page header */}
      <div className="mb-8">
        <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-1">
          Expenses
        </p>
        <h1 className="font-['Plus_Jakarta_Sans'] text-2xl font-bold text-[#121c2a]">
          Smart Expense Import
        </h1>
        <p className="font-['Manrope'] text-sm text-[#6c7a77] mt-1">
          Import transactions from Aspire or a CSV file, then review and tag them.
        </p>
      </div>

      {/* ── Section 1: Import Source ── */}
      <div className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm p-6 mb-6">
        {/* Tab switcher */}
        <div className="flex gap-1 mb-6 bg-[#eff4ff] rounded-xl p-1 w-fit">
          {[
            { id: TAB_ASPIRE, label: "Aspire API", icon: "cloud_download" },
            { id: TAB_CSV, label: "CSV Upload", icon: "upload_file" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-['Manrope'] font-semibold transition-all duration-150 ${
                activeTab === tab.id
                  ? "bg-white text-[#006b5f] shadow-sm"
                  : "text-[#6c7a77] hover:text-[#121c2a]"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Aspire API tab */}
        {activeTab === TAB_ASPIRE && (
          <div className="space-y-5">
            {accountsError ? (
              <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
                <span className="material-symbols-outlined text-red-500 text-[20px] shrink-0 mt-0.5">
                  error
                </span>
                <div>
                  <p className="font-['Manrope'] font-semibold text-red-700 text-sm">
                    Aspire Not Configured
                  </p>
                  <p className="font-['Manrope'] text-red-600 text-sm mt-0.5">
                    {accountsError}
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Account selector */}
                <div>
                  <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block mb-1.5">
                    Account
                  </label>
                  {accountsLoading ? (
                    <div className="h-10 bg-[#eff4ff] rounded-xl animate-pulse w-64" />
                  ) : (
                    <select
                      value={selectedAccount}
                      onChange={(e) => setSelectedAccount(e.target.value)}
                      className="w-full max-w-xs h-10 px-3 rounded-xl border border-[#bbcac6]/40 bg-white font-['Manrope'] text-sm text-[#121c2a] focus:outline-none focus:ring-2 focus:ring-[#006b5f]/30"
                    >
                      {accounts.length === 0 && (
                        <option value="">No accounts found</option>
                      )}
                      {accounts.map((acc) => {
                        const name = acc.debit_details?.[0]?.account_name || acc.name || acc.id || acc;
                        const bal = acc.available_balance != null ? ` (${acc.currency_code || "SGD"} ${(acc.available_balance / 100).toLocaleString("en-SG", { minimumFractionDigits: 2 })})` : "";
                        return (
                        <option key={acc.id ?? acc} value={acc.id ?? acc}>
                          {name}{bal}
                        </option>
                        );
                      }
                      ))}
                    </select>
                  )}
                </div>

                {/* Date range */}
                <div className="flex flex-wrap gap-4">
                  <div>
                    <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block mb-1.5">
                      From Date
                    </label>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="h-10 px-3 rounded-xl border border-[#bbcac6]/40 bg-white font-['Manrope'] text-sm text-[#121c2a] focus:outline-none focus:ring-2 focus:ring-[#006b5f]/30"
                    />
                  </div>
                  <div>
                    <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block mb-1.5">
                      To Date
                    </label>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="h-10 px-3 rounded-xl border border-[#bbcac6]/40 bg-white font-['Manrope'] text-sm text-[#121c2a] focus:outline-none focus:ring-2 focus:ring-[#006b5f]/30"
                    />
                  </div>
                </div>

                {/* Import error */}
                {importError && activeTab === TAB_ASPIRE && (
                  <p className="font-['Manrope'] text-sm text-red-600">{importError}</p>
                )}

                {/* Import button */}
                <button
                  onClick={handleAspireImport}
                  disabled={importing || !selectedAccount || !fromDate || !toDate}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing ? (
                    <>
                      <span className="material-symbols-outlined text-[18px] animate-spin">
                        progress_activity
                      </span>
                      Importing… {progress != null ? `${progress}%` : ""}
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">
                        cloud_download
                      </span>
                      Import from Aspire
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        )}

        {/* CSV Upload tab */}
        {activeTab === TAB_CSV && (
          <div className="space-y-4">
            {importError && activeTab === TAB_CSV && (
              <p className="font-['Manrope'] text-sm text-red-600">{importError}</p>
            )}
            <CsvUploader
              onFileSelected={handleCsvUpload}
              importing={importing}
              progress={progress}
            />
          </div>
        )}
      </div>

      {/* ── Section 2: Import Summary + Review ── */}
      {hasBatch && (
        <>
          {/* Metric cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <MetricCard
              label="Imported"
              value={stats?.total}
              icon="receipt_long"
              color="#006b5f"
            />
            <MetricCard
              label="Auto-Tagged"
              value={stats?.autoTagged}
              icon="auto_awesome"
              color="#4f7cff"
            />
            <MetricCard
              label="Needs Review"
              value={stats?.needsReview}
              icon="pending_actions"
              color="#f59e0b"
            />
          </div>

          {/* Review board */}
          {reviewLoading ? (
            <div className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm p-10 flex items-center justify-center gap-3">
              <span className="material-symbols-outlined text-[#006b5f] text-[24px] animate-spin">
                progress_activity
              </span>
              <p className="font-['Manrope'] text-sm text-[#6c7a77]">
                Loading transactions…
              </p>
            </div>
          ) : (
            <TransactionReviewBoard
              transactions={transactions}
              properties={properties}
              onConfirm={confirmTag}
              onIgnore={ignoreTransaction}
              onBulkConfirm={bulkConfirmAutoTagged}
              stats={stats}
            />
          )}
        </>
      )}
    </PortalLayout>
  );
}
