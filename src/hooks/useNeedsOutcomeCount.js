import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { selectNeedsOutcome } from "../lib/viewingOutcomes";

/**
 * Roles that can actually action a viewing outcome. Nobody else is nagged.
 * Compared lower-cased because tenant_profiles.role is stored upper-case
 * (ADMIN, SUPER_ADMIN, HOUSE_CAPTAIN) and PortalLayout passes it through raw,
 * so a case-sensitive check here would zero the badge for every real user.
 */
const CAN_ACTION = new Set(["admin", "super_admin", "house_captain", "manager"]);

/**
 * How many past viewings are still waiting on someone to say what happened.
 *
 * This exists so the backlog is visible from anywhere in the portal rather than
 * only once you are already looking at the Viewings page. A badge on the tab
 * inside that page is useless to someone who never opens it, which is exactly
 * how 43 viewings came to sit unanswered.
 *
 * Reads the same table the page reads and reuses selectNeedsOutcome, so the
 * badge and the queue can never disagree. No new endpoint.
 */
export function useNeedsOutcomeCount(role) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!CAN_ACTION.has(String(role ?? "").toLowerCase())) {
      setCount(0);
      return;
    }
    let cancelled = false;

    async function load() {
      // Only rows that could possibly qualify: unresolved, and already dated.
      const { data, error } = await supabase
        .from("property_viewings")
        .select("id, slot_start, viewing_date, status, completed_at")
        .is("completed_at", null)
        .limit(500);

      if (cancelled) return;
      if (error) {
        // A nav badge is not worth breaking the layout over.
        console.error("[needs-outcome-count]", error.message);
        setCount(0);
        return;
      }
      setCount(selectNeedsOutcome(data || [], Date.now()).length);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [role]);

  return count;
}
