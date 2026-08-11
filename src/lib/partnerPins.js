// src/lib/partnerPins.js
//
// Six agents and referrers have had a PIN since the pricing page was built
// (Patrick Lim, Riko, Siti, Xavier, and the two shared China desks), and
// every one of them reads use_count 0, because nothing anywhere consumed a
// PIN. They were credentials for a door that had not been cut.
//
// A PIN is how somebody without an API key gets attributed. Platforms
// authenticate as themselves and their bookings are stamped from the key.
// An agent does not have a key; they have six digits, and the whole point
// of those six digits is that a booking they introduced is recorded as
// theirs and pays what their channel says it pays.
//
// Which is why the failure mode here is loud. A mistyped or disabled PIN
// must never be quietly dropped: attribution that silently vanishes is
// somebody's commission silently vanishing, and they will find out weeks
// later with no way to prove it.

const PIN_RE = /^[0-9]{6}$/;

export function isPinShaped(pin) {
  return PIN_RE.test(String(pin ?? "").trim());
}

// Only our own callers may attribute on behalf of somebody else. A partner
// key presenting a PIN would be one channel claiming another channel's
// commission, so it is refused rather than ignored.
export function mayAttribute(keyRow) {
  return keyRow?.scope === "internal";
}

export function validatePinUse(pin, keyRow) {
  if (pin == null || String(pin).trim() === "") return { ok: true, pin: null };
  if (!mayAttribute(keyRow))
    return { ok: false, status: 403, code: "forbidden",
             reason: "Only an internal-scope key may attribute a booking to an agent PIN" };
  if (!isPinShaped(pin))
    return { ok: false, status: 422, code: "validation_failed",
             reason: "channel_pin must be six digits" };
  return { ok: true, pin: String(pin).trim() };
}

// What the resolved PIN means for the record being written. The agent's
// channel wins over the calling key's channel, because that is the entire
// question a PIN answers: who introduced this.
export function attributionFor(pinRow, callingChannel) {
  if (!pinRow) return { channel_id: callingChannel?.id ?? null, attributed_via: "key" };
  return {
    channel_id: pinRow.channel_id,
    attributed_via: "pin",
    attributed_to: pinRow.label ?? null,
  };
}

// Commission is quoted from the channel, never from the caller, and never
// invented. A channel with no commission recorded returns null rather than
// zero: "we do not know" and "they get nothing" are different answers and
// only one of them is safe to put in front of an agent.
// First attribution wins, and this is the function that says so. An agent
// introduces somebody, the prospect later messages our own line, and the
// brain files an update carrying no PIN. Without this rule that update
// moves the lead onto our channel and takes the agent's commission with it,
// silently, and the agent has no way to see it happened.
export function shouldSetAttribution(existingChannelId, attribution) {
  if (attribution?.attributed_via === "pin") return true;   // an explicit claim
  return !existingChannelId;                                 // otherwise only fill a blank
}

export function commissionFor(channel) {
  if (!channel) return null;
  const pct = channel.commission_pct;
  const months = channel.commission_months;
  if (pct == null && channel.fee_fixed == null) return null;
  return {
    pct: pct ?? null,
    months: months ?? null,
    fee_fixed: channel.fee_fixed ?? null,
    gross_up: Boolean(channel.gross_up),
  };
}
