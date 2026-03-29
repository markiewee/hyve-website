import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";

const EXPENSE_CATEGORIES = [
  "MASTER_LEASE",
  "UTILITIES",
  "MAINTENANCE",
  "CLEANING",
  "SUPPLIES",
  "STAFF",
  "PLATFORM_FEES",
  "OTHER",
];

const CATEGORY_BADGE = {
  MASTER_LEASE: "bg-blue-100 text-blue-700",
  UTILITIES: "bg-amber-100 text-amber-700",
  MAINTENANCE: "bg-orange-100 text-orange-700",
  CLEANING: "bg-[#d1fae5] text-[#065f46]",
  INSURANCE: "bg-purple-100 text-purple-700",
  MANAGEMENT_FEE: "bg-indigo-100 text-indigo-700",
  MARKETING: "bg-pink-100 text-pink-700",
  SUPPLIES: "bg-[#e6eeff] text-[#555f6f]",
  STAFF: "bg-violet-100 text-violet-700",
  PLATFORM_FEES: "bg-cyan-100 text-cyan-700",
  OTHER: "bg-[#eff4ff] text-[#6c7a77]",
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
        <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a] tracking-tight">
          Expense Tracking
        </h1>
        <p className="text-[#6c7a77] font-['Manrope'] font-medium mt-1">
          Log and review property expenses by month.
        </p>
        <p className="text-[#6c7a77]/70 font-['Manrope'] text-xs mt-1">
          Manually logged expenses
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 border border-[#bbcac6]/15 shadow-sm">
          <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-3">Total Expenses</p>
          <p className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a]">
            {formatSGD(total)}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-[#bbcac6]/15 shadow-sm">
          <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-3">Recurring</p>
          <p className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#006b5f]">
            {formatSGD(recurringTotal)}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-[#bbcac6]/15 shadow-sm">
          <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-3">Line Items</p>
          <p className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a]">
            {expenses.length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: expense form + selectors */}
        <div className="lg:col-span-5 space-y-6">
          {/* Selectors */}
          <div className="bg-white rounded-2xl p-6 border border-[#bbcac6]/15 shadow-sm space-y-4">
            <div>
              <label className="block font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-2">
                Property
              </label>
              <select
                className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
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
              <label className="block font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-2">
                Month
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
              />
            </div>
            <button
              onClick={handleCopyLastMonth}
              disabled={copying || !selectedProperty}
              className="w-full py-3 border border-[#bbcac6]/30 rounded-xl font-['Manrope'] font-bold text-sm text-[#555f6f] hover:bg-[#eff4ff] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">content_copy</span>
              {copying ? "Copying…" : "Copy Last Month's Recurring"}
            </button>
          </div>

          {/* Add expense form */}
          <div className="bg-white rounded-2xl p-6 border border-[#bbcac6]/15 shadow-sm">
            <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a] mb-5 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#006b5f] text-[20px]">add_circle</span>
              Log Expense
            </h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-2">
                  Category
                </label>
                <select
                  className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-2">
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
                  className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
                />
              </div>
              <div>
                <label className="block font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-2">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Monthly master lease payment"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
                />
              </div>
              <div className="flex items-center gap-3 py-1">
                <input
                  id="is-recurring"
                  type="checkbox"
                  checked={form.is_recurring}
                  onChange={(e) => setForm((f) => ({ ...f, is_recurring: e.target.checked }))}
                  className="rounded border-[#bbcac6] text-[#006b5f] focus:ring-[#14b8a6] w-4 h-4"
                />
                <label htmlFor="is-recurring" className="font-['Manrope'] text-sm text-[#555f6f] cursor-pointer font-medium">
                  Recurring expense (copy to next month)
                </label>
              </div>
              <button
                type="submit"
                disabled={adding || !selectedProperty}
                className="w-full py-4 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                {adding ? "Adding…" : "Add Expense"}
              </button>
            </form>
          </div>
        </div>

        {/* Right: expenses table */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-[#bbcac6]/15 flex items-center justify-between">
              <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a]">
                Expenses for Month
              </h2>
              <span className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">
                {expenses.length} items
              </span>
            </div>

            {loadingExpenses ? (
              <div className="divide-y divide-[#bbcac6]/10">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="px-6 py-4 flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="h-4 w-20 bg-[#eff4ff] animate-pulse rounded" />
                      <div className="h-3 w-32 bg-[#eff4ff] animate-pulse rounded" />
                    </div>
                    <div className="h-4 w-16 bg-[#eff4ff] animate-pulse rounded" />
                  </div>
                ))}
              </div>
            ) : expenses.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-[#6c7a77] font-['Manrope'] text-sm">
                  No expenses recorded for this property/month.
                </p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-[#bbcac6]/10">
                  {expenses.map((e) => {
                    const badge = CATEGORY_BADGE[e.category] ?? CATEGORY_BADGE.OTHER;
                    return (
                      <div key={e.id} className="px-6 py-4 flex items-center justify-between hover:bg-[#f8f9ff] transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shrink-0 ${badge}`}>
                            {e.category}
                          </span>
                          <span className="font-['Manrope'] text-sm text-[#6c7a77] truncate">
                            {e.description || "—"}
                          </span>
                          {e.is_recurring && (
                            <span className="material-symbols-outlined text-[14px] text-[#006b5f] shrink-0" title="Recurring">
                              autorenew
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-4">
                          <span className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#121c2a] tabular-nums">
                            {formatSGD(e.amount)}
                          </span>
                          <button
                            onClick={() => handleDelete(e.id)}
                            className="material-symbols-outlined text-[18px] text-[#bbcac6] hover:text-[#ba1a1a] transition-colors"
                          >
                            delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Total footer */}
                <div className="px-6 py-4 bg-[#eff4ff] flex items-center justify-between border-t border-[#bbcac6]/15">
                  <span className="font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold">Total</span>
                  <span className="font-['Plus_Jakarta_Sans'] font-extrabold text-[#121c2a]">
                    {formatSGD(total)}
                  </span>
                </div>

                {/* Recurring audit banner */}
                {expenses.filter((e) => e.is_recurring).length > 0 && (
                  <div className="bg-[#006b5f] px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[#71f8e4] text-[20px]">autorenew</span>
                      <span className="font-['Manrope'] text-white text-sm font-medium">
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
