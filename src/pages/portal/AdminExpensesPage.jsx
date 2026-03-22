import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

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
  UTILITIES: "bg-yellow-100 text-yellow-700",
  MAINTENANCE: "bg-orange-100 text-orange-700",
  CLEANING: "bg-teal-100 text-teal-700",
  INSURANCE: "bg-purple-100 text-purple-700",
  MANAGEMENT_FEE: "bg-indigo-100 text-indigo-700",
  MARKETING: "bg-pink-100 text-pink-700",
  SUPPLIES: "bg-gray-100 text-gray-700",
  OTHER: "bg-gray-100 text-gray-600",
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

  // Add expense form
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

    // Calculate previous month
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

  return (
    <PortalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Expenses</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track and manage property expenses by month.
        </p>
      </div>

      {/* Selectors */}
      <Card className="mb-6">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 flex flex-col gap-1.5">
              <Label>Property</Label>
              <select
                className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background"
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
            <div className="flex-1 flex flex-col gap-1.5">
              <Label>Month</Label>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLastMonth}
                disabled={copying || !selectedProperty}
              >
                {copying ? "Copying…" : "Copy Last Month's Recurring"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Existing expenses */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Expenses for Month</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingExpenses ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 bg-gray-100 animate-pulse rounded" />
              ))}
            </div>
          ) : expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">
              No expenses recorded for this property/month.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Category
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Description
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                        Amount
                      </th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground">
                        Recurring
                      </th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {expenses.map((e) => {
                      const badge = CATEGORY_BADGE[e.category] ?? CATEGORY_BADGE.OTHER;
                      return (
                        <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge}`}
                            >
                              {e.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {e.description || "—"}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium">
                            {formatSGD(e.amount)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {e.is_recurring ? (
                              <span className="text-xs text-green-600 font-medium">Yes</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleDelete(e.id)}
                              className="text-xs text-red-600 hover:text-red-700 hover:underline"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t border-border bg-muted/30">
                    <tr>
                      <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-right">
                        Total
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">
                        {formatSGD(total)}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add Expense */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add Expense</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Category</Label>
                <select
                  className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Amount (SGD)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 4500"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Description</Label>
              <Input
                placeholder="e.g. Monthly master lease payment"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="is-recurring"
                type="checkbox"
                checked={form.is_recurring}
                onChange={(e) =>
                  setForm((f) => ({ ...f, is_recurring: e.target.checked }))
                }
                className="rounded border-gray-300"
              />
              <Label htmlFor="is-recurring" className="cursor-pointer">
                Recurring expense (copy to next month)
              </Label>
            </div>
            <Button type="submit" disabled={adding || !selectedProperty}>
              {adding ? "Adding…" : "Add Expense"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </PortalLayout>
  );
}
