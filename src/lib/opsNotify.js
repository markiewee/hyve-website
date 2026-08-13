// opsNotify.js
//
// Who hears about what.
//
// Kavi runs the day to day, so the operational stream is hers. Mark asked
// for exactly two things in his pocket: URGENT, and money he has to approve.
// Every other event that reaches him is this module failing at its job.
//
// Pure on purpose: it decides audience and writes copy, and the caller does
// the sending. That keeps the routing rules testable without a phone, a
// Beeper token or a network.

export const KAVI_EVENTS = new Set([
  "ticket_created",
  "sla_warning",
  "quote_received",
  "viewing_booked",
  "photo_submitted",
]);

// Money is the boundary Mark named. A quote is money about to be spent, so
// Kavi sanity-checks it and Mark approves. A charge or a refund is money
// moving between us and a tenant, and that is Mark's alone.
const MONEY_TO_BOTH = new Set(["quote_received"]);
const MONEY_TO_MARK = new Set(["charge_drafted", "refund_requested"]);

export function audienceFor(event) {
  const type = String(event?.type ?? "");
  if (MONEY_TO_MARK.has(type)) return ["mark"];
  if (MONEY_TO_BOTH.has(type)) return ["mark", "kavi"];
  // An unknown type notifies nobody. Silence is recoverable; a firehose into
  // Mark's phone is the failure this module exists to prevent, so a new
  // event stays mute until somebody adds it above deliberately.
  if (!KAVI_EVENTS.has(type)) return [];
  const urgent = String(event?.severity ?? "").toUpperCase() === "URGENT";
  return urgent ? ["mark", "kavi"] : ["kavi"];
}

function dayOf(iso) {
  if (!iso) return "no due date";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "no due date" : d.toISOString().slice(0, 10);
}

export function ticketCreatedMessage(t) {
  const where = t?.listing_code || t?.property_slug || "unknown unit";
  const sev = String(t?.severity ?? "ROUTINE").toUpperCase();
  const what = String(t?.description ?? "").trim() || "no description given";
  return `New ticket ${where}. ${sev}. ${what}. Due ${dayOf(t?.due_at)}.`;
}

export function digestMessage({ tickets = [], viewings = [], sellWindow = [] } = {}) {
  if (!tickets.length && !viewings.length && !sellWindow.length)
    return "Morning. Nothing open, nothing booked, nothing to sell today.";

  const countOf = (s) =>
    tickets.filter((t) => String(t?.severity ?? "").toUpperCase() === s).length;

  const parts = [];
  const counts = [["URGENT", "urgent"], ["HIGH", "high"], ["ROUTINE", "routine"],
                  ["COSMETIC", "cosmetic"]]
    .map(([key, label]) => [countOf(key), label])
    .filter(([n]) => n > 0)
    .map(([n, label]) => `${n} ${label}`);
  parts.push(counts.length ? `Open tickets: ${counts.join(", ")}.` : "No open tickets.");

  // Age is the number that actually predicts a complaint, so the oldest gets
  // named rather than left inside a count.
  const oldest = tickets.slice().sort(
    (a, b) => Number(b?.days_open ?? 0) - Number(a?.days_open ?? 0))[0];
  if (Number(oldest?.days_open ?? 0) > 2)
    parts.push(`Oldest is ${oldest.listing_code} at ${oldest.days_open} days.`);

  parts.push(viewings.length
    ? `Viewings today: ${viewings.map((v) => v.listing_code).join(", ")}.`
    : "No viewings today.");

  if (sellWindow.length) parts.push(`Rooms to sell: ${sellWindow.join(", ")}.`);

  return parts.join(" ");
}
