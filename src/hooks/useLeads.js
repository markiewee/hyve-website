import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

/**
 * Fetches leads from Supabase with optional filtering, subscribes to Realtime updates,
 * and exposes mutation helpers.
 *
 * @param {Object} [options]
 * @param {boolean} [options.includeArchived=false] - If true, includes archived statuses (signed, closed_won, lost, closed_lost, cold)
 * @returns {Object} { leads, loading, error, updateStatus, updateLead, refresh }
 */
export function useLeads({ includeArchived = false } = {}) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from("leads")
      .select("*")
      .order("last_message_at", { ascending: false, nullsLast: true });

    if (!includeArchived) {
      // Exclude archived statuses: signed, closed_won, lost, closed_lost, cold
      query = query.not(
        "status",
        "in",
        "(signed,closed_won,lost,closed_lost,cold)"
      );
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
    fetchLeads();

    // Realtime subscription — refetch on any change to leads table
    const channel = supabase
      .channel("leads_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
        },
        () => {
          fetchLeads();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLeads]);

  /**
   * Update the status of a lead and set status_changed_at timestamp.
   * @param {string} id - Lead ID
   * @param {string} status - New status value
   */
  const updateStatus = useCallback(async (id, status) => {
    setError(null);
    const { error: updateError } = await supabase
      .from("leads")
      .update({ status, status_changed_at: new Date().toISOString() })
      .eq("id", id);

    if (updateError) {
      console.error("Error updating lead status:", updateError);
      setError(updateError.message);
      throw updateError;
    }
  }, []);

  /**
   * Update arbitrary fields on a lead (excluding system fields).
   * @param {string} id - Lead ID
   * @param {Object} patch - Fields to update (will exclude id, created_at, updated_at)
   */
  const updateLead = useCallback(async (id, patch) => {
    setError(null);
    const payload = { ...patch };
    // Remove system fields that shouldn't be directly updated
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

  return {
    leads,
    loading,
    error,
    updateStatus,
    updateLead,
    refresh: fetchLeads,
  };
}
