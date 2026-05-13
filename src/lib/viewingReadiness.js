// src/lib/viewingReadiness.js
// Compute whether a lead is ready for a viewing to be scheduled.
//
// Hard rule: a viewing cannot proceed until ALL of these are in place:
//   1. Name
//   2. Pax
//   3. Move-in date
//   4. Lease duration
//   5. Viewing host arrangement confirmed — see roles below.
//
// Viewing host arrangement satisfied when one of:
//   • In-person: a resident or captain has acknowledged BOTH door-opener and
//     shower roles (same person can fill both — preferred path).
//   • Virtual (last resort): Mark provides the door code remotely AND
//     conducts the tour by video call. Flagged via activity entry of
//     type "virtual_viewing_arranged".

export const REQUIREMENTS = [
  { key: "name",         label: "Name"                      },
  { key: "pax",          label: "Pax"                       },
  { key: "moveIn",       label: "Move-in date"              },
  { key: "leaseMonths",  label: "Lease duration"            },
  { key: "viewingHost",  label: "Viewing host(s) confirmed" },
];

export function evaluateReadiness(lead) {
  const intent = lead?.intent || {};
  const activity = Array.isArray(lead?.activity_log) ? lead.activity_log : [];

  const hasDoorOpener = activity.some((e) => e?.type === "door_opener_ack");
  const hasShower     = activity.some((e) => e?.type === "shower_ack");
  const hasVirtual    = activity.some((e) => e?.type === "virtual_viewing_arranged");
  const viewingHost   = (hasDoorOpener && hasShower) || hasVirtual;

  const checks = {
    name: Boolean(intent.name_self_reported || lead?.name),
    pax: intent.pax != null,
    moveIn: Boolean(intent.move_in_date),
    leaseMonths: intent.lease_months != null,
    viewingHost,
  };

  const total = REQUIREMENTS.length;
  const met = Object.values(checks).filter(Boolean).length;
  const missing = REQUIREMENTS.filter((r) => !checks[r.key]).map((r) => r.label);

  const viewingMode = !viewingHost
    ? null
    : (hasVirtual && !(hasDoorOpener && hasShower))
      ? "virtual"
      : "in_person";

  return {
    checks,
    met,
    total,
    missing,
    ready: met === total,
    viewingMode,
  };
}
