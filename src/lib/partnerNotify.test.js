import { test } from "node:test";
import assert from "node:assert/strict";
import {
  nightsBetween,
  quoteFor,
  bookingRequestEmail,
  bookingEmail,
  bookingCancelledEmail,
} from "./partnerNotify.js";

const direct = {
  name: "Lazybee Internal", slug: "lazybee-internal",
  commission_pct: null, commission_months: null, gross_up: true, fee_fixed: null,
};
const room = {
  unit_code: "CP-MR", name: "Master Room", price_monthly: 1500, deposit_months: 1,
  property: { name: "Chiltern Park" },
};
const guest = { name: "Jane Tan", email: "jane@example.com", phone: "+65 8000 0000" };

test("nightsBetween counts calendar nights, null when open-ended", () => {
  assert.equal(nightsBetween("2027-05-01", "2027-05-31"), 30);
  assert.equal(nightsBetween("2027-05-01", null), null);
});

test("quoteFor clamps short stays to the 3-month rate and defaults open-ended to 12", () => {
  assert.equal(quoteFor(room, direct, 30 / 30.44).quoteMonths, 3);
  assert.equal(quoteFor(room, direct, null).quoteMonths, 12);
  assert.equal(quoteFor(room, direct, 6).monthly, 1500);
  assert.equal(quoteFor(room, direct, 6).deposit, 1500);
});

test("quoteFor falls back to the base rate when channel pricing refuses the duration", () => {
  const agent = { name: "Agent Co", slug: "agent-co", commission_months: 12, gross_up: true };
  const q = quoteFor(room, agent, 3);
  assert.equal(q.base, true);
  assert.equal(q.monthly, 1500);
  assert.equal(q.deposit, null);
});

test("quoteFor is null without a base price, and emails still compose", () => {
  const bare = { unit_code: "CP-MR", property: { name: "Chiltern Park" } };
  assert.equal(quoteFor(bare, direct, 6), null);
  const { subject, text } = bookingEmail({
    channel: direct, room: bare, guest,
    booking: { id: "bid-1", starts_on: "2027-05-01", ends_on: null, status: "confirmed" },
  });
  assert.equal(subject, "Booking: CP-MR, Jane Tan, via Lazybee Internal");
  assert.ok(!text.includes("Rate:"));
  assert.ok(!text.includes("Deposit:"));
});

test("bookingEmail carries guest, room, stay, money, channel and ref", () => {
  const { subject, text } = bookingEmail({
    channel: direct, room, guest,
    booking: {
      id: "bid-1", starts_on: "2027-05-01", ends_on: "2027-05-31",
      status: "confirmed", external_ref: "ul-8891",
    },
  });
  assert.equal(subject, "Booking: CP-MR, S$1,500/mo, Jane Tan, via Lazybee Internal");
  assert.equal(text, [
    "Guest: Jane Tan <jane@example.com> +65 8000 0000",
    "Room: CP-MR (Master Room), Chiltern Park",
    "Stay: 2027-05-01 to 2027-05-31 (30 nights)",
    "Rate: S$1,500/mo (3-mo Lazybee Internal rate), est. total S$1,478",
    "Deposit: S$1,500",
    "Channel: Lazybee Internal",
    "Ref: ul-8891",
    "Status: confirmed",
    "Booking id: bid-1",
  ].join("\n"));
});

test("bookingEmail on an open-ended stay quotes 12 months and skips the total", () => {
  const { text } = bookingEmail({
    channel: direct, room, guest,
    booking: { id: "bid-2", starts_on: "2027-05-01", ends_on: null, status: "confirmed" },
  });
  assert.ok(text.includes("Stay: 2027-05-01 to open-ended"));
  assert.ok(text.includes("Rate: S$1,500/mo (12-mo Lazybee Internal rate)"));
  assert.ok(!text.includes("est. total"));
});

test("bookingRequestEmail carries applicant, move-in, money and note", () => {
  const { subject, text } = bookingRequestEmail({
    channel: direct, room: { ...room, unit_code: "IH-STD1", name: null, property: { name: "Ivory Heights" } },
    request: {
      move_in: "2026-10-01", duration_months: 6, note: "student intake",
      applicant: guest,
    },
    requestId: "req-1",
  });
  assert.equal(subject, "Booking request: IH-STD1, S$1,500/mo, Jane Tan, via Lazybee Internal");
  assert.equal(text, [
    "Applicant: Jane Tan <jane@example.com> +65 8000 0000",
    "Room: IH-STD1, Ivory Heights",
    "Move-in: 2026-10-01 for 6 months",
    "Rate: S$1,500/mo (6-mo Lazybee Internal rate)",
    "Deposit: S$1,500",
    "Channel: Lazybee Internal",
    "Note: student intake",
    "Request id: req-1",
  ].join("\n"));
});

test("bookingCancelledEmail says the dates reopened", () => {
  const { subject, text } = bookingCancelledEmail({
    channel: direct, room,
    booking: {
      id: "bid-1", starts_on: "2027-05-01", ends_on: "2027-05-31",
      external_ref: "ul-8891", guest,
    },
  });
  assert.equal(subject, "Booking cancelled: CP-MR, Jane Tan, via Lazybee Internal");
  assert.ok(text.includes("Stay: 2027-05-01 to 2027-05-31 (dates reopened)"));
  assert.ok(text.includes("Booking id: bid-1"));
});
