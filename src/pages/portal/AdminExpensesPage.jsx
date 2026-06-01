import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";
import { confirm } from "../../lib/confirm";

const EXPENSE_CATEGORIES = [
  "MASTER_LEASE",
  "UTILITIES",
  "MAINTENANCE",
  "CLEANING",
  "SUPPLIES",
  "STAFF",
  "PLATFORM_FEES",
  "GOODS_TRANSPORT",
  "MANAGEMENT_FEES",
  "OTHER",
];

const CATEGORY_BADGE = {
  MASTER_LEASE: "bg-blue-500/15 text-blue-300",
  UTILITIES: "bg-amber-500/15 text-amber-300",
  MAINTENANCE: "bg-amber-500/15 text-amber-300",
  CLEANING: "bg-emerald-500/15 text-emerald-300",
  INSURANCE: "bg-purple-500/15 text-purple-300",
  MANAGEMENT_FEE: "bg-blue-500/15 text-blue-300",
  MARKETING: "bg-pink-500/15 text-pink-300",
  SUPPLIES: "bg-white/5 text-foreground-variant",
  STAFF: "bg-purple-500/15 text-purple-300",
  PLATFORM_FEES: "bg-blue-500/15 text-blue-300",
  GOODS_TRANSPORT: "bg-accent/15 text-accent",
  OTHER: "bg-white/5 text-foreground-variant",
};

