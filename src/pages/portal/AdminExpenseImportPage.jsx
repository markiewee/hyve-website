import { useEffect, useState, useCallback, useMemo } from "react";
import PortalLayout from "../../components/portal/PortalLayout";
import CsvUploader from "../../components/portal/CsvUploader";
import { useTransactionImport } from "../../hooks/useTransactionImport";
import { aspire } from "../../lib/aspire";
import { supabase } from "../../lib/supabase";
import { extractVendorPattern } from "../../lib/tagging";

// ─── Constants ─────────────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES = [
  { key: "MASTER_LEASE", label: "Master Lease", icon: "home" },
  { key: "UTILITIES", label: "Utilities", icon: "bolt" },
  { key: "MAINTENANCE", label: "Maintenance", icon: "build" },
  { key: "CLEANING", label: "Cleaning", icon: "cleaning_services" },
  { key: "SUPPLIES", label: "Supplies", icon: "inventory_2" },
  { key: "WIFI", label: "WiFi", icon: "wifi" },
  { key: "INSURANCE", label: "Insurance", icon: "shield" },
  { key: "STAFF", label: "Staff", icon: "badge" },
  { key: "PLATFORM_FEES", label: "Platform Fees", icon: "devices" },
  { key: "FURNISHING", label: "Furnishing", icon: "chair" },
  { key: "MARKETING", label: "Marketing", icon: "campaign" },
  { key: "GOODS_TRANSPORT", label: "Goods Transportation", icon: "local_shipping" },
  { key: "OTHER_EXPENSE", label: "Other Expense", icon: "more_horiz" },
];

