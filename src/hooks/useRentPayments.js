import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useRentPayments(profileId) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profileId) {
      setLoading(false);
      return;
    }

    supabase
      .from("rent_payments")
      .select("*")
      .eq("tenant_profile_id", profileId)
      .order("month", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error("Error fetching rent payments:", error);
        }
        setPayments(data ?? []);
        setLoading(false);
      });
  }, [profileId]);

  return { payments, loading };
}
