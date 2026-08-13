// leadActivation.js
//
// Decides whether a stored lead has become worth waking.
//
// The four condition types have been accepted on write since the CRM write
// path shipped, and nothing has ever evaluated one: 251 leads, none stored,
// no condition ever armed. This is the missing half.
//
// Pure by design. The caller supplies the room sell-state and the clock, so
// the rules are testable without a database and cannot fire against data
// they were never given. Anything malformed stays silent, because the
// consequence of a wrong true here is a message to a real stranger about a
// room that may not exist.
//
// If a fifth type is ever added to ACTIVATION_TYPES in partnerLeads.js it
// must be added here too, or leads will be stored against a condition that
// nothing will ever evaluate. leadActivation.test.js fails if that happens.

const EIGHT_WEEKS_MS = 56 * 24 * 60 * 60 * 1000;

export function conditionFires(condition, { rooms = [], now = new Date() } = {}) {
  if (!condition || typeof condition !== "object") return false;
  const sellable = (Array.isArray(rooms) ? rooms : []).filter((r) => r?.in_sell_window);

  switch (String(condition.type)) {
    case "MANUAL":
      // A human already decided. Nothing to second-guess.
      return true;

    case "DATE": {
      const on = condition.on ? new Date(condition.on) : null;
      if (!on || Number.isNaN(on.getTime())) return false;
      // A date in the past fires too: they are overdue, not early.
      return on.getTime() - now.getTime() <= EIGHT_WEEKS_MS;
    }

    case "ROOM":
      if (!condition.listing_code) return false;
      return sellable.some((r) => r.listing_code === condition.listing_code);

    case "BUDGET": {
      const cap = Number(condition.max_monthly);
      if (!Number.isFinite(cap) || cap <= 0) return false;
      return sellable.some((r) => {
        const price = Number(r?.price_monthly);
        return Number.isFinite(price) && price <= cap;
      });
    }

    default:
      return false;
  }
}

// True when it is a civilised hour in Singapore to message somebody who has
// not heard from us in weeks. Landing at 3am turns a warm lead into a block.
export function sendingHoursNow(now = new Date()) {
  const sgtHour = (now.getUTCHours() + 8) % 24;
  return sgtHour >= 9 && sgtHour < 21;
}
