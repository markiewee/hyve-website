// Run with: node --test supabase/functions/_shared/rentMatch.test.js
//
// The tests that matter most are the ones asserting something is NOT closed
// automatically. Auto-closing the wrong row credits tenant A's money to
// tenant B, and then chases tenant A for rent they already paid.

import { test } from "node:test";
import assert from "node:assert/strict";
import { nameScore, amountScore, outstandingOf, matchCredit } from "./rentMatch.js";

const row = (over = {}) => ({
  id: over.id ?? "r1",
  payment_ref: over.payment_ref ?? "LB-CPPR3-2608",
  tenant_name: over.tenant_name ?? "Janella Naomy Napolitano",
  rent_amount: over.rent_amount ?? 1600,
  late_fee: over.late_fee ?? 0,
  paid_amount: over.paid_amount ?? 0,
});

const credit = (over = {}) => ({
  amount: over.amount ?? 1600,
  counterparty: over.counterparty ?? "JANELLA NAPOLITANO",
  haystack: over.haystack ?? "",
});

/* ── name scoring ────────────────────────────────────────────────── */

test("reordered names still match the same person", () => {
  assert.equal(nameScore("Heckman III David John", "DAVID HECKMAN"), 1);
});

test("honorifics and suffixes are ignored", () => {
  assert.equal(nameScore("MR DAVID HECKMAN JR", "David Heckman"), 1);
});

test("a single shared surname cannot reach the auto threshold", () => {
  // "Lim" alone is a coincidence, not an identification.
  assert.ok(nameScore("ALICE LIM", "BENJAMIN LIM") <= 0.5);
});

test("unrelated names score zero", () => {
  assert.equal(nameScore("WEE YI REN MARK", "Tiffany Snow Wanna"), 0);
});

test("a missing name scores zero rather than throwing", () => {
  assert.equal(nameScore(null, "David Heckman"), 0);
  assert.equal(nameScore("David Heckman", undefined), 0);
});

/* ── amount scoring ──────────────────────────────────────────────── */

test("outstanding accounts for late fees and part payments", () => {
  assert.equal(outstandingOf(row({ rent_amount: 1600, late_fee: 80, paid_amount: 600 })), 1080);
});

test("exact to the cent scores 1, and a cent of drift still counts", () => {
  assert.equal(amountScore(1600, row()), 1);
  assert.equal(amountScore(1599.99, row()), 1);
});

test("an overpayment settles but is not treated as exact", () => {
  assert.equal(amountScore(1700, row()), 0.7);
});

test("a plausible part payment scores as such", () => {
  assert.equal(amountScore(1550, row()), 0.5);
});

test("an unrelated amount scores zero", () => {
  assert.equal(amountScore(300, row()), 0);
});

/* ── the decision ────────────────────────────────────────────────── */

test("a quoted reference settles on its own, whatever the name says", () => {
  const r = matchCredit(
    credit({ counterparty: "SOME COMPANY PTE LTD", haystack: "LBCPPR32608 PAYNOW" }),
    [row()]
  );
  assert.equal(r.decision, "AUTO");
  assert.equal(r.row.id, "r1");
});

test("name plus exact amount, uncontested, closes", () => {
  const r = matchCredit(credit(), [row(), row({ id: "r2", tenant_name: "Li Yang Khoo", rent_amount: 800 })]);
  assert.equal(r.decision, "AUTO");
  assert.equal(r.row.id, "r1");
});

test("THE DANGEROUS ONE: exact amount but a name we do not recognise goes to review", () => {
  const r = matchCredit(
    credit({ counterparty: "ACME LOGISTICS PTE LTD" }),
    [row()]
  );
  assert.equal(r.decision, "REVIEW");
  assert.notEqual(r.decision, "AUTO");
});

test("two tenants owing the same amount with the same name never auto-close", () => {
  const r = matchCredit(credit({ counterparty: "DAVID LIM" }), [
    row({ id: "a", tenant_name: "David Lim", rent_amount: 1600 }),
    row({ id: "b", tenant_name: "David Lim", rent_amount: 1600, payment_ref: "LB-IHSTD1-2608" }),
  ]);
  assert.equal(r.decision, "REVIEW");
  assert.equal(r.alternatives.length, 2);
});

test("a name match with the wrong amount is proposed, not closed", () => {
  const r = matchCredit(credit({ amount: 300 }), [row()]);
  assert.equal(r.decision, "REVIEW");
  assert.match(r.reason, /amount is not what they owe/);
});

test("one transfer quoting two references is a human decision", () => {
  const r = matchCredit(
    credit({ amount: 3200, haystack: "LBCPPR32608LBIHSTD12608" }),
    [row(), row({ id: "r2", payment_ref: "LB-IHSTD1-2608", tenant_name: "Li Yang Khoo" })]
  );
  assert.equal(r.decision, "REVIEW");
  assert.equal(r.alternatives.length, 2);
});

test("a credit resembling nothing is unmatched, not forced onto the nearest row", () => {
  const r = matchCredit(
    credit({ amount: 12.5, counterparty: "GRAB SINGAPORE" }),
    [row()]
  );
  assert.equal(r.decision, "UNMATCHED");
  assert.equal(r.row, null);
});

test("a settled row cannot absorb another credit", () => {
  const r = matchCredit(credit({ amount: 1600 }), [row({ paid_amount: 1600 })]);
  assert.notEqual(r.decision, "AUTO");
});

test("a tenant with no name on file falls to review rather than matching on amount", () => {
  const r = matchCredit(credit({ counterparty: "SOMEONE ELSE" }), [row({ tenant_name: null })]);
  assert.equal(r.decision, "REVIEW");
});
