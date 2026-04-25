import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export function useInvoices(tenantProfileId) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchInvoices = useCallback(async () => {
    if (!tenantProfileId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("invoices")
      .select("*, invoice_line_items(*)")
      .eq("tenant_profile_id", tenantProfileId)
      .neq("status", "DRAFT")
      .order("month", { ascending: false });

    if (error) console.error("Error fetching invoices:", error);
    setInvoices(data ?? []);
    setLoading(false);
  }, [tenantProfileId]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  return { invoices, loading, refetch: fetchInvoices };
}

export function useInvoiceDetail(invoiceId) {
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!invoiceId) {
      setLoading(false);
      return;
    }
    supabase
      .from("invoices")
      .select("*, invoice_line_items(*), tenant_profiles(username, rooms(unit_code, room_type), properties(name, code))")
      .eq("id", invoiceId)
      .single()
      .then(({ data, error }) => {
        if (error) console.error("Error fetching invoice:", error);
        setInvoice(data);
        setLoading(false);
      });
  }, [invoiceId]);

  return { invoice, loading };
}
