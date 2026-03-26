import { supabase } from "./supabase";

/**
 * Notify a tenant when their maintenance ticket status changes.
 * Called after a successful Supabase update in PropertyTicketsPage.
 * Errors are swallowed so they never block the main ticket action.
 */
export async function notifyTicketStatusChange(
  ticket,
  newStatus,
  resolutionNote
) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // tenant_profile_id is the canonical field; fall back to submitted_by
    const tenantProfileId =
      ticket.tenant_profile_id || ticket.submitted_by || null;

    if (!tenantProfileId) return;

    await fetch(
      `${import.meta.env.VITE_IOT_SUPABASE_URL}/functions/v1/notify-tenant`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          event_type: "TICKET_STATUS_CHANGED",
          tenant_profile_id: tenantProfileId,
          details: {
            ticket_category: ticket.category,
            new_status: newStatus,
            resolution_note: resolutionNote || null,
          },
        }),
      }
    );
  } catch (e) {
    console.error("Notification failed (non-blocking):", e);
  }
}

/**
 * Generic notification helper — sends any event type to a tenant.
 * Errors are swallowed so they never block the main action.
 */
export async function notifyMember(tenantProfileId, eventType, details = {}) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    await fetch(
      `${import.meta.env.VITE_IOT_SUPABASE_URL}/functions/v1/notify-tenant`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          event_type: eventType,
          tenant_profile_id: tenantProfileId,
          details,
        }),
      }
    );
  } catch (e) {
    console.error("Notification failed (non-blocking):", e);
  }
}
