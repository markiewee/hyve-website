import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

/**
 * Hook for the public poll page — fetches poll data by token,
 * handles availability submission, and runs the matching algorithm.
 *
 * @param {string} token - Unique poll token from the URL
 * @param {"prospect"|"captain"|"resident"} respondentType
 */
export function useViewingPoll(token, respondentType) {
  const [poll, setPoll] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [property, setProperty] = useState(null);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [matchedSlot, setMatchedSlot] = useState(null);

  const fetchPoll = useCallback(async () => {
    if (!token || !respondentType) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Map respondent type to the correct token column
    const tokenField =
      respondentType === "captain"
        ? "captain_token"
        : respondentType === "resident"
          ? "resident_token"
          : "prospect_token";

    const { data: pollData, error } = await supabase
      .from("viewing_polls")
      .select(
        "*, property_viewings(*, properties(name, code), rooms(name, unit_code))"
      )
      .eq(tokenField, token)
      .single();

    if (error || !pollData) {
      console.error("Error fetching poll:", error);
      setLoading(false);
      return;
    }

    setPoll(pollData);
    setViewing(pollData.property_viewings);
    setProperty(pollData.property_viewings?.properties);

    // Check if this respondent already submitted responses
    const { data: existing } = await supabase
      .from("viewing_poll_responses")
      .select("*")
      .eq("poll_id", pollData.id)
      .eq("respondent_type", respondentType);

    if (existing && existing.length > 0) {
      setSubmitted(true);
      setResponses(existing);
    }

    if (pollData.matched_slot) {
      setMatchedSlot(new Date(pollData.matched_slot));
    }

    setLoading(false);
  }, [token, respondentType]);

  useEffect(() => {
    fetchPoll();
  }, [fetchPoll]);

  /**
   * Finds the best matching slot across all respondents for a poll.
   * Requires both captain and prospect availability.
   * Prefers slots where resident is also available.
   * Picks the earliest match.
   *
   * If a match is found: updates poll to "matched" with matched_slot,
   * and updates the viewing to CONFIRMED with viewing_date/viewing_time.
   *
   * @param {string} pollId
   * @returns {Date|null} The matched slot timestamp, or null if no match
   */
  async function findMatch(pollId) {
    const { data: allResponses } = await supabase
      .from("viewing_poll_responses")
      .select("*")
      .eq("poll_id", pollId)
      .eq("available", true);

    if (!allResponses || allResponses.length === 0) return null;

    // Group available slots by respondent type
    const byType = {};
    allResponses.forEach((r) => {
      if (!byType[r.respondent_type]) byType[r.respondent_type] = new Set();
      byType[r.respondent_type].add(r.slot_start);
    });

    // Both captain and prospect must have responded
    if (!byType.captain || !byType.prospect) return null;

    // Find captain ∩ prospect overlap
    const captainSlots = [...byType.captain];
    const prospectSlots = byType.prospect;
    const overlap = captainSlots.filter((s) => prospectSlots.has(s));

    if (overlap.length === 0) return null;

    // Prefer slots where resident is also available
    const residentSlots = byType.resident ?? new Set();
    const withResident = overlap.filter((s) => residentSlots.has(s));

    // Pick earliest — prefer with-resident, fall back to any overlap
    const candidates = withResident.length > 0 ? withResident : overlap;
    candidates.sort((a, b) => new Date(a) - new Date(b));
    const matched = new Date(candidates[0]);

    // Update poll status to matched
    await supabase
      .from("viewing_polls")
      .update({
        status: "matched",
        matched_slot: matched.toISOString(),
      })
      .eq("id", pollId);

    // Update the associated viewing to CONFIRMED
    const { data: pollRow } = await supabase
      .from("viewing_polls")
      .select("viewing_id")
      .eq("id", pollId)
      .single();

    if (pollRow) {
      await supabase
        .from("property_viewings")
        .update({
          status: "CONFIRMED",
          viewing_date: matched.toISOString().split("T")[0],
          viewing_time: matched.toTimeString().slice(0, 5),
        })
        .eq("id", pollRow.viewing_id);
    }

    return matched;
  }

  /**
   * Submits availability for the current respondent.
   * Deletes any previous responses, inserts new ones, updates viewing_type
   * if the respondent is a prospect, then attempts to find a match.
   *
   * @param {Date[]} selectedSlots - Array of Date objects for available slots
   * @param {string} [viewingType] - "virtual" or "in_person" (prospect only)
   * @returns {{ matched: boolean, slot?: Date }}
   */
  async function submitAvailability(selectedSlots, viewingType) {
    if (!poll) return { matched: false };

    // Delete previous responses for this respondent (allows re-submission)
    await supabase
      .from("viewing_poll_responses")
      .delete()
      .eq("poll_id", poll.id)
      .eq("respondent_type", respondentType);

    // Insert one row per available slot
    const rows = selectedSlots.map((slot) => ({
      poll_id: poll.id,
      respondent_type: respondentType,
      slot_start: slot.toISOString(),
      available: true,
    }));

    const { error } = await supabase
      .from("viewing_poll_responses")
      .insert(rows);

    if (error) throw error;

    // If prospect, store their viewing type preference on the poll
    if (respondentType === "prospect" && viewingType) {
      await supabase
        .from("viewing_polls")
        .update({ viewing_type: viewingType })
        .eq("id", poll.id);
    }

    setSubmitted(true);
    setResponses(rows);

    // Attempt to find a match now that new responses are in
    const match = await findMatch(poll.id);
    if (match) {
      setMatchedSlot(match);
      return { matched: true, slot: match };
    }

    return { matched: false };
  }

  const isExpired =
    poll?.expires_at &&
    new Date(poll.expires_at) < new Date() &&
    poll?.status === "open";

  const pollStatus = isExpired ? "expired" : poll?.status;

  return {
    poll,
    viewing,
    property,
    responses,
    loading,
    submitted,
    matchedSlot,
    pollStatus,
    isExpired,
    submitAvailability,
    refetch: fetchPoll,
  };
}
