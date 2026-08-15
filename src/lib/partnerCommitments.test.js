import test from "node:test";
import assert from "node:assert/strict";
import {
  validateCommitment, commitmentView, isOverdue,
} from "./partnerCommitments.js";

const T0 = "2026-08-15T12:00:00.000Z";
const plusHours = (h) => new Date(Date.parse(T0) + h * 3600 * 1000).toISOString();

test("a promise needs words and someone it was made to", () => {
  assert.equal(validateCommitment({ promise: "will confirm the contractor slot tonight", chat_id: "1293" }).ok, true);
  assert.equal(validateCommitment({ promise: "will chase", counterparty: "tiff" }).ok, true);

  // No promise text, or trivially short: not a record.
  assert.equal(validateCommitment({ chat_id: "1293" }).ok, false);
  assert.equal(validateCommitment({ promise: "ok", chat_id: "1293" }).ok, false);

  // Nobody attached: unchaseable, reject.
  const v = validateCommitment({ promise: "will send the receipt tomorrow" });
  assert.equal(v.ok, false);
  assert.ok(v.missing.some((m) => m.includes("chat_id or counterparty")));

  // A due date that does not parse is worse than none.
  assert.equal(validateCommitment({ promise: "will call them back", chat_id: "9", due_at: "tomorrow-ish" }).ok, false);
  assert.equal(validateCommitment({ promise: "will call them back", chat_id: "9", due_at: plusHours(4) }).ok, true);
});

test("view exposes the chase fields and nothing surprising", () => {
  const row = {
    id: "c1", chat_id: "1293", counterparty: "tiff",
    promise: "will confirm timing tonight", due_at: plusHours(6),
    status: "OPEN", made_at: T0, closed_at: null, close_note: null,
    source: "whatsapp", channel_id: "secret-uuid", idempotency_key: "k",
  };
  const view = commitmentView(row);
  assert.equal(view.id, "c1");
  assert.equal(view.promise, "will confirm timing tonight");
  assert.equal(view.status, "OPEN");
  assert.equal(view.channel_id, undefined);
  assert.equal(view.idempotency_key, undefined);
});

test("overdue: explicit due date wins, otherwise 24h from made_at", () => {
  // Due in the future: not overdue.
  assert.equal(isOverdue({ status: "OPEN", due_at: plusHours(2), made_at: T0 }, T0), false);
  // Due passed: overdue.
  assert.equal(isOverdue({ status: "OPEN", due_at: plusHours(-1), made_at: plusHours(-30) }, T0), true);
  // No due date: 24h grace from made_at.
  assert.equal(isOverdue({ status: "OPEN", due_at: null, made_at: plusHours(-23) }, T0), false);
  assert.equal(isOverdue({ status: "OPEN", due_at: null, made_at: plusHours(-25) }, T0), true);
  // Closed promises are never overdue, whatever the clock says.
  assert.equal(isOverdue({ status: "KEPT", due_at: plusHours(-99), made_at: plusHours(-99) }, T0), false);
  assert.equal(isOverdue({ status: "DROPPED", due_at: null, made_at: plusHours(-99) }, T0), false);
});