const TAB_ASPIRE = "aspire";
const TAB_CSV = "csv";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatSGD(amount) {
  if (amount == null) return "--";
  const num = Number(amount);
  const prefix = num < 0 ? "-" : "";
  return `${prefix}$${Math.abs(num).toLocaleString("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
  });
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthRange(monthStr) {
  const [y, m] = monthStr.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

function formatMonthLabel(monthStr) {
  const [y, m] = monthStr.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("en-SG", { month: "long", year: "numeric" });
}

function categoryLabel(key) {
  const cat = EXPENSE_CATEGORIES.find((c) => c.key === key);
  return cat ? cat.label : key?.replace(/_/g, " ") ?? "--";
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function AdminExpenseImportPage() {
  const [activeTab, setActiveTab] = useState(TAB_ASPIRE);

  // Aspire accounts
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [nicknames, setNicknames] = useState({});

  // Month picker
  const [reconcileMonth, setReconcileMonth] = useState(getCurrentMonth());

  // Fetch state
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Transactions (split view)
  const [untagged, setUntagged] = useState([]);
  const [tagged, setTagged] = useState([]);
  const [ignored, setIgnored] = useState([]);

  // Reference data
  const [properties, setProperties] = useState([]);
  const [rooms, setRooms] = useState([]);

  // Per-card editing state: { [txnRef]: { property_id, room_id, category } }
  const [edits, setEdits] = useState({});

  // Saving state
  const [saving, setSaving] = useState(null);
  const [message, setMessage] = useState(null);

  // Resume state
  const [resumeAvailable, setResumeAvailable] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);

  // Save state
  const [savingAll, setSavingAll] = useState(false);

  // P&L report
  const [showPnl, setShowPnl] = useState(false);
  const [pnlData, setPnlData] = useState(null);
  const [pnlLoading, setPnlLoading] = useState(false);
  const [isFinalized, setIsFinalized] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  // CSV fallback
  const { importFromCsv, importing, progress, error: csvError } = useTransactionImport();

  // ─── Load reference data ──────────────────────────────────────────────────────

  const fetchNicknames = useCallback(async () => {
    const { data } = await supabase.from("account_nicknames").select("*");
    const map = {};
    (data ?? []).forEach((n) => {
      map[n.aspire_account_id] = n;
    });
    setNicknames(map);
  }, []);

  const fetchProperties = useCallback(async () => {
    const { data } = await supabase
      .from("properties")
      .select("id, name, code")
      .order("name", { ascending: true });
    setProperties(data ?? []);
  }, []);

  const fetchRooms = useCallback(async () => {
    const { data } = await supabase
      .from("rooms")
      .select("id, name, property_id, unit_code")
      .order("name", { ascending: true });
    setRooms(data ?? []);
  }, []);

  const checkFinalized = useCallback(async (month) => {
    const monthDate = month + "-01";
    const { data } = await supabase
      .from("monthly_financials")
      .select("id, status")
      .eq("month", monthDate)
      .eq("status", "FINALIZED")
      .limit(1);
    setIsFinalized((data ?? []).length > 0);
  }, []);

  useEffect(() => {
    fetchNicknames();
    fetchProperties();
    fetchRooms();
  }, [fetchNicknames, fetchProperties, fetchRooms]);

  // ─── Check for resumable bank_transactions ────────────────────────────────────

  const checkResumable = useCallback(async (month) => {
    const { from, to } = getMonthRange(month);
    const { count } = await supabase
      .from("bank_transactions")
      .select("id", { count: "exact", head: true })
      .gte("transaction_date", from)
      .lte("transaction_date", to);
    setResumeAvailable((count ?? 0) > 0);
  }, []);

  async function handleResume() {
    if (!reconcileMonth) return;
    setResumeLoading(true);
    setFetchError(null);
    setUntagged([]);
    setTagged([]);
    setIgnored([]);
    setEdits({});
    setMessage(null);
    setShowPnl(false);
    setPnlData(null);

    try {
      const { from, to } = getMonthRange(reconcileMonth);

      const { data: rows, error } = await supabase
        .from("bank_transactions")
        .select("*")
        .gte("transaction_date", from)
        .lte("transaction_date", to)
        .order("transaction_date", { ascending: true });

      if (error) throw error;
      if (!rows || rows.length === 0) {
        setFetchError("No saved transactions found for this month.");
        return;
      }

      const withKeys = rows.map((r, i) => ({
        ...r,
        _key: r.reference || `bt-${r.id}-${i}`,
        amount: Number(r.amount),
      }));

      const resumedUntagged = [];
      const resumedTagged = [];
      const resumedIgnored = [];

      for (const txn of withKeys) {
        if (txn.status === "CONFIRMED") {
          resumedTagged.push({
            ...txn,
            _alreadyConfirmed: false,
            _accrualMonth: txn.transaction_date?.slice(0, 7) || reconcileMonth,
            _bankTxnId: txn.id,
          });
        } else if (txn.status === "IGNORED") {
          resumedIgnored.push({ ...txn, _bankTxnId: txn.id });
        } else {
          resumedUntagged.push({ ...txn, _bankTxnId: txn.id });
        }
      }

      setUntagged(resumedUntagged);
      setTagged(resumedTagged);
      setIgnored(resumedIgnored);
      setMessage({
        type: "success",
        text: `Resumed ${withKeys.length} transactions (${resumedTagged.length} tagged, ${resumedIgnored.length} ignored, ${resumedUntagged.length} pending).`,
      });
    } catch (err) {
      setFetchError(err?.message ?? "Failed to resume transactions.");
    } finally {
      setResumeLoading(false);
    }
  }

  useEffect(() => {
    checkFinalized(reconcileMonth);
    checkResumable(reconcileMonth);
  }, [reconcileMonth, checkFinalized, checkResumable]);

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
            ? "Aspire credentials are not configured."
            : err?.message ?? "Failed to load Aspire accounts."
        );
      })
      .finally(() => setAccountsLoading(false));
  }, []);

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

  // ─── Fetch transactions ───────────────────────────────────────────────────────

  async function handleFetchAspire() {
    if (!selectedAccount || !reconcileMonth) return;

    setFetching(true);
    setFetchError(null);
    setUntagged([]);
    setTagged([]);
    setIgnored([]);
    setEdits({});
    setMessage(null);
    setShowPnl(false);
    setPnlData(null);

    try {
      const { from, to } = getMonthRange(reconcileMonth);

      // Fetch from Aspire
      const rawTxns = await aspire.getTransactions(selectedAccount, {
        from_date: from,
        to_date: to,
        per_page: 500,
      });

      // Filter to debit (expense) transactions only
      const debitTxns = rawTxns.filter(
        (t) => t.transaction_type === "EXPENSE" || Number(t.amount) < 0
      );

      if (debitTxns.length === 0) {
        setFetchError("No debit transactions found for this month.");
        return;
      }

      // Add unique keys for tracking (reference alone isn't unique — combine with amount + date + description)
      const withKeys = debitTxns.map((t, i) => ({
        ...t,
        _key: `${t.reference || "no-ref"}-${t.transaction_date}-${t.amount}-${(t.description || "").slice(0, 20)}-${i}`,
      }));

      // Save to bank_transactions — keep original reference, skip if already exists
      const existingRefs = new Set();
      if (withKeys.some((t) => t.reference)) {
        const { data: existingBt } = await supabase
          .from("bank_transactions")
          .select("reference")
          .in("reference", withKeys.filter((t) => t.reference).map((t) => t.reference));
        for (const r of existingBt ?? []) existingRefs.add(r.reference);
      }

      const btRows = withKeys
        .filter((t) => t.reference && !existingRefs.has(t.reference))
        .map((t) => ({
          reference: t.reference,
          transaction_date: t.transaction_date,
          description: t.description,
          amount: Number(t.amount),
          currency: t.currency || "SGD",
          status: "UNTAGGED",
          transaction_type: Number(t.amount) < 0 ? "EXPENSE" : "INCOME",
        }));

      if (btRows.length > 0) {
        const { error: upsertErr } = await supabase
          .from("bank_transactions")
          .insert(btRows);
        if (upsertErr) {
          console.warn("[ExpenseImport] bank_transactions upsert warning:", upsertErr.message);
        }
      }

      // Fetch bank_transactions IDs for these references (to link _bankTxnId)
      const refs = withKeys.map((t) => t.reference).filter(Boolean);
      let btIdMap = {};
      if (refs.length > 0) {
        const { data: btData } = await supabase
          .from("bank_transactions")
          .select("id, reference, status, property_id, category, room_id")
          .in("reference", refs);
        for (const bt of btData ?? []) {
          btIdMap[bt.reference] = bt;
        }
      }

      // Check which have already been confirmed in property_expenses (any month)
      const { data: existingExpenses } = await supabase
        .from("property_expenses")
        .select("description, amount");

      const existingSet = new Set(
        (existingExpenses ?? []).map(
          (e) => `${e.description}|${e.amount}`
        )
      );

      const alreadyTagged = [];
      const needsTagging = [];

      for (const txn of withKeys) {
        const btRow = btIdMap[txn.reference];
        const enriched = { ...txn, _bankTxnId: btRow?.id };

        // If bank_transactions says CONFIRMED or IGNORED, respect that
        if (btRow?.status === "CONFIRMED") {
          alreadyTagged.push({
            ...enriched,
            _alreadyConfirmed: true,
            property_id: btRow.property_id,
            category: btRow.category,
            room_id: btRow.room_id,
            _accrualMonth: txn.transaction_date?.slice(0, 7) || reconcileMonth,
          });
        } else if (btRow?.status === "IGNORED") {
          // Will go to ignored list below
          needsTagging.push({ ...enriched, _wasIgnored: true });
        } else {
          const sig = `${txn.description}|${txn.amount}`;
          if (existingSet.has(sig)) {
            alreadyTagged.push({ ...enriched, _alreadyConfirmed: true });
          } else {
            needsTagging.push(enriched);
          }
        }
      }

      // Split out previously ignored
      const actuallyIgnored = needsTagging.filter((t) => t._wasIgnored);
      const actuallyUntagged = needsTagging.filter((t) => !t._wasIgnored);

      setUntagged(actuallyUntagged);
      setTagged(alreadyTagged);
      setIgnored(actuallyIgnored);
      setResumeAvailable(true);
    } catch (err) {
      setFetchError(err?.message ?? "Failed to fetch transactions.");
    } finally {
      setFetching(false);
    }
  }

  // ─── CSV fallback ─────────────────────────────────────────────────────────────

  async function handleCsvUpload(file) {
    setMessage(null);
    try {
      const result = await importFromCsv(file);
      if (result?.batchId) {
        setMessage({
          type: "success",
          text: `Imported ${result.total} transactions (${result.autoTagged} auto-tagged). Refresh Aspire tab to review.`,
        });
      }
    } catch (err) {
      setMessage({ type: "error", text: err?.message ?? "CSV import failed." });
    }
  }

  // ─── Save All Progress ────────────────────────────────────────────────────────

  async function handleSaveAll() {
    setSavingAll(true);
    setMessage(null);

    try {
      const allTxns = [
        ...untagged.map((t) => ({ ...t, _status: "UNTAGGED" })),
        ...tagged.map((t) => ({ ...t, _status: "CONFIRMED" })),
        ...ignored.map((t) => ({ ...t, _status: "IGNORED" })),
      ];

      let saved = 0;
      for (const txn of allTxns) {
        if (!txn.reference) continue;

        const row = {
          reference: txn.reference,
          transaction_date: txn.transaction_date,
          description: txn.description,
          amount: Math.abs(Number(txn.amount)),
          currency: txn.currency || "SGD",
          status: txn._status,
          transaction_type: Number(txn.amount) < 0 ? "EXPENSE" : "INCOME",
          property_id: txn.property_id || null,
          category: txn.category || null,
          room_id: txn.room_id || null,
        };

        // Try update first, insert if not exists
        const { data: existing } = await supabase
          .from("bank_transactions")
          .select("id")
          .eq("reference", txn.reference)
          .limit(1);

        if (existing && existing.length > 0) {
          await supabase
            .from("bank_transactions")
            .update(row)
            .eq("id", existing[0].id);
        } else {
          await supabase.from("bank_transactions").insert(row);
        }
        saved++;
      }

      setMessage({ type: "success", text: `Progress saved — ${saved} transactions stored.` });
    } catch (err) {
      setMessage({ type: "error", text: `Save failed: ${err.message}` });
    } finally {
      setSavingAll(false);
    }
  }

  // ─── Edit helpers ─────────────────────────────────────────────────────────────

  function getEdit(txnKey) {
    return edits[txnKey] ?? {};
  }

  function setEdit(txnKey, field, value) {
    setEdits((prev) => ({
      ...prev,
      [txnKey]: { ...prev[txnKey], [field]: value },
    }));
  }

  // Rooms filtered by selected property
  function getRoomsForProperty(propertyId) {
    if (!propertyId) return [];
    return rooms.filter((r) => r.property_id === propertyId);
  }

  // ─── Confirm a transaction ────────────────────────────────────────────────────

  async function handleConfirm(txn, overridePropertyId, overrideCategory) {
    const edit = getEdit(txn._key);
    const propertyId = overridePropertyId ?? edit.property_id ?? txn.property_id;
    const category = overrideCategory ?? edit.category ?? txn.category;
    const roomId = edit.room_id ?? null;

    if (!propertyId || !category) {
      setMessage({ type: "error", text: "Please select a property and category." });
      return;
    }

    setSaving(txn._key);
    setMessage(null);

    try {
      const accrualMonth = edit.accrual_month ?? reconcileMonth;
      const monthDate = accrualMonth + "-01";
      const absAmount = Math.abs(Number(txn.amount));

      // 1. Insert into property_expenses
      const { data: expenseRow, error: expenseErr } = await supabase.from("property_expenses").insert({
        property_id: propertyId,
        month: monthDate,
        category,
        description: txn.description,
        amount: absAmount,
        is_recurring: false,
      }).select("id").single();
      if (expenseErr) throw expenseErr;

      // 2. Upsert tagging rule
      const vendorPattern = extractVendorPattern(txn.description);
      if (vendorPattern) {
        const { data: existingRules } = await supabase
          .from("tagging_rules")
          .select("id, hit_count")
          .eq("vendor_pattern", vendorPattern)
          .eq("category", category)
          .eq("property_id", propertyId);

        if (existingRules && existingRules.length > 0) {
          await supabase
            .from("tagging_rules")
            .update({
              hit_count: (existingRules[0].hit_count ?? 0) + 1,
              last_used_at: new Date().toISOString(),
            })
            .eq("id", existingRules[0].id);
        } else {
          await supabase.from("tagging_rules").insert({
            vendor_pattern: vendorPattern,
            property_id: propertyId,
            category,
            hit_count: 1,
            last_used_at: new Date().toISOString(),
          });
        }
      }

      // 3. Update bank_transactions status
      if (txn._bankTxnId) {
        await supabase
          .from("bank_transactions")
          .update({
            status: "CONFIRMED",
            property_id: propertyId,
            category,
            room_id: roomId,
          })
          .eq("id", txn._bankTxnId);
      }

      // 4. Move from untagged to tagged
      const confirmedTxn = {
        ...txn,
        property_id: propertyId,
        category,
        room_id: roomId,
        status: "CONFIRMED",
        _expenseId: expenseRow?.id,
        _accrualMonth: accrualMonth,
      };
      setUntagged((prev) => prev.filter((t) => t._key !== txn._key));
      setTagged((prev) => [confirmedTxn, ...prev]);
      setEdits((prev) => {
        const next = { ...prev };
        delete next[txn._key];
        return next;
      });
    } catch (err) {
      setMessage({ type: "error", text: `Failed to confirm: ${err.message}` });
    } finally {
      setSaving(null);
    }
  }

  // ─── Ignore a transaction ─────────────────────────────────────────────────────

  async function handleIgnore(txn) {
    setUntagged((prev) => prev.filter((t) => t._key !== txn._key));
    setIgnored((prev) => [...prev, txn]);
    // Persist to bank_transactions
    if (txn._bankTxnId) {
      await supabase
        .from("bank_transactions")
        .update({ status: "IGNORED" })
        .eq("id", txn._bankTxnId);
    }
  }

  async function handleUnignore(txn) {
    setIgnored((prev) => prev.filter((t) => t._key !== txn._key));
    setUntagged((prev) => [...prev, txn]);
    // Persist to bank_transactions
    if (txn._bankTxnId) {
      await supabase
        .from("bank_transactions")
        .update({ status: "UNTAGGED" })
        .eq("id", txn._bankTxnId);
    }
  }

  async function handleUndoTagged(txn) {
    // Delete from property_expenses if we have the ID
    if (txn._expenseId) {
      const { error } = await supabase
        .from("property_expenses")
        .delete()
        .eq("id", txn._expenseId);
      if (error) {
        setMessage({ type: "error", text: `Failed to undo: ${error.message}` });
        return;
      }
    }
    // Reset bank_transactions status
    if (txn._bankTxnId) {
      await supabase
        .from("bank_transactions")
        .update({ status: "UNTAGGED", property_id: null, category: null, room_id: null })
        .eq("id", txn._bankTxnId);
    }
    // Move back to untagged
    setTagged((prev) => prev.filter((t) => t._key !== txn._key));
    setUntagged((prev) => [...prev, { ...txn, status: "UNTAGGED", _expenseId: undefined, _accrualMonth: undefined }]);
  }

  // ─── Summary computation ──────────────────────────────────────────────────────

  // Group tagged transactions by property -> accrualMonth -> category
  const summary = useMemo(() => {
    const byProperty = {};
    for (const txn of tagged) {
      const propId = txn.property_id;
      if (!propId) continue;
      const month = txn._accrualMonth || reconcileMonth;
      if (!byProperty[propId]) byProperty[propId] = {};
      if (!byProperty[propId][month]) byProperty[propId][month] = {};
      const cat = txn.category || "OTHER_EXPENSE";
      byProperty[propId][month][cat] =
        (byProperty[propId][month][cat] || 0) + Math.abs(Number(txn.amount));
    }
    return byProperty;
  }, [tagged, reconcileMonth]);

  function getPropertyName(propId) {
    const p = properties.find((p) => p.id === propId);
    return p?.name ?? p?.code ?? propId;
  }

  function getPropertyCode(propId) {
    const p = properties.find((p) => p.id === propId);
    return p?.code ?? "--";
  }

  // ─── P&L Report ───────────────────────────────────────────────────────────────

  async function handleGeneratePnl() {
    setPnlLoading(true);
    setPnlData(null);
    setShowPnl(true);

    try {
      const monthDate = reconcileMonth + "-01";
      const [y, m] = reconcileMonth.split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const monthEnd = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      // Fetch income from rent_payments
      const { data: rentData } = await supabase
        .from("rent_payments")
        .select("rent_amount, paid_amount, status, tenant_profiles(rooms(property_id))")
        .eq("status", "PAID")
        .eq("month", monthDate);

      // Fetch expenses from property_expenses
      const { data: expenseData } = await supabase
        .from("property_expenses")
        .select("property_id, category, amount")
        .eq("month", monthDate);

      // Build income by property
      const incomeByProperty = {};
      for (const r of rentData ?? []) {
        const propId = r.tenant_profiles?.rooms?.property_id;
        if (!propId) continue;
        incomeByProperty[propId] =
          (incomeByProperty[propId] || 0) + Number(r.paid_amount ?? r.rent_amount ?? 0);
      }

      // Build expenses by property + category
      const expenseByPropCat = {};
      const allCategories = new Set();
      for (const e of expenseData ?? []) {
        const propId = e.property_id;
        if (!propId) continue;
        const cat = e.category || "OTHER_EXPENSE";
        allCategories.add(cat);
        if (!expenseByPropCat[propId]) expenseByPropCat[propId] = {};
        expenseByPropCat[propId][cat] =
          (expenseByPropCat[propId][cat] || 0) + Math.abs(Number(e.amount));
      }

      // Combine all property IDs
      const allPropIds = [
        ...new Set([...Object.keys(incomeByProperty), ...Object.keys(expenseByPropCat)]),
      ];

      setPnlData({
        month: reconcileMonth,
        properties: allPropIds,
        income: incomeByProperty,
        expenses: expenseByPropCat,
        categories: [...allCategories].sort(),
      });
    } catch (err) {
      setMessage({ type: "error", text: `Failed to generate P&L: ${err.message}` });
    } finally {
      setPnlLoading(false);
    }
  }

  async function handleFinalizeMonth() {
    if (!pnlData) return;
    setFinalizing(true);

    try {
      const monthDate = reconcileMonth + "-01";

      for (const propId of pnlData.properties) {
        const totalIncome = pnlData.income[propId] || 0;
        const propExpenses = pnlData.expenses[propId] || {};
        const totalExpenses = Object.values(propExpenses).reduce((s, v) => s + v, 0);
        const netProfit = totalIncome - totalExpenses;

        // 1. Upsert monthly_financials
        await supabase.from("monthly_financials").upsert(
          {
            property_id: propId,
            month: monthDate,
            revenue: totalIncome,
            expenses: totalExpenses,
            net_profit: netProfit,
            status: "FINALIZED",
            finalized_at: new Date().toISOString(),
          },
          { onConflict: "property_id,month" }
        );

        // 2. Auto-create investor report with financials
        const propName = properties.find((p) => p.id === propId)?.name ?? "";
        await supabase.from("investor_reports").upsert(
          {
            property_id: propId,
            month: monthDate,
            title: `${formatMonthLabel(reconcileMonth)} Monthly Report`,
            category: "Monthly P&L",
            total_revenue: totalIncome,
            total_expenses: totalExpenses,
            net_income: netProfit,
          },
          { onConflict: "property_id,month,category" }
        );
      }

      setIsFinalized(true);
      setMessage({ type: "success", text: "Month finalized successfully." });
    } catch (err) {
      setMessage({ type: "error", text: `Failed to finalize: ${err.message}` });
    } finally {
      setFinalizing(false);
    }
  }

  // ─── Derived state ────────────────────────────────────────────────────────────

  const hasFetched = untagged.length > 0 || tagged.length > 0 || ignored.length > 0;
  const totalSummary = useMemo(() => {
    let total = 0;
    for (const months of Object.values(summary)) {
      for (const cats of Object.values(months)) {
        for (const amt of Object.values(cats)) {
          total += amt;
        }
      }
    }
    return total;
  }, [summary]);

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <PortalLayout>
      {/* Page header */}
      <div className="mb-8">
        <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-1">
          Accounting
        </p>
        <h1 className="font-['Plus_Jakarta_Sans'] text-2xl font-bold text-[#121c2a]">
          Expense Reconciliation
        </h1>
        <p className="font-['Manrope'] text-sm text-[#6c7a77] mt-1">
          Fetch debit transactions from Aspire, tag to properties and categories, then generate P&L reports.
        </p>
      </div>

      {/* Feedback message */}
      {message && (
        <div
          className={`mb-6 px-5 py-3 rounded-xl text-sm font-['Manrope'] font-medium flex items-center gap-2 ${
            message.type === "success"
              ? "bg-[#d1fae5]/60 text-[#065f46] border border-[#d1fae5]"
              : "bg-[#ffdad6]/40 text-[#ba1a1a] border border-[#ffdad6]"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">
            {message.type === "success" ? "check_circle" : "error"}
          </span>
          {message.text}
          <button
            onClick={() => setMessage(null)}
            className="ml-auto text-xs opacity-60 hover:opacity-100"
          >
            dismiss
          </button>
        </div>
      )}

      {/* Finalized banner */}
      {isFinalized && (
        <div className="mb-6 px-5 py-3 rounded-xl bg-[#d1fae5]/60 border border-[#d1fae5] flex items-center gap-2">
          <span className="material-symbols-outlined text-[#065f46] text-[18px]">verified</span>
          <span className="font-['Manrope'] text-sm font-semibold text-[#065f46]">
            {formatMonthLabel(reconcileMonth)} has been finalized.
          </span>
        </div>
      )}

      {/* ── Import Source Section ── */}
      <div className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-[#bbcac6]/15 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <div className="flex gap-1 bg-[#eff4ff] rounded-xl p-1 w-fit">
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
          </div>

          {/* Aspire controls (in the header bar, matching rent reconciliation) */}
          {activeTab === TAB_ASPIRE && (
            <div className="flex items-center gap-3 flex-wrap">
              {accountsLoading ? (
                <div className="h-10 bg-[#eff4ff] rounded-xl animate-pulse w-48" />
              ) : accountsError ? (
                <span className="font-['Manrope'] text-xs text-red-600">{accountsError}</span>
              ) : (
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-[#bbcac6]/30 text-sm font-['Manrope'] focus:outline-none focus:ring-2 focus:ring-[#006b5f] bg-white max-w-[220px]"
                >
                  <option value="">Select account...</option>
                  {accounts.map((acc) => (
                    <option key={acc.id ?? acc} value={acc.id ?? acc}>
                      {getAccountLabel(acc)}
                    </option>
                  ))}
                </select>
              )}
              <input
                type="month"
                value={reconcileMonth}
                onChange={(e) => setReconcileMonth(e.target.value)}
                className="px-3 py-2 rounded-lg border border-[#bbcac6]/30 text-sm font-['Manrope'] focus:outline-none focus:ring-2 focus:ring-[#006b5f]"
              />
              <button
                onClick={handleFetchAspire}
                disabled={fetching || !selectedAccount}
                className="px-5 py-2.5 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2 shrink-0"
              >
                <span className="material-symbols-outlined text-[18px]">account_balance</span>
                {fetching ? "Fetching..." : "Fetch Aspire"}
              </button>
              {resumeAvailable && !hasFetched && (
                <button
                  onClick={handleResume}
                  disabled={resumeLoading}
                  className="px-5 py-2.5 bg-white text-[#006b5f] border-2 border-[#006b5f] rounded-xl font-['Manrope'] font-bold text-sm hover:bg-[#006b5f]/5 disabled:opacity-50 transition-all flex items-center gap-2 shrink-0"
                >
                  <span className="material-symbols-outlined text-[18px]">history</span>
                  {resumeLoading ? "Loading..." : "Resume Progress"}
                </button>
              )}
              {hasFetched && (
                <button
                  onClick={handleSaveAll}
                  disabled={savingAll}
                  className="px-5 py-2.5 bg-amber-500 text-white rounded-xl font-['Manrope'] font-bold text-sm hover:bg-amber-600 disabled:opacity-50 transition-all flex items-center gap-2 shrink-0"
                >
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  {savingAll ? "Saving..." : "Save Progress"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {fetchError && (
          <div className="px-8 py-3 bg-[#ffdad6]/30 text-[#ba1a1a] font-['Manrope'] text-sm">
            {fetchError}
          </div>
        )}

        {/* CSV Upload tab content */}
        {activeTab === TAB_CSV && (
          <div className="p-8">
            {csvError && (
              <p className="font-['Manrope'] text-sm text-red-600 mb-4">{csvError}</p>
            )}
            <CsvUploader
              onFileSelected={handleCsvUpload}
              importing={importing}
              progress={progress}
            />
          </div>
        )}

        {/* Aspire tab: Split View */}
        {activeTab === TAB_ASPIRE && hasFetched && (
          <>
            {/* Loading spinner */}
            {fetching && (
              <div className="px-8 py-8 flex items-center justify-center gap-3">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#006b5f] border-r-transparent" />
                <span className="font-['Manrope'] text-sm text-[#6c7a77]">
                  Fetching transactions...
                </span>
              </div>
            )}

            {!fetching && (
              <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#bbcac6]/15">
                {/* ── LEFT: Untagged Transactions ── */}
                <div className="p-6">
                  <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-4">
                    Untagged ({untagged.length})
                  </p>
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                    {untagged.length === 0 ? (
                      <p className="text-center text-[#6c7a77] font-['Manrope'] text-sm py-8">
                        All transactions tagged!
                      </p>
                    ) : (
                      untagged.map((txn) => {
                        const edit = getEdit(txn._key);
                        const isSaving = saving === txn._key;

                        return (
                          <div
                            key={txn._key}
                            className="rounded-xl border p-4 transition-all bg-white border-[#bbcac6]/15"
                          >
                            {/* Transaction header */}
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-['Manrope'] font-bold text-sm text-[#121c2a] truncate">
                                  {txn.description || "Unknown"}
                                </p>
                                <p className="font-['Inter'] text-xs text-[#6c7a77] mt-0.5">
                                  {formatDate(txn.transaction_date)}
                                  {txn.reference && (
                                    <span className="ml-2 text-[#bbcac6]">
                                      Ref: {txn.reference}
                                    </span>
                                  )}
                                </p>
                              </div>
                              <p className="font-['Plus_Jakarta_Sans'] font-bold text-sm shrink-0 text-red-600 tabular-nums">
                                {formatSGD(txn.amount)}
                              </p>
                            </div>

                            {/* Tagging form */}
                              <div className="mt-3 space-y-2">
                                <div className="flex flex-wrap gap-2">
                                  {/* Property dropdown */}
                                  <select
                                    value={edit.property_id ?? ""}
                                    onChange={(e) =>
                                      setEdit(txn._key, "property_id", e.target.value)
                                    }
                                    className="flex-1 min-w-[120px] px-2 py-1.5 rounded-lg border border-[#bbcac6]/30 text-xs font-['Manrope'] focus:outline-none focus:ring-2 focus:ring-[#006b5f] bg-white"
                                  >
                                    <option value="">Property...</option>
                                    {properties.map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.code} - {p.name}
                                      </option>
                                    ))}
                                  </select>

                                  {/* Room dropdown (optional, filtered) */}
                                  {edit.property_id && (
                                    <select
                                      value={edit.room_id ?? ""}
                                      onChange={(e) =>
                                        setEdit(txn._key, "room_id", e.target.value || null)
                                      }
                                      className="min-w-[100px] px-2 py-1.5 rounded-lg border border-[#bbcac6]/30 text-xs font-['Manrope'] focus:outline-none focus:ring-2 focus:ring-[#006b5f] bg-white"
                                    >
                                      <option value="">Room (optional)</option>
                                      {getRoomsForProperty(edit.property_id).map((r) => (
                                        <option key={r.id} value={r.id}>
                                          {r.unit_code ?? r.name}
                                        </option>
                                      ))}
                                    </select>
                                  )}

                                  {/* Category dropdown */}
                                  <select
                                    value={edit.category ?? ""}
                                    onChange={(e) =>
                                      setEdit(txn._key, "category", e.target.value)
                                    }
                                    className="flex-1 min-w-[120px] px-2 py-1.5 rounded-lg border border-[#bbcac6]/30 text-xs font-['Manrope'] focus:outline-none focus:ring-2 focus:ring-[#006b5f] bg-white"
                                  >
                                    <option value="">Category...</option>
                                    {EXPENSE_CATEGORIES.map((c) => (
                                      <option key={c.key} value={c.key}>
                                        {c.label}
                                      </option>
                                    ))}
                                  </select>

                                  {/* Accounting period override */}
                                  <select
                                    value={edit.accrual_month ?? reconcileMonth}
                                    onChange={(e) =>
                                      setEdit(txn._key, "accrual_month", e.target.value)
                                    }
                                    title="Accounting period"
                                    className="min-w-[110px] px-2 py-1.5 rounded-lg border border-[#bbcac6]/30 text-xs font-['Manrope'] focus:outline-none focus:ring-2 focus:ring-[#006b5f] bg-white"
                                  >
                                    {Array.from({ length: 12 }, (_, i) => {
                                      const d = new Date();
                                      d.setMonth(d.getMonth() - 6 + i);
                                      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                                      const label = d.toLocaleDateString("en-SG", { month: "short", year: "numeric" });
                                      return <option key={val} value={val}>{label}</option>;
                                    })}
                                  </select>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleConfirm(txn)}
                                    disabled={
                                      isSaving || !edit.property_id || !edit.category
                                    }
                                    className="px-3 py-1.5 bg-[#006b5f] text-white text-xs font-bold rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-1"
                                  >
                                    {isSaving ? (
                                      <span className="material-symbols-outlined text-[14px] animate-spin">
                                        progress_activity
                                      </span>
                                    ) : (
                                      <span className="material-symbols-outlined text-[14px]">
                                        check
                                      </span>
                                    )}
                                    Confirm
                                  </button>
                                  <button
                                    onClick={() => handleIgnore(txn)}
                                    className="px-3 py-1.5 text-[#6c7a77] text-xs font-bold rounded-lg hover:bg-gray-100"
                                  >
                                    Ignore
                                  </button>
                                </div>
                              </div>
                          </div>
                        );
                      })
                    )}

                    {/* Ignored section */}
                    {ignored.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-[#bbcac6]/15">
                        <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-2">
                          Ignored ({ignored.length})
                        </p>
                        {ignored.map((txn) => (
                          <div
                            key={txn._key}
                            className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-gray-50 mb-1"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-['Manrope'] text-xs text-[#6c7a77] truncate">
                                {txn.description}
                              </p>
                            </div>
                            <span className="font-['Plus_Jakarta_Sans'] text-xs text-[#6c7a77] tabular-nums shrink-0">
                              {formatSGD(txn.amount)}
                            </span>
                            <button
                              onClick={() => handleUnignore(txn)}
                              className="text-[10px] text-[#006b5f] font-bold hover:underline shrink-0"
                            >
                              Undo
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── RIGHT: Tagged Transactions ── */}
                <div className="p-6">
                  <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-4">
                    Tagged ({tagged.length})
                  </p>
                  <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                    {tagged.length === 0 ? (
                      <p className="text-center text-[#6c7a77] font-['Manrope'] text-sm py-8">
                        No tagged transactions yet.
                      </p>
                    ) : (
                      // Group by property
                      Object.entries(
                        tagged.reduce((acc, txn) => {
                          const propId = txn.property_id || "_unassigned";
                          if (!acc[propId]) acc[propId] = [];
                          acc[propId].push(txn);
                          return acc;
                        }, {})
                      ).map(([propId, txns]) => (
                        <div key={propId} className="mb-4">
                          <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#006b5f] font-bold mb-2 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[14px]">apartment</span>
                            {propId === "_unassigned" ? "Unassigned" : getPropertyName(propId)}
                          </p>
                          <div className="space-y-1">
                            {txns.map((txn) => (
                              <div
                                key={txn._key}
                                className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-[#d1fae5]/30 border border-[#d1fae5]"
                              >
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-[#eff4ff] text-[#555f6f]">
                                  {categoryLabel(txn.category)}
                                </span>
                                {txn._accrualMonth && txn._accrualMonth !== reconcileMonth && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-amber-100 text-amber-700" title="Accounting period differs from reconciliation month">
                                    {txn._accrualMonth}
                                  </span>
                                )}
                                <p className="font-['Manrope'] text-xs text-[#121c2a] flex-1 min-w-0 truncate">
                                  {txn.description}
                                </p>
                                <p className="font-['Plus_Jakarta_Sans'] font-bold text-xs tabular-nums text-[#121c2a] shrink-0">
                                  {formatSGD(txn.amount)}
                                </p>
                                {txn._alreadyConfirmed && (
                                  <span className="material-symbols-outlined text-[14px] text-[#6c7a77]" title="Previously confirmed">
                                    history
                                  </span>
                                )}
                                {!txn._alreadyConfirmed && (
                                  <button
                                    onClick={() => handleUndoTagged(txn)}
                                    className="text-[#6c7a77] hover:text-[#ba1a1a] transition-colors shrink-0"
                                    title="Undo — move back to untagged"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">undo</span>
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Summary Section ── */}
      {hasFetched && Object.keys(summary).length > 0 && (
        <div className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm overflow-hidden mt-8">
          <div className="px-8 py-6 border-b border-[#bbcac6]/15 flex items-center justify-between">
            <div>
              <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#121c2a]">
                Summary by Property
              </h2>
              <p className="font-['Manrope'] text-[#6c7a77] text-xs mt-0.5">
                Total expenses across all periods: {formatSGD(totalSummary)}
              </p>
            </div>
            <button
              onClick={handleGeneratePnl}
              disabled={pnlLoading}
              className="px-5 py-2.5 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">assessment</span>
              {pnlLoading ? "Generating..." : "Generate P&L Report"}
            </button>
          </div>

          <div className="px-8 py-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(summary).map(([propId, months]) => {
                const propTotal = Object.values(months).reduce(
                  (s, cats) => s + Object.values(cats).reduce((ss, v) => ss + v, 0),
                  0
                );
                const sortedMonths = Object.keys(months).sort();
                return (
                  <div
                    key={propId}
                    className="rounded-xl border border-[#bbcac6]/15 p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#121c2a]">
                        {getPropertyName(propId)}
                      </p>
                      <p className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#006b5f] tabular-nums">
                        {formatSGD(propTotal)}
                      </p>
                    </div>
                    {sortedMonths.map((month) => {
                      const cats = months[month];
                      const monthTotal = Object.values(cats).reduce((s, v) => s + v, 0);
                      return (
                        <div key={month} className={sortedMonths.length > 1 ? "mb-3 last:mb-0" : ""}>
                          {sortedMonths.length > 1 && (
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-['Inter'] text-[9px] uppercase tracking-widest text-[#006b5f] font-bold">
                                {formatMonthLabel(month)}
                              </span>
                              <span className="font-['Plus_Jakarta_Sans'] text-[10px] font-semibold text-[#006b5f] tabular-nums">
                                {formatSGD(monthTotal)}
                              </span>
                            </div>
                          )}
                          <div className="space-y-1">
                            {Object.entries(cats)
                              .sort(([, a], [, b]) => b - a)
                              .map(([cat, amt]) => (
                                <div
                                  key={cat}
                                  className="flex items-center justify-between text-xs"
                                >
                                  <span className="font-['Manrope'] text-[#6c7a77]">
                                    {categoryLabel(cat)}
                                  </span>
                                  <span className="font-['Plus_Jakarta_Sans'] font-semibold text-[#121c2a] tabular-nums">
                                    {formatSGD(amt)}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── P&L Report ── */}
      {showPnl && pnlData && (
        <div className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm overflow-hidden mt-8">
          <div className="px-8 py-6 border-b border-[#bbcac6]/15 flex items-center justify-between">
            <div>
              <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#121c2a]">
                P&L Report -- {formatMonthLabel(pnlData.month)}
              </h2>
              <p className="font-['Manrope'] text-[#6c7a77] text-xs mt-0.5">
                Income from rent payments, expenses from tagged transactions.
              </p>
            </div>
            {isFinalized ? (
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#d1fae5] text-[#065f46] font-['Manrope'] font-bold text-sm">
                <span className="material-symbols-outlined text-[16px]">verified</span>
                Finalized
              </span>
            ) : (
              <button
                onClick={handleFinalizeMonth}
                disabled={finalizing}
                className="px-5 py-2.5 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">lock</span>
                {finalizing ? "Finalizing..." : "Finalize Month"}
              </button>
            )}
          </div>

          <div className="px-8 py-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#bbcac6]/15">
                  <th className="text-left py-3 pr-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">
                    &nbsp;
                  </th>
                  {pnlData.properties.map((propId) => (
                    <th
                      key={propId}
                      className="text-right py-3 px-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold"
                    >
                      {getPropertyName(propId)}
                    </th>
                  ))}
                  <th className="text-right py-3 pl-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#006b5f] font-bold">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Income section */}
                <tr className="bg-[#eff4ff]/50">
                  <td
                    colSpan={pnlData.properties.length + 2}
                    className="py-2 px-0 font-['Inter'] text-[10px] uppercase tracking-widest text-[#006b5f] font-bold"
                  >
                    Income
                  </td>
                </tr>
                <tr className="border-b border-[#bbcac6]/10">
                  <td className="py-2 pr-4 font-['Manrope'] text-[#121c2a]">
                    Rent Collected
                  </td>
                  {pnlData.properties.map((propId) => (
                    <td
                      key={propId}
                      className="py-2 px-4 text-right font-['Plus_Jakarta_Sans'] font-semibold text-[#121c2a] tabular-nums"
                    >
                      {formatSGD(pnlData.income[propId] || 0)}
                    </td>
                  ))}
                  <td className="py-2 pl-4 text-right font-['Plus_Jakarta_Sans'] font-bold text-[#006b5f] tabular-nums">
                    {formatSGD(
                      pnlData.properties.reduce(
                        (s, p) => s + (pnlData.income[p] || 0),
                        0
                      )
                    )}
                  </td>
                </tr>

                {/* Expenses section */}
                <tr className="bg-[#ffdad6]/10">
                  <td
                    colSpan={pnlData.properties.length + 2}
                    className="py-2 px-0 font-['Inter'] text-[10px] uppercase tracking-widest text-[#ba1a1a] font-bold"
                  >
                    Expenses
                  </td>
                </tr>
                {pnlData.categories.map((cat) => (
                  <tr key={cat} className="border-b border-[#bbcac6]/10">
                    <td className="py-2 pr-4 font-['Manrope'] text-[#121c2a]">
                      {categoryLabel(cat)}
                    </td>
                    {pnlData.properties.map((propId) => (
                      <td
                        key={propId}
                        className="py-2 px-4 text-right font-['Plus_Jakarta_Sans'] font-semibold text-[#121c2a] tabular-nums"
                      >
                        {formatSGD(pnlData.expenses[propId]?.[cat] || 0)}
                      </td>
                    ))}
                    <td className="py-2 pl-4 text-right font-['Plus_Jakarta_Sans'] font-semibold text-[#121c2a] tabular-nums">
                      {formatSGD(
                        pnlData.properties.reduce(
                          (s, p) => s + (pnlData.expenses[p]?.[cat] || 0),
                          0
                        )
                      )}
                    </td>
                  </tr>
                ))}

                {/* Total Expenses */}
                <tr className="border-b border-[#bbcac6]/15">
                  <td className="py-2 pr-4 font-['Manrope'] font-bold text-[#121c2a]">
                    Total Expenses
                  </td>
                  {pnlData.properties.map((propId) => {
                    const propExpenses = pnlData.expenses[propId] || {};
                    const total = Object.values(propExpenses).reduce(
                      (s, v) => s + v,
                      0
                    );
                    return (
                      <td
                        key={propId}
                        className="py-2 px-4 text-right font-['Plus_Jakarta_Sans'] font-bold text-[#ba1a1a] tabular-nums"
                      >
                        {formatSGD(total)}
                      </td>
                    );
                  })}
                  <td className="py-2 pl-4 text-right font-['Plus_Jakarta_Sans'] font-bold text-[#ba1a1a] tabular-nums">
                    {formatSGD(
                      pnlData.properties.reduce((s, p) => {
                        const propExpenses = pnlData.expenses[p] || {};
                        return (
                          s +
                          Object.values(propExpenses).reduce((ss, v) => ss + v, 0)
                        );
                      }, 0)
                    )}
                  </td>
                </tr>

                {/* Net Profit */}
                <tr className="bg-[#eff4ff]/30">
                  <td className="py-3 pr-4 font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#121c2a]">
                    Net Profit
                  </td>
                  {pnlData.properties.map((propId) => {
                    const income = pnlData.income[propId] || 0;
                    const propExpenses = pnlData.expenses[propId] || {};
                    const totalExp = Object.values(propExpenses).reduce(
                      (s, v) => s + v,
                      0
                    );
                    const net = income - totalExp;
                    return (
                      <td
                        key={propId}
                        className={`py-3 px-4 text-right font-['Plus_Jakarta_Sans'] font-bold text-lg tabular-nums ${
                          net >= 0 ? "text-[#006b5f]" : "text-[#ba1a1a]"
                        }`}
                      >
                        {net < 0 ? `(${formatSGD(Math.abs(net))})` : formatSGD(net)}
                      </td>
                    );
                  })}
                  <td className="py-3 pl-4 text-right">
                    {(() => {
                      const totalNet = pnlData.properties.reduce((s, p) => {
                        const income = pnlData.income[p] || 0;
                        const propExpenses = pnlData.expenses[p] || {};
                        const totalExp = Object.values(propExpenses).reduce(
                          (ss, v) => ss + v,
                          0
                        );
                        return s + (income - totalExp);
                      }, 0);
                      return (
                        <span
                          className={`font-['Plus_Jakarta_Sans'] font-bold text-lg tabular-nums ${
                            totalNet >= 0 ? "text-[#006b5f]" : "text-[#ba1a1a]"
                          }`}
                        >
                          {totalNet < 0
                            ? `(${formatSGD(Math.abs(totalNet))})`
                            : formatSGD(totalNet)}
                        </span>
                      );
                    })()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
