// src/lib/partnerNotify.js
//
// Sales notification emails for the partner API, as pure builders so the
// exact wording is pinned by tests (same drift-proofing as the resource
// serializers). Money resolves through rateCard, the arithmetic every
// channel quote uses; a pricing edge case falls back to the base rate
// rather than costing us the notification.

import { rateCard } from "./partnerSerialize.js";

const DEFAULT_QUOTE_MONTHS = 12;
const DAYS_PER_MONTH = 30.44;

export const fmtSGD = (n) => `S$${Math.round(n).toLocaleString("en-SG")}`;

export function nightsBetween(startsOn, endsOn) {
  if (!endsOn) return null;
  const nights = Math.round((new Date(endsOn) - new Date(startsOn)) / 86400000);
  return Number.isFinite(nights) ? nights : null;
}

/** Channel-resolved money for an email. Stays shorter than our 3-month
 * minimum are quoted at the 3-month rate, open-ended at 12. Never throws. */
export function quoteFor(room, channel, months) {
  if (room?.price_monthly == null) return null;
  const wanted = Math.round(Number(months));
  const quoteMonths = Math.min(36, Math.max(3,
    Number.isFinite(wanted) && wanted > 0 ? wanted : DEFAULT_QUOTE_MONTHS));
  try {
    const card = rateCard(room, channel, quoteMonths);
    return { monthly: card.monthly_rate, deposit: card.deposit, quoteMonths, base: false };
  } catch {
    return { monthly: Math.round(Number(room.price_monthly)), deposit: null, quoteMonths: null, base: true };
  }
}

const roomLabel = (room) =>
  [room.unit_code + (room.name ? ` (${room.name})` : ""), room.property?.name]
    .filter(Boolean).join(", ");

const personLine = (p) =>
  [p?.name, p?.email ? `<${p.email}>` : null, p?.phone].filter(Boolean).join(" ") || "(none given)";

const rateLine = (channel, q, total) =>
  `Rate: ${fmtSGD(q.monthly)}/mo${q.base ? " (base rate)" : ` (${q.quoteMonths}-mo ${channel.name} rate)`}` +
  (total != null ? `, est. total ${fmtSGD(total)}` : "");

const compose = (lines) => lines.filter(Boolean).join("\n");

export function bookingRequestEmail({ channel, room, request, requestId }) {
  const q = quoteFor(room, channel, request.duration_months);
  return {
    subject: `Booking request: ${room.unit_code}${q ? `, ${fmtSGD(q.monthly)}/mo` : ""}, ${request.applicant.name}, via ${channel.name}`,
    text: compose([
      `Applicant: ${personLine(request.applicant)}`,
      `Room: ${roomLabel(room)}`,
      `Move-in: ${request.move_in} for ${request.duration_months} months`,
      q && rateLine(channel, q, null),
      q?.deposit != null && `Deposit: ${fmtSGD(q.deposit)}`,
      `Channel: ${channel.name}`,
      request.note && `Note: ${request.note}`,
      requestId && `Request id: ${requestId}`,
    ]),
  };
}

export function bookingEmail({ channel, room, booking, guest }) {
  const nights = nightsBetween(booking.starts_on, booking.ends_on);
  const q = quoteFor(room, channel, nights == null ? null : nights / DAYS_PER_MONTH);
  const total = q && nights != null ? Math.round((q.monthly * nights) / DAYS_PER_MONTH) : null;
  return {
    subject: `Booking: ${room.unit_code}${q ? `, ${fmtSGD(q.monthly)}/mo` : ""}${guest?.name ? `, ${guest.name}` : ""}, via ${channel.name}`,
    text: compose([
      `Guest: ${personLine(guest)}`,
      `Room: ${roomLabel(room)}`,
      `Stay: ${booking.starts_on} to ${booking.ends_on ?? "open-ended"}${nights != null ? ` (${nights} nights)` : ""}`,
      q && rateLine(channel, q, total),
      q?.deposit != null && `Deposit: ${fmtSGD(q.deposit)}`,
      `Channel: ${channel.name}`,
      booking.external_ref && `Ref: ${booking.external_ref}`,
      `Status: ${booking.status}`,
      `Booking id: ${booking.id}`,
    ]),
  };
}

export function bookingCancelledEmail({ channel, room, booking }) {
  return {
    subject: `Booking cancelled: ${room.unit_code}${booking.guest?.name ? `, ${booking.guest.name}` : ""}, via ${channel.name}`,
    text: compose([
      `Guest: ${personLine(booking.guest)}`,
      `Room: ${roomLabel(room)}`,
      `Stay: ${booking.starts_on} to ${booking.ends_on ?? "open-ended"} (dates reopened)`,
      `Channel: ${channel.name}`,
      booking.external_ref && `Ref: ${booking.external_ref}`,
      `Booking id: ${booking.id}`,
    ]),
  };
}
