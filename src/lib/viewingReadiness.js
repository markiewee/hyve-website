// src/lib/viewingReadiness.js
// Compute whether a lead is ready for a viewing to be scheduled.
//
// Hard rule: a viewing cannot proceed until ALL of these are in place:
//   1. Name (intent.name_self_reported OR lead.name)
//   2. Pax (intent.pax)
//   3. Move-in date (intent.move_in_date)
//   4. Lease duration (intent.lease_months)
//   5. Door-opener acknowledged (activity_log has type=door_opener_ack)
//
// Mark cannot show units — the door-opener is always a resident or house captain.

export const REQUIREMENTS = [
  { key: "name",        label: "Name"           },
  { key: "pax",         label: "Pax"            },
  { key: "moveIn",      label: "Move-in date"   },
  { key: "leaseMonths", label: "Lease duration" },
  { key: "doorOpener",  label: "Door-opener confirmed" },
];

export function evaluateReadiness(lead) {
  const intent = lead?.intent || {};
  const activity = Array.isArray(lead?.activity_log) ? lead.activity_log : [];

  const checks = {
    name: Boolean(intent.name_self_reported || lead?.name),
    pax: intent.pax != null,
    moveIn: Boolean(intent.move_in_date),
    leaseMonths: intent.lease_months != null,
    doorOpener: activity.some((e) => e?.type === "door_opener_ack"),
  };

  const total = REQUIREMENTS.length;
  const met = Object.values(checks).filter(Boolean).length;
  const missing = REQUIREMENTS.filter((r) => !checks[r.key]).map((r) => r.label);

  return {
    checks,
    met,
    total,
    missing,
    ready: met === total,
  };
}
