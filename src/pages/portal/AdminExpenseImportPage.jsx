import { useEffect, useState, useCallback } from "react";
import PortalLayout from "../../components/portal/PortalLayout";
import CsvUploader from "../../components/portal/CsvUploader";
import TransactionReviewBoard from "../../components/portal/TransactionReviewBoard";
import { useTransactionImport } from "../../hooks/useTransactionImport";
import { useTransactionReview } from "../../hooks/useTransactionReview";
import { aspire } from "../../lib/aspire";
import { supabase } from "../../lib/supabase";

function formatSGD(amount) {
  if (amount == null) return "--";
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    minimumFractionDigits: 2,
  }).format(amount);
}

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
          {value ?? "--"}
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

  // Account nicknames
  const [nicknames, setNicknames] = useState({});
  const [editingNickname, setEditingNickname] = useState(null);
  const [nicknameInput, setNicknameInput] = useState("");

  // Import result summary
  const [importResult, setImportResult] = useState(null);

  // Active batch for review
  const [batchId, setBatchId] = useState(null);

  const { importFromAspire, importFromCsv, importing, progress, error: importError } =
    useTransactionImport();

  const {
    transactions,
    properties,
    rooms,
    loading: reviewLoading,
    stats,
    typeFilter,
    setTypeFilter,
    confirmTag,
    ignoreTransaction,
    bulkConfirmAutoTagged,
    assignRoom,
    refresh,
  } = useTransactionReview(batchId);

  // ─── Nicknames ────────────────────────────────────────────────────────────────

  const fetchNicknames = useCallback(async () => {
    const { data } = await supabase.from("account_nicknames").select("*");
    const map = {};
    (data ?? []).forEach((n) => {
      map[n.aspire_account_id] = n;
    });
    setNicknames(map);
  }, []);

  useEffect(() => {
    fetchNicknames();
  }, [fetchNicknames]);

  async function saveNickname(accountId) {
    if (!nicknameInput.trim()) return;
    const { error } = await supabase.from("account_nicknames").upsert(
      {
        aspire_account_id: accountId,
        nickname: nicknameInput.trim(),
      },
      { onConflict: "aspire_account_id" }
    );
    if (!error) {
      await fetchNicknames();
    }
    setEditingNickname(null);
    setNicknameInput("");
  }

  function getAccountLabel(acc) {
    const id = acc.id ?? acc;
    const nick = nicknames[id];
    const name =
      nick?.nickname ??
      acc.debit_details?.[0]?.account_name ??
      acc.name ??
      id;
    const bal =
      acc.available_balance != null
        ? ` (${formatSGD(acc.available_balance / 100)})`
        : "";
    return `${name}${bal}`;
  }

  // ─── Load Aspire accounts ─────────────────────────────────────────────────────

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

  // ─── Import handlers ──────────────────────────────────────────────────────────

  async function handleAspireImport() {
    if (!selectedAccount || !fromDate || !toDate) return;
    setImportResult(null);
    const result = await importFromAspire(selectedAccount, fromDate, toDate);
    if (result?.batchId) {
      setBatchId(result.batchId);
      // Count income vs expense from the batch
      const { data: batchTxns } = await supabase
        .from("bank_transactions")
        .select("transaction_type")
        .eq("import_batch_id", result.batchId);
      const incomeCount = (batchTxns ?? []).filter((t) => t.transaction_type === "INCOME").length;
      const expenseCount = (batchTxns ?? []).filter((t) => t.transaction_type === "EXPENSE").length;
      setImportResult({ total: result.total, autoTagged: result.autoTagged, incomeCount, expenseCount });
    }
  }

  async function handleCsvUpload(file) {
    setImportResult(null);
    const result = await importFromCsv(file);
    if (result?.batchId) {
      setBatchId(result.batchId);
      const { data: batchTxns } = await supabase
        .from("bank_transactions")
        .select("transaction_type")
        .eq("import_batch_id", result.batchId);
      const incomeCount = (batchTxns ?? []).filter((t) => t.transaction_type === "INCOME").length;
      const expenseCount = (batchTxns ?? []).filter((t) => t.transaction_type === "EXPENSE").length;
      setImportResult({ total: result.total, autoTagged: result.autoTagged, incomeCount, expenseCount });
    }
  }

  const hasBatch = !!batchId;

  return (
    <PortalLayout>
      {/* Page header */}
      <div className="mb-8">
        <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-1">
          Accounting
        </p>
        <h1 className="font-['Plus_Jakarta_Sans'] text-2xl font-bold text-[#121c2a]">
          Smart Transaction Import
        </h1>
        <p className="font-['Manrope'] text-sm text-[#6c7a77] mt-1">
          Import transactions from Aspire or a CSV file, then review and tag them as income or expenses.
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
                {/* Account selector with nickname */}
                <div>
                  <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block mb-1.5">
                    Account
                  </label>
                  {accountsLoading ? (
                    <div className="h-10 bg-[#eff4ff] rounded-xl animate-pulse w-64" />
                  ) : (
                    <div className="flex items-center gap-3">
                      <select
                        value={selectedAccount}
                        onChange={(e) => setSelectedAccount(e.target.value)}
                        className="w-full max-w-xs h-10 px-3 rounded-xl border border-[#bbcac6]/40 bg-white font-['Manrope'] text-sm text-[#121c2a] focus:outline-none focus:ring-2 focus:ring-[#006b5f]/30"
                      >
                        {accounts.length === 0 && (
                          <option value="">No accounts found</option>
                        )}
                        {accounts.map((acc) => (
                          <option key={acc.id ?? acc} value={acc.id ?? acc}>
                            {getAccountLabel(acc)}
                          </option>
                        ))}
                      </select>

                      {/* Nickname display / edit */}
                      {selectedAccount && (
                        <>
                          {editingNickname === selectedAccount ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={nicknameInput}
                                onChange={(e) => setNicknameInput(e.target.value)}
                                placeholder="Nickname..."
                                className="h-8 px-2 rounded-lg border border-[#bbcac6]/40 text-xs font-['Manrope'] focus:outline-none focus:ring-2 focus:ring-[#006b5f]/30"
                                onKeyDown={(e) => e.key === "Enter" && saveNickname(selectedAccount)}
                              />
                              <button
                                onClick={() => saveNickname(selectedAccount)}
                                className="h-8 px-2 rounded-lg bg-[#006b5f] text-white text-xs font-semibold"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setEditingNickname(null);
                                  setNicknameInput("");
                                }}
                                className="h-8 px-2 rounded-lg border border-[#bbcac6]/30 text-xs text-[#6c7a77]"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingNickname(selectedAccount);
                                setNicknameInput(nicknames[selectedAccount]?.nickname ?? "");
                              }}
                              className="text-xs text-[#006b5f] font-['Manrope'] font-semibold hover:underline flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[14px]">edit</span>
                              {nicknames[selectedAccount]?.nickname
                                ? `"${nicknames[selectedAccount].nickname}"`
                                : "Set nickname"}
                            </button>
                          )}
                        </>
                      )}
                    </div>
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
                      Importing... {progress?.inserted ?? 0}/{progress?.total ?? 0}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <MetricCard
              label="Imported"
              value={importResult?.total ?? stats?.total ?? transactions.length}
              icon="receipt_long"
              color="#006b5f"
            />
            <MetricCard
              label="Auto-Tagged"
              value={importResult?.autoTagged ?? stats?.autoTagged}
              icon="auto_awesome"
              color="#4f7cff"
            />
            <MetricCard
              label="Needs Review"
              value={stats?.pending}
              icon="pending_actions"
              color="#f59e0b"
            />
            <MetricCard
              label="Income"
              value={importResult?.incomeCount ?? "--"}
              icon="trending_up"
              color="#16a34a"
            />
            <MetricCard
              label="Expenses"
              value={importResult?.expenseCount ?? "--"}
              icon="trending_down"
              color="#ba1a1a"
            />
          </div>

          {/* Review board */}
          {reviewLoading ? (
            <div className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm p-10 flex items-center justify-center gap-3">
              <span className="material-symbols-outlined text-[#006b5f] text-[24px] animate-spin">
                progress_activity
              </span>
              <p className="font-['Manrope'] text-sm text-[#6c7a77]">
                Loading transactions...
              </p>
            </div>
          ) : (
            <TransactionReviewBoard
              transactions={transactions}
              properties={properties}
              rooms={rooms}
              onConfirm={confirmTag}
              onIgnore={ignoreTransaction}
              onBulkConfirm={bulkConfirmAutoTagged}
              onAssignRoom={assignRoom}
              stats={stats}
              typeFilter={typeFilter}
              onTypeFilterChange={setTypeFilter}
            />
          )}
        </>
      )}
    </PortalLayout>
  );
}
