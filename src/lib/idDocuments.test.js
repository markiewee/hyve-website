// Run with: node --test src/lib/idDocuments.test.js
//
// The rules about which identity document needs two sides, and when a pass has
// gone stale, decide what a tenant is forced to do the moment they open the
// portal. They were previously inline in IdScanForm and duplicated twice, so
// nothing could check them. They live here so they can be.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isIpa,
  IPA_GRACE_DAYS,
  needsBackImage,
  passLabel,
  passStatus,
  storagePathFrom,
  EXPIRING_SOON_DAYS,
} from "./idDocuments.js";

/* ── which documents have two sides ───────────────────────────────── */

test("a passport is one photo page, never a back", () => {
  assert.equal(needsBackImage({ kind: "ID", type: "PASSPORT" }), false);
});

test("an NRIC has a back and it is the half with the address", () => {
  assert.equal(needsBackImage({ kind: "ID", type: "NRIC" }), true);
});

test("every card pass has a back", () => {
  for (const type of [
    "WORK_PERMIT",
    "EMPLOYMENT_PASS",
    "S_PASS",
    "STUDENT_PASS",
    "DEPENDANT_PASS",
    "LONG_TERM_VISIT_PASS",
  ]) {
    assert.equal(needsBackImage({ kind: "PASS", type }), true, `${type} should need a back`);
  }
});

test("an IPA is a letter, so asking for its back would trap the tenant", () => {
  assert.equal(needsBackImage({ kind: "PASS", type: "IPA" }), false);
});

test("an unknown pass type asks for both sides rather than quietly accepting one", () => {
  // A pass type we have not seen is far more likely to be a card than a
  // letter, and the cost of asking is a second photo. The cost of not asking
  // is discovering at an MOM audit that half the file is one-sided.
  assert.equal(needsBackImage({ kind: "PASS", type: "OTHER" }), true);
  assert.equal(needsBackImage({ kind: "PASS", type: "SOMETHING_NEW" }), true);
});

test("a missing type does not demand a back nobody can supply", () => {
  assert.equal(needsBackImage({ kind: "PASS", type: null }), false);
  assert.equal(needsBackImage({ kind: "ID", type: null }), false);
});

/* ── labels ───────────────────────────────────────────────────────── */

test("labels read as a person would say them", () => {
  assert.equal(passLabel("EMPLOYMENT_PASS"), "Employment Pass");
  assert.equal(passLabel("LONG_TERM_VISIT_PASS"), "Long Term Visit Pass");
  assert.equal(passLabel("IPA"), "In-Principle Approval");
  // A value typed straight into the admin form rather than picked from a list.
  assert.equal(passLabel("Student Pass (IPA granted, not yet issued)"), "Student Pass (IPA granted, not yet issued)");
  assert.equal(passLabel(null), "pass");
});

/* ── expiry ───────────────────────────────────────────────────────── */

const on = (d) => new Date(`${d}T00:00:00+08:00`);
const TODAY = on("2026-08-18");

test("a pass that ran out is expired, and the portal should say so", () => {
  const s = passStatus({ pass_type: "STUDENT_PASS", pass_expiry: "2026-08-13" }, TODAY);
  assert.equal(s.state, "EXPIRED");
  assert.equal(s.daysLeft, -5);
  assert.equal(s.blocking, true);
});

test("a pass expiring today is not expired yet", () => {
  const s = passStatus({ pass_type: "S_PASS", pass_expiry: "2026-08-18" }, TODAY);
  assert.equal(s.state, "EXPIRING_SOON");
  assert.equal(s.daysLeft, 0);
});

test("a pass inside the warning window warns but does not shout", () => {
  const s = passStatus({ pass_type: "STUDENT_PASS", pass_expiry: "2026-09-16" }, TODAY);
  assert.equal(s.state, "EXPIRING_SOON");
  assert.equal(s.daysLeft, 29);
  assert.equal(s.blocking, false);
});

test("a pass past the warning window is simply valid", () => {
  const s = passStatus({ pass_type: "EMPLOYMENT_PASS", pass_expiry: "2027-11-05" }, TODAY);
  assert.equal(s.state, "VALID");
  assert.equal(s.blocking, false);
});

test("the warning window is a month, so a tenant has time to book an appointment", () => {
  assert.equal(EXPIRING_SOON_DAYS, 30);
  assert.equal(passStatus({ pass_type: "S_PASS", pass_expiry: "2026-09-17" }, TODAY).state, "EXPIRING_SOON");
  assert.equal(passStatus({ pass_type: "S_PASS", pass_expiry: "2026-09-18" }, TODAY).state, "VALID");
});

test("a foreigner on file with no expiry date is a gap, not a pass", () => {
  // Two live tenants are in exactly this state right now, so this is not
  // hypothetical: a pass type with no date is a hole in the compliance file.
  const s = passStatus({ pass_type: "EMPLOYMENT_PASS", pass_expiry: null }, TODAY);
  assert.equal(s.state, "MISSING");
  assert.equal(s.blocking, true);
});

