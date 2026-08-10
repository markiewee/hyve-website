// Run with: node --test src/lib/propertyDocuments.test.js
//
// The month is the thing this feature cannot get wrong. Mark uploads the current
// AC servicing bill and then backfills earlier months, so a document labelled
// "Jul 2026" that was actually filed for August makes the whole archive lie.
// The month round-trip and the timezone trap are therefore pinned here.
//
// The doc_type list is pinned too: it has to match the CHECK constraint in
// 20260810100000_property_documents.sql, and a value drifting out of sync would
// only show up as a failed insert in production.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PROPERTY_DOC_TYPES,
  PROPERTY_DOC_TYPE_LABELS,
  propertyDocLabel,
  formatPeriodMonth,
  monthInputToDate,
  dateToMonthInput,
  formatFileSize,
  storagePathFor,
} from "./propertyDocuments.js";

test("doc types match the database CHECK constraint", () => {
  assert.deepEqual(PROPERTY_DOC_TYPES, [
    "AC_SERVICING",
    "INVOICE",
    "STATEMENT",
    "RECEIPT",
    "REPORT",
    "OTHER",
  ]);
  for (const t of PROPERTY_DOC_TYPES) {
    assert.ok(PROPERTY_DOC_TYPE_LABELS[t], `${t} has no label`);
  }
});

test("an unknown doc type still renders something readable", () => {
  assert.equal(propertyDocLabel("AC_SERVICING"), "AC Servicing");
  assert.equal(propertyDocLabel("SOMETHING_NEW"), "Document");
  assert.equal(propertyDocLabel(undefined), "Document");
});

test("period month formats without slipping a month", () => {
  assert.equal(formatPeriodMonth("2026-08-01"), "Aug 2026");
  assert.equal(formatPeriodMonth("2026-01-01"), "Jan 2026");
  assert.equal(formatPeriodMonth("2026-12-01"), "Dec 2026");
  assert.equal(formatPeriodMonth(null), null);
  assert.equal(formatPeriodMonth(""), null);
});

test("a midnight-UTC date does not slip back a month in a western timezone", () => {
  // new Date("2026-08-01").toLocaleDateString() in UTC-5 renders as 31 Jul.
  // Parsing the ISO string directly is what keeps this stable regardless of
  // where the browser is.
  const original = process.env.TZ;
  process.env.TZ = "America/New_York";
  try {
    assert.equal(formatPeriodMonth("2026-08-01"), "Aug 2026");
  } finally {
    process.env.TZ = original;
  }
});

test("month input round-trips through the date column", () => {
  assert.equal(monthInputToDate("2026-08"), "2026-08-01");
  assert.equal(dateToMonthInput("2026-08-01"), "2026-08");
  assert.equal(dateToMonthInput(monthInputToDate("2026-02")), "2026-02");
  // Anything that is not a real month input stores null rather than a bad date.
  assert.equal(monthInputToDate(""), null);
  assert.equal(monthInputToDate("not-a-month"), null);
  assert.equal(monthInputToDate("2026-08-01"), null);
  assert.equal(dateToMonthInput(null), "");
});

test("storage paths are namespaced by property and sanitised", () => {
  const propertyId = "1d1cff29-0542-4520-bcf7-dfe0f7e8cb48";
  const path = storagePathFor(propertyId, "AC servicing (Aug) #2.pdf");
  assert.ok(path.startsWith(`${propertyId}/`), "must sit in the property folder");
  assert.ok(path.endsWith(".pdf"), "extension is preserved");
  assert.ok(!/[ ()#]/.test(path), `unsafe characters survived: ${path}`);
  // Two uploads of the same filename must not collide.
  assert.notEqual(storagePathFor(propertyId, "bill.pdf"), storagePathFor(propertyId, "bill.pdf"));
});

test("a missing filename still yields a usable path", () => {
  const path = storagePathFor("prop-1", "");
  assert.ok(path.startsWith("prop-1/"));
  assert.ok(path.endsWith("document"));
});

test("file sizes read the way a human expects", () => {
  assert.equal(formatFileSize(0), "0 B");
  assert.equal(formatFileSize(512), "512 B");
  assert.equal(formatFileSize(2048), "2 KB");
  assert.equal(formatFileSize(5 * 1024 * 1024), "5.0 MB");
  assert.equal(formatFileSize(null), "");
});
