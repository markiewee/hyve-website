import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

const ARCHIVED_SET = new Set(["signed", "closed_won", "lost", "closed_lost"]);

/**
 * Fetches leads from Supabase with optional filtering, subscribes to Realtime
 * updates, and exposes mutation helpers.
 *
 * Realtime applies the row-level payload directly to local state instead of
 * refetching the whole list. A blanket refetch reorders the array on every
 * inbox-sweep / activity-log bump, which yanks cards out from under dnd-kit
 * mid-drag and makes the Kanban feel broken.
 */
export function useLeads({ includeArchived = false } = {}) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const shouldShow = useCallback(
    (row) => (includeArchived ? true : !ARCHIVED_SET.has(row.status)),
    [includeArchived]
  );

  const fetchLeads = useCallback(async () => {
    setError(null);
    let query = supabase
      .from("leads")
      .select("*")
      .order("last_message_at", { ascending: false, nullsLast: true });

    if (!includeArchived) {
      query = query.not("status", "in", "(signed,closed_won,lost,closed_lost)");
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching leads:", fetchError);
      setError(fetchError.message);
    } else {
      setLeads(data || []);
    }
    setLoading(false);
  }, [includeArchived]);

  useEffect(() => {
    setLoading(true);
    fetchLeads();

    const channel = supabase
      .channel("leads_changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "leads" },
        (payload) => {
          const row = payload.new;
          if (!row || !shouldShow(row)) return;
          setLeads((current) =>
            current.some((l) => l.id === row.id) ? current : [row, ...current]
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "leads" },
        (payload) => {
          const row = payload.new;
          if (!row) return;
          setLeads((current) => {
            const existing = current.find((l) => l.id === row.id);
            if (!shouldShow(row)) {
              return existing ? current.filter((l) => l.id !== row.id) : current;
            }
            if (!existing) return [row, ...current];
            // Merge to keep ordering stable — do NOT re-sort.
            return current.map((l) => (l.id === row.id ? { ...l, ...row } : l));
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "leads" },
        (payload) => {
          const id = payload.old?.id;
          if (!id) return;
          setLeads((current) => current.filter((l) => l.id !== id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLeads, shouldShow]);

  /**
   * Update the status of a lead. Optimistic: applies the new status to local
   * state immediately so the Kanban card moves on drop. Reverts + refetches
   * on DB failure.
   */
  const updateStatus = useCallback(
    async (id, status) => {
      setError(null);
      const nowIso = new Date().toISOString();
      let previous = null;
      setLeads((current) => {
        previous = current;
        return current.map((l) =>
          l.id === id ? { ...l, status, status_changed_at: nowIso } : l
        );
      });

      const { error: updateError } = await supabase
        .from("leads")
        .update({ status, status_changed_at: nowIso })
        .eq("id", id);

      if (updateError) {
        console.error("Error updating lead status:", updateError);
        setError(updateError.message);
        if (previous) setLeads(previous);
        throw updateError;
      }
    },
    []
  );

  const updateLead = useCallback(async (id, patch) => {
    setError(null);
    const payload = { ...patch };
    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;

    const { error: updateError } = await supabase
      .from("leads")
      .update(payload)
      .eq("id", id);

    if (updateError) {
      console.error("Error updating lead:", updateError);
      setError(updateError.message);
      throw updateError;
    }
  }, []);

  const addLead = useCallback(async (lead) => {
    setError(null);
    const nowIso = new Date().toISOString();
    const payload = {
      status: "new",
      source: "manual",
      date_initiated: nowIso,
      last_message_at: nowIso,
      ...lead,
    };
    delete payload.id;

    const { data, error: insertError } = await supabase
      .from("leads")
      .insert(payload)
      .select("*")
      .single();

    if (insertError) {
      console.error("Error adding lead:", insertError);
      setError(insertError.message);
      throw insertError;
    }
    // Realtime usually delivers the INSERT too, but apply locally so the card
    // appears instantly even if the socket lags.
    if (data) {
      setLeads((current) =>
        current.some((l) => l.id === data.id) ? current : [data, ...current]
      );
    }
    return data;
  }, []);

  return {
    leads,
    loading,
    error,
    updateStatus,
    updateLead,
    addLead,
    refresh: fetchLeads,
  };
}
