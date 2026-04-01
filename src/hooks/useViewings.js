import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

function generateToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) =>
    b.toString(36)
  )
    .join("")
    .slice(0, 8);
}

/**
 * Fetches and manages property viewings with optional filters.
 *
 * @param {Object} [filters]
 * @param {string} [filters.propertyId] - Filter by property
 * @param {string} [filters.status] - Filter by viewing status
 * @param {string} [filters.captainId] - Filter by assigned captain
 */
export function useViewings(filters = {}) {
  const [viewings, setViewings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchViewings = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from("property_viewings")
      .select(
        "*, properties(name, code), rooms(name, unit_code), viewing_polls(*)"
      )
      .order("created_at", { ascending: false });

    if (filters.propertyId) {
      query = query.eq("property_id", filters.propertyId);
    }
    if (filters.status) {
      query = query.eq("status", filters.status);
    }
    if (filters.captainId) {
      query = query.eq("captain_id", filters.captainId);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching viewings:", fetchError);
      setError(fetchError.message);
    }
    setViewings(data ?? []);
    setLoading(false);
  }, [filters.propertyId, filters.status, filters.captainId]);

  useEffect(() => {
    fetchViewings();

    const channel = supabase
      .channel("property_viewings_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "property_viewings",
        },
        () => {
          fetchViewings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchViewings]);

  /**
   * Create a new viewing request with an auto-generated poll.
   * Auto-assigns captain (HOUSE_CAPTAIN for the property) and resident
   * (active tenant in the room). Sets status to POLLING.
   */
  async function createViewing(data) {
    setError(null);

    // Auto-assign captain — find the HOUSE_CAPTAIN for this property
    let captainId = data.captain_id || null;
    if (!captainId && data.property_id) {
      const { data: captains } = await supabase
        .from("tenant_profiles")
        .select("id")
        .eq("property_id", data.property_id)
        .eq("role", "HOUSE_CAPTAIN")
        .eq("is_active", true)
        .limit(1);

      if (captains?.length) {
        captainId = captains[0].id;
      }
    }

    // Auto-assign resident — find the active tenant in this room
    let residentId = data.resident_id || null;
    if (!residentId && data.room_id) {
      const { data: residents } = await supabase
        .from("tenant_profiles")
        .select("id")
        .eq("room_id", data.room_id)
        .eq("is_active", true)
        .neq("role", "HOUSE_CAPTAIN")
        .limit(1);

      if (residents?.length) {
        residentId = residents[0].id;
      }
    }

    const token = generateToken();

    const { data: viewing, error: insertError } = await supabase
      .from("property_viewings")
      .insert({
        ...data,
        token,
        captain_id: captainId,
        resident_id: residentId,
        status: "POLLING",
      })
      .select(
        "*, properties(name, code), rooms(name, unit_code), viewing_polls(*)"
      )
      .single();

    if (insertError) {
      console.error("Error creating viewing:", insertError);
      setError(insertError.message);
      return { error: insertError };
    }

    // Create the associated poll
    const now = new Date();
    const pollStart = new Date(now);
    pollStart.setDate(pollStart.getDate() + 2);
    const pollEnd = new Date(pollStart);
    pollEnd.setDate(pollEnd.getDate() + 7);
    const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const prospectToken = generateToken();
    const captainToken = generateToken();
    const residentToken = generateToken();

    const { data: poll, error: pollError } = await supabase
      .from("viewing_polls")
      .insert({
        viewing_id: viewing.id,
        status: "open",
        poll_start: pollStart.toISOString().split("T")[0],
        poll_end: pollEnd.toISOString().split("T")[0],
        viewing_type: data.viewing_type || null,
        expires_at: expiresAt.toISOString(),
        prospect_token: prospectToken,
        captain_token: captainToken,
        resident_token: residentToken,
      })
      .select()
      .single();

    if (pollError) {
      console.error("Error creating viewing poll:", pollError);
      setError(pollError.message);
      return { data: viewing, error: pollError };
    }

    await fetchViewings();
    return { data: { ...viewing, viewing_polls: [poll] }, error: null };
  }

  /**
   * Update fields on an existing viewing.
   */
  async function updateViewing(id, updates) {
    setError(null);

    const { data, error: updateError } = await supabase
      .from("property_viewings")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(
        "*, properties(name, code), rooms(name, unit_code), viewing_polls(*)"
      )
      .single();

    if (updateError) {
      console.error("Error updating viewing:", updateError);
      setError(updateError.message);
      return { error: updateError };
    }

    await fetchViewings();
    return { data, error: null };
  }

  /**
   * Cancel a viewing and its associated poll.
   */
  async function cancelViewing(id) {
    setError(null);

    // Cancel the viewing
    const { error: viewingError } = await supabase
      .from("property_viewings")
      .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (viewingError) {
      console.error("Error cancelling viewing:", viewingError);
      setError(viewingError.message);
      return { error: viewingError };
    }

    // Cancel associated polls
    const { error: pollError } = await supabase
      .from("viewing_polls")
      .update({ status: "cancelled" })
      .eq("viewing_id", id);

    if (pollError) {
      console.error("Error cancelling viewing poll:", pollError);
      setError(pollError.message);
      return { error: pollError };
    }

    await fetchViewings();
    return { error: null };
  }

  /**
   * Force-book a viewing by confirming it with a specific slot.
   * Sets the viewing to CONFIRMED with date/time from the slot,
   * and updates the poll to confirmed with the matched slot.
   */
  async function forceBook(viewingId, slot) {
    setError(null);

    const slotDate = new Date(slot);
    const viewingDate = slotDate.toISOString().split("T")[0];
    const viewingTime = slotDate.toTimeString().slice(0, 5);

    const { error: viewingError } = await supabase
      .from("property_viewings")
      .update({
        status: "CONFIRMED",
        viewing_date: viewingDate,
        viewing_time: viewingTime,
        updated_at: new Date().toISOString(),
      })
      .eq("id", viewingId);

    if (viewingError) {
      console.error("Error force-booking viewing:", viewingError);
      setError(viewingError.message);
      return { error: viewingError };
    }

    const { error: pollError } = await supabase
      .from("viewing_polls")
      .update({
        status: "confirmed",
        matched_slot: new Date(slot).toISOString(),
      })
      .eq("viewing_id", viewingId);

    if (pollError) {
      console.error("Error confirming poll:", pollError);
      setError(pollError.message);
      return { error: pollError };
    }

    await fetchViewings();
    return { error: null };
  }

  return {
    viewings,
    loading,
    error,
    createViewing,
    updateViewing,
    cancelViewing,
    forceBook,
    refetch: fetchViewings,
  };
}
