#!/usr/bin/env node
/**
 * Builds the contract templates that AdminDocumentsPage fetches at runtime.
 *
 * The generator downloads the filled agreement as a standalone .html file that
 * a tenant opens from disk, so the stylesheet cannot be a <link>: it has to be
 * inlined. Inlining it by hand in two documents guarantees they drift apart,
 * which is exactly what happened to the old template. So the chrome and the
 * stylesheet live once, here, and both agreements are assembled from them.
 *
 * Run: npm run build:templates
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "scripts", "contract-templates");
const out = join(root, "public", "templates");

const shell = readFileSync(join(src, "shell.html"), "utf8");
const style = readFileSync(join(src, "style.css"), "utf8");

/** Every placeholder the generator supplies. A template may use a subset. */
const KNOWN_PLACEHOLDERS = new Set([
  "TENANT_NAME", "ID_NUMBER", "PHONE", "EMAIL", "ROOM_CODE", "ROOM_NAME",
  "PROPERTY_NAME", "PROPERTY_ADDRESS", "COMMON_AREAS", "MONTHLY_RENT",
  "DEPOSIT_AMOUNT", "LICENCE_PERIOD", "START_DATE", "END_DATE", "REF_NUMBER",
  "DATE", "FEE_SCHEDULE_ROWS", "EXTRA_TERMS",
]);

const DOCS = [
  { body: "tenancy.body.html", file: "tenancy-agreement.html",
    title: "Tenancy Agreement", footnote: "Tenancy Agreement · Ivory Heights" },
  { body: "licence.body.html", file: "licence-agreement.html",
    title: "Licence Agreement", footnote: "Licence Agreement · Chiltern Park & Thomson Grove" },
];

let failed = false;

for (const doc of DOCS) {
  const body = readFileSync(join(src, doc.body), "utf8");

  // A placeholder the generator does not know about would render as a literal
  // "[SOMETHING]" on a signed contract, so fail the build instead.
  for (const m of body.matchAll(/\{\{([A-Z_0-9]+)\}\}/g)) {
    if (!KNOWN_PLACEHOLDERS.has(m[1]) && !/^FEE_DATE_\d+$/.test(m[1])) {
      console.error(`  unknown placeholder {{${m[1]}}} in ${doc.body}`);
      failed = true;
    }
  }

  // Mark reacts badly to em-dashes, and these documents go out under his name.
  const dashes = (body.match(/[–—]/g) || []).length;
  if (dashes > 0) {
    console.error(`  ${dashes} em/en dash(es) in ${doc.body}`);
    failed = true;
  }

  const html = shell
    .replace("<!--@STYLE-->", style)
    .replace("<!--@BODY-->", body)
    .replaceAll("<!--@TITLE-->", doc.title)
    .replace("<!--@FOOTNOTE-->", doc.footnote);

  writeFileSync(join(out, doc.file), html);
  console.log(`  ${doc.file}  ${(html.length / 1024).toFixed(1)} kB`);
}

if (failed) {
  console.error("contract templates NOT built");
  process.exit(1);
}
console.log("contract templates built");
