import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export function useAdminInvoices({ propertyId, month, status } = {}) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("invoices")
      .select("*, invoice_line_items(*), tenant_profiles(username, rooms(unit_code), properties(name, code))")
      .order("created_at", { ascending: false });

    if (propertyId) query = query.eq("property_id", propertyId);
    if (month) query = query.eq("month", `${month}-01`);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) console.error("Error fetching admin invoices:", error);
    setInvoices(data ?? []);
    setLoading(false);
  }, [propertyId, month, status]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  async function markAsPaid(invoiceId, paymentAmount, paymentRef) {
    const invoice = invoices.find((i) => i.id === invoiceId);
    if (!invoice) return;

    const newTotalPaid = Number(invoice.total_paid) + Number(paymentAmount);
    const fullyPaid = newTotalPaid >= Number(invoice.total_due);

    const { error } = await supabase
      .from("invoices")
      .update({
        total_paid: Math.round(newTotalPaid * 100) / 100,
        status: fullyPaid ? "PAID" : "PARTIALLY_PAID",
        paid_at: fullyPaid ? new Date().toISOString() : null,
        notes: paymentRef ? `Bank ref: ${paymentRef}` : invoice.notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceId);

    if (error) console.error("Error marking paid:", error);
    await fetchInvoices();
    return !error;
  }

  async function voidInvoice(invoiceId) {
    const { error } = await supabase
      .from("invoices")
      .update({ status: "VOID", updated_at: new Date().toISOString() })
      .eq("id", invoiceId);

    if (error) console.error("Error voiding invoice:", error);
    await fetchInvoices();
    return !error;
  }

  return { invoices, loading, refetch: fetchInvoices, markAsPaid, voidInvoice };
}
