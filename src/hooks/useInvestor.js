import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

export function useInvestor() {
  const { user } = useAuth();
  const [investor, setInvestor] = useState(null);
  const [investments, setInvestments] = useState([]);
  const [isInvestor, setIsInvestor] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);

      const { data: inv, error: invError } = await supabase
        .from("investors")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (invError || !inv) {
        setInvestor(null);
        setIsInvestor(false);
        setInvestments([]);
        setLoading(false);
        return;
      }

      setInvestor(inv);
      setIsInvestor(true);

      const { data: invData, error: invDataError } = await supabase
        .from("investments")
        .select("*, properties(id, name, code)")
        .eq("investor_id", inv.id);

      if (!invDataError) {
        setInvestments(invData ?? []);
      }

      setLoading(false);
    }

    load();
  }, [user]);

  return { investor, investments, isInvestor, loading };
}
