// Run with: node --test supabase/functions/_shared/emailShell.test.js
//
// These assert the two things that break silently in email: a token drifting
// away from src/styles/lazybee.css, and a font stack losing its fallback.
// Gmail strips the Google Fonts link, so a bare family name renders as Times
// and nobody notices until a tenant sees it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { generic, urgent, escape, chip } from "./emailShell.js";

const input = {
  badge: "Rent due",
  headline: "Your rent for September.",
  greeting: "Hi Edward,",
  paragraphs: ["<strong>SGD 1,300.00</strong> is due by 1 Sep 2026."],
  money: { label: "Amount due", value: "SGD 1,300.00", footnote: "Due 1 Sep 2026" },
  details: [{ label: "Payment ref", value: chip("LZB-0417-EDW") }],
  cta: { label: "View Billing", url: "https://www.lazybee.sg/portal/billing" },
};

test("carries the design system v1.0 tokens, not the old teal scheme", () => {
  const html = generic(input);
  assert.ok(html.includes("#F6F2EA"), "alabaster ground");
  assert.ok(html.includes("#0E2E20"), "regal green band");
  assert.ok(html.includes("#B08D4F"), "brass rule");
  assert.ok(!html.includes("#006b5f"), "old teal must be gone");
  assert.ok(!html.includes("#f8f9ff"), "old blue-white must be gone");
});

test("every font stack keeps a real fallback for Gmail", () => {
  const html = generic(input);
  assert.ok(html.includes("'Cormorant Garamond',Georgia"), "serif fallback");
  assert.ok(html.includes("'Inter Tight',-apple-system"), "sans fallback");
  assert.ok(html.includes("'JetBrains Mono',ui-monospace"), "mono fallback");
});

test("the urgent variant repaints the band and the eyebrow, not the whole page", () => {
  const html = urgent(input);
  assert.ok(html.includes("#8C3A2B"), "bad token present");
  assert.ok(html.includes("#F6F2EA"), "ground stays alabaster");
});

test("the money band renders the value verbatim", () => {
  assert.ok(generic(input).includes("SGD 1,300.00"));
});

test("omitting money omits the band entirely", () => {
  const { money, ...noMoney } = input;
  assert.ok(!generic(noMoney).includes("#0E2E20;border-radius:2px"));
});

test("escape neutralises injected markup", () => {
  assert.equal(escape("<script>x</script>"), "&lt;script&gt;x&lt;/script&gt;");
});

// The headline and badge go through escape, so a tenant name or a ticket
// subject carrying markup cannot break out into the surrounding table. The
// escaped text still *contains* the words, which is fine; what matters is
// that no tag is formed.
test("a hostile headline cannot break the layout", () => {
  const html = generic({ ...input, headline: '</td></tr><img src=x onerror=alert(1)>' });
  assert.ok(!html.includes("<img"), "no real tag may be formed");
  assert.ok(html.includes("&lt;img"), "must be escaped instead");
});

// escape() output lands in href="..." as well as in element text. Escaping
// only < > & leaves a quote free to close the attribute early, so a link
// built from anything we did not author could inject attributes.
test("a quote in a CTA url cannot break out of the href attribute", () => {
  const html = generic({
    ...input,
    cta: { label: "Pay", url: 'https://x.test/" onmouseover="steal()' },
  });
  assert.ok(!html.includes('" onmouseover='), "must not close the attribute");
  assert.ok(html.includes("&quot;"), "quote must be entity-encoded");
});

test("empty paragraphs are dropped rather than rendered as blank space", () => {
  const html = generic({ ...input, paragraphs: ["real copy", "", null, undefined] });
  assert.equal(html.split('<p style="margin:0 0 18px 0">').length - 1, 2, "greeting + one para");
});

// This shipped broken once. The band carried only the `background` shorthand
// on a <table>, which several clients drop, leaving pale type on the cream
// ground and the amount owed effectively invisible. Every coloured surface
// now needs the bgcolor attribute and the background-color longhand.
test("every coloured surface survives a client that drops the background shorthand", () => {
  const html = urgent(input);
  assert.ok(html.includes('bgcolor="#8C3A2B"'), "band needs the bgcolor attribute");
  assert.ok(html.includes("background-color:#8C3A2B"), "band needs the longhand");
  assert.equal(
    /style="[^"]*background:#/.test(html),
    false,
    "no bare background shorthand may carry a colour"
  );
});

test("the green band is hardened the same way", () => {
  const html = generic(input);
  assert.ok(html.includes('bgcolor="#0E2E20"'));
  assert.ok(html.includes("background-color:#0E2E20"));
});

test("the banner renders full bleed and only when asked for", () => {
  const withBanner = urgent({ ...input, banner: "Final notice before termination of tenancy" });
  assert.ok(withBanner.includes("Final notice before termination of tenancy"));
  assert.ok(withBanner.includes('bgcolor="#8C3A2B"'));
  assert.ok(!generic(input).includes("Final notice before termination"), "absent by default");
});

test("renders under Gmail's 102kb clipping threshold", () => {
  assert.ok(Buffer.byteLength(generic(input)) < 102 * 1024);
});