function formatSGD(amount) {
  if (amount == null) return "—";
  return `$${Number(amount).toLocaleString("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getCurrentMonthStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthStrToFirst(monthStr) {
  return `${monthStr}-01`;
}

export default function AdminExpensesPage() {
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthStr());
  const [expenses, setExpenses] = useState([]);
  const [loadingExpenses, setLoadingExpenses] = useState(false);

  const [form, setForm] = useState({
    category: EXPENSE_CATEGORIES[0],
    description: "",
    amount: "",
    is_recurring: false,
  });
  const [adding, setAdding] = useState(false);
  const [copying, setCopying] = useState(false);

  const fetchProperties = useCallback(async () => {
    const { data } = await supabase
      .from("properties")
      .select("id, name, code")
      .order("name");
    const list = data ?? [];
    setProperties(list);
    if (list.length > 0 && !selectedProperty) {
      setSelectedProperty(list[0].id);
    }
  }, []);

  const fetchExpenses = useCallback(async () => {
    if (!selectedProperty) return;
    setLoadingExpenses(true);

    const monthFirst = monthStrToFirst(selectedMonth);
    const { data, error } = await supabase
      .from("property_expenses")
      .select("*")
      .eq("property_id", selectedProperty)
      .eq("month", monthFirst)
      .order("created_at", { ascending: false });

    if (!error) {
      setExpenses(data ?? []);
    }
    setLoadingExpenses(false);
  }, [selectedProperty, selectedMonth]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!selectedProperty || !form.amount) return;
    setAdding(true);

    const monthFirst = monthStrToFirst(selectedMonth);
    const { error } = await supabase.from("property_expenses").insert({
      property_id: selectedProperty,
      month: monthFirst,
      category: form.category,
      description: form.description,
      amount: Number(form.amount),
      is_recurring: form.is_recurring,
    });

    if (!error) {
      setForm({ category: EXPENSE_CATEGORIES[0], description: "", amount: "", is_recurring: false });
      fetchExpenses();
    } else {
      console.error("Add expense error:", error);
    }
    setAdding(false);
  }

  async function handleDelete(id) {
    if (!await confirm({ title: "Are you sure?" })) return;
    const { error } = await supabase
      .from("property_expenses")
      .delete()
      .eq("id", id);
    if (!error) {
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    }
  }

  async function handleCopyLastMonth() {
    if (!selectedProperty) return;
    setCopying(true);

    const [year, month] = selectedMonth.split("-").map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevMonthFirst = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}-01`;

    const { data: recurringExpenses } = await supabase
      .from("property_expenses")
      .select("*")
      .eq("property_id", selectedProperty)
      .eq("month", prevMonthFirst)
      .eq("is_recurring", true);

    if (!recurringExpenses || recurringExpenses.length === 0) {
      setCopying(false);
      return;
    }

    const currentMonthFirst = monthStrToFirst(selectedMonth);
    const toInsert = recurringExpenses.map((e) => ({
      property_id: e.property_id,
      month: currentMonthFirst,
      category: e.category,
      description: e.description,
      amount: e.amount,
      is_recurring: true,
    }));

    const { error } = await supabase.from("property_expenses").insert(toInsert);
    if (!error) {
      fetchExpenses();
    }
    setCopying(false);
  }

  const total = expenses.reduce((sum, e) => sum + Number(e.amount ?? 0), 0);
  const recurringTotal = expenses
    .filter((e) => e.is_recurring)
    .reduce((sum, e) => sum + Number(e.amount ?? 0), 0);

  return (
    <PortalLayout>
      {/* Page header */}
      <div className="mb-10">
        <span className="block text-[11px] uppercase tracking-[0.4em] font-semibold text-accent mb-4">Money</span>
        <h1 className="font-display text-3xl font-extrabold text-foreground tracking-tight">
          Expense Tracking
        </h1>
        <p className="text-foreground-variant font-body font-medium mt-1">
          Log and review property expenses by month.
        </p>
        <p className="text-foreground-variant/70 font-body text-xs mt-1">
          Manually logged expenses
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
        <div className="bg-surface rounded-2xl p-6 border border-border">
          <p className="font-body text-[10px] uppercase tracking-widest text-foreground-variant font-bold mb-3">Total Expenses</p>
          <p className="font-display text-3xl font-extrabold text-foreground">
            {formatSGD(total)}
          </p>
        </div>
        <div className="bg-surface rounded-2xl p-6 border border-border">
          <p className="font-body text-[10px] uppercase tracking-widest text-foreground-variant font-bold mb-3">Recurring</p>
          <p className="font-display text-3xl font-extrabold text-accent">
            {formatSGD(recurringTotal)}
          </p>
        </div>
        <div className="bg-surface rounded-2xl p-6 border border-border">
          <p className="font-body text-[10px] uppercase tracking-widest text-foreground-variant font-bold mb-3">Line Items</p>
          <p className="font-display text-3xl font-extrabold text-foreground">
            {expenses.length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: expense form + selectors */}
        <div className="lg:col-span-5 space-y-6">
          {/* Selectors */}
          <div className="bg-surface rounded-2xl p-6 border border-border space-y-4">
            <div>
              <label className="block font-body text-xs uppercase tracking-widest text-foreground-variant font-bold mb-2">
                Property
              </label>
              <select
                className="w-full bg-white/5 border-0 rounded-xl px-4 py-3 font-body text-foreground focus:ring-2 focus:ring-accent outline-none"
                value={selectedProperty}
                onChange={(e) => setSelectedProperty(e.target.value)}
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-body text-xs uppercase tracking-widest text-foreground-variant font-bold mb-2">
                Month
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full bg-white/5 border-0 rounded-xl px-4 py-3 font-body text-foreground focus:ring-2 focus:ring-accent outline-none"
              />
            </div>
            <button
              onClick={handleCopyLastMonth}
              disabled={copying || !selectedProperty}
              className="w-full py-3 border border-border rounded-xl font-body font-bold text-sm text-foreground-variant hover:bg-white/5 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">content_copy</span>
              {copying ? "Copying…" : "Copy Last Month's Recurring"}
            </button>
          </div>

          {/* Add expense form */}
          <div className="bg-surface rounded-2xl p-6 border border-border">
            <h2 className="font-display font-bold text-foreground mb-5 flex items-center gap-2">
              <span className="material-symbols-outlined text-accent text-[20px]">add_circle</span>
              Log Expense
            </h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block font-body text-xs uppercase tracking-widest text-foreground-variant font-bold mb-2">
                  Category
                </label>
                <select
                  className="w-full bg-white/5 border-0 rounded-xl px-4 py-3 font-body text-foreground focus:ring-2 focus:ring-accent outline-none"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-body text-xs uppercase tracking-widest text-foreground-variant font-bold mb-2">
                  Amount (SGD)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 4500"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  required
                  className="w-full bg-white/5 border-0 rounded-xl px-4 py-3 font-body text-foreground focus:ring-2 focus:ring-accent outline-none"
                />
              </div>
              <div>
                <label className="block font-body text-xs uppercase tracking-widest text-foreground-variant font-bold mb-2">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Monthly master lease payment"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full bg-white/5 border-0 rounded-xl px-4 py-3 font-body text-foreground focus:ring-2 focus:ring-accent outline-none"
                />
              </div>
              <div className="flex items-center gap-3 py-1">
                <input
                  id="is-recurring"
                  type="checkbox"
                  checked={form.is_recurring}
                  onChange={(e) => setForm((f) => ({ ...f, is_recurring: e.target.checked }))}
                  className="rounded border-border text-accent focus:ring-accent w-4 h-4"
                />
                <label htmlFor="is-recurring" className="font-body text-sm text-foreground-variant cursor-pointer font-medium">
                  Recurring expense (copy to next month)
                </label>
              </div>
              <button
                type="submit"
                disabled={adding || !selectedProperty}
                className="w-full py-4 bg-accent text-white rounded-xl font-body font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                {adding ? "Adding…" : "Add Expense"}
              </button>
            </form>
          </div>
        </div>

        {/* Right: expenses table */}
        <div className="lg:col-span-7">
          <div className="bg-surface rounded-2xl border border-border overflow-hidden">
            <div className="px-6 py-5 border-b border-border flex items-center justify-between">
              <h2 className="font-display font-bold text-foreground">
                Expenses for Month
              </h2>
              <span className="font-body text-[10px] uppercase tracking-widest text-foreground-variant font-bold">
                {expenses.length} items
              </span>
            </div>

            {loadingExpenses ? (
              <div className="divide-y divide-white/10">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="px-6 py-4 flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="h-4 w-20 bg-white/5 animate-pulse rounded" />
                      <div className="h-3 w-32 bg-white/5 animate-pulse rounded" />
                    </div>
                    <div className="h-4 w-16 bg-white/5 animate-pulse rounded" />
                  </div>
                ))}
              </div>
            ) : expenses.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-foreground-variant font-body text-sm">
                  No expenses recorded for this property/month.
                </p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-white/10">
                  {expenses.map((e) => {
                    const badge = CATEGORY_BADGE[e.category] ?? CATEGORY_BADGE.OTHER;
                    return (
                      <div key={e.id} className="px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shrink-0 ${badge}`}>
                            {e.category}
                          </span>
                          <span className="font-body text-sm text-foreground-variant truncate">
                            {e.description || "—"}
                          </span>
                          {e.is_recurring && (
                            <span className="material-symbols-outlined text-[14px] text-accent shrink-0" title="Recurring">
                              autorenew
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-4">
                          <span className="font-display font-bold text-sm text-foreground tabular-nums">
                            {formatSGD(e.amount)}
                          </span>
                          <button
                            onClick={() => handleDelete(e.id)}
                            className="material-symbols-outlined text-[18px] text-foreground-variant hover:text-red-300 transition-colors"
                          >
                            delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Total footer */}
                <div className="px-6 py-4 bg-white/5 flex items-center justify-between border-t border-border">
                  <span className="font-body text-xs uppercase tracking-widest text-foreground-variant font-bold">Total</span>
                  <span className="font-display font-extrabold text-foreground">
                    {formatSGD(total)}
                  </span>
                </div>

                {/* Recurring audit banner */}
                {expenses.filter((e) => e.is_recurring).length > 0 && (
                  <div className="bg-accent px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-white/80 text-[20px]">autorenew</span>
                      <span className="font-body text-white text-sm font-medium">
                        {expenses.filter((e) => e.is_recurring).length} recurring expense{expenses.filter((e) => e.is_recurring).length !== 1 ? "s" : ""} — {formatSGD(recurringTotal)}/month
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