test("someone with no pass at all is a Singaporean, and gets left alone", () => {
  const s = passStatus({ pass_type: null, pass_expiry: null }, TODAY);
  assert.equal(s.state, "NOT_APPLICABLE");
  assert.equal(s.blocking, false);
});

test("passStatus survives a null profile rather than blanking the portal", () => {
  assert.equal(passStatus(null, TODAY).state, "NOT_APPLICABLE");
  assert.equal(passStatus(undefined, TODAY).state, "NOT_APPLICABLE");
});

test("an unparseable expiry is treated as missing, not as valid forever", () => {
  const s = passStatus({ pass_type: "S_PASS", pass_expiry: "not a date" }, TODAY);
  assert.equal(s.state, "MISSING");
});

/* ── storage paths ────────────────────────────────────────────────── */

test("a stored public url resolves back to the object path", () => {
  // Every document on file was saved as a bucket-public url, and the bucket is
  // private, so those urls answer 400. Consumers re-sign from the path, which
  // is why they still work. This is that derivation, in one place instead of
  // copied inline at every call site.
  assert.equal(
    storagePathFrom(
      "https://diiilqpfmlxjwiaeophb.supabase.co/storage/v1/object/public/tenant-documents/tenants/abc/id-front-1.jpg"
    ),
    "tenants/abc/id-front-1.jpg"
  );
});

test("a stored signed url drops its expired token", () => {
  assert.equal(
    storagePathFrom(
      "https://x.supabase.co/storage/v1/object/sign/tenant-documents/tenants/abc/pass-front-2.jpg?token=deadbeef"
    ),
    "tenants/abc/pass-front-2.jpg"
  );
});

test("a bare path is already a path", () => {
  assert.equal(storagePathFrom("tenants/abc/pass-back-3.jpg"), "tenants/abc/pass-back-3.jpg");
});

test("nothing in gives nothing out", () => {
  assert.equal(storagePathFrom(null), null);
  assert.equal(storagePathFrom(""), null);
});

/* ── IPA: a promise of a pass, not a pass ─────────────────────────── */

test("an IPA is recognised however it was typed into the admin form", () => {
  assert.equal(isIpa("IPA"), true);
  assert.equal(isIpa("In-Principle Approval (IPA)"), true);
  // The real value on Ilse's row today.
  assert.equal(isIpa("Student Pass (IPA granted, not yet issued)"), true);
  assert.equal(isIpa("STUDENT_PASS"), false);
  assert.equal(isIpa(null), false);
});

test("the grace period is two weeks from arrival", () => {
  assert.equal(IPA_GRACE_DAYS, 14);
});

test("an IPA holder inside the grace period is left alone", () => {
  // Ilse: moved in 5 Aug, 13 days ago. Due tomorrow, not today.
  const s = passStatus(
    { pass_type: "Student Pass (IPA granted, not yet issued)", pass_expiry: null, moved_in_at: "2026-08-05" },
    TODAY
  );
  assert.equal(s.state, "IPA_PENDING");
  assert.equal(s.blocking, false);
  assert.equal(s.daysHere, 13);
  assert.equal(s.daysLeft, 1);
});

test("an IPA holder past two weeks gets chased", () => {
  const s = passStatus(
    { pass_type: "IPA", pass_expiry: "2026-12-20", moved_in_at: "2026-08-01" },
    TODAY
  );
  assert.equal(s.state, "IPA_GRACE_ELAPSED");
  assert.equal(s.blocking, true);
  assert.equal(s.daysHere, 17);
});

test("an IPA that has not moved in yet has no clock running", () => {
  // Julia: IPA valid to December, moves in 8 Sep. Nothing to collect yet, and
  // her IPA's own expiry date is irrelevant to whether she holds a card.
  const s = passStatus(
    { pass_type: "IPA", pass_expiry: "2026-12-20", moved_in_at: "2026-09-08" },
    TODAY
  );
  assert.equal(s.state, "IPA_PENDING");
  assert.equal(s.blocking, false);
});

test("a long-dated IPA is still chased, because the date is not the point", () => {
  // The trap this rule exists to close: an IPA valid until 2027 would read as
  // a perfectly valid pass on expiry alone, and it is still not a pass.
  const s = passStatus(
    { pass_type: "IPA", pass_expiry: "2027-12-31", moved_in_at: "2026-06-01" },
    TODAY
  );
  assert.equal(s.state, "IPA_GRACE_ELAPSED");
  assert.equal(s.blocking, true);
});

test("an IPA with no move-in date on file does not get chased on a guess", () => {
  const s = passStatus({ pass_type: "IPA", pass_expiry: null, moved_in_at: null }, TODAY);
  assert.equal(s.state, "IPA_PENDING");
  assert.equal(s.blocking, false);
});
