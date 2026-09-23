// src/lib/idDocuments.js
//
// The rules about identity documents: which ones have two sides, and when a
// pass has gone stale enough that we should stop the tenant and ask.
//
// These were inline in IdScanForm, and the expiry arithmetic was written out
// twice in the same file with slightly different windows. That is fine until
// the rule matters, and it matters now: MOM expects us to hold a valid pass
// for every foreign resident, and one of our tenants has been living here on
// an expired Student Pass since 13 Aug 2026 with nothing in the product
// telling her or us.

/** Card passes have a front and a back. A passport is a single photo page and
    an IPA is a letter, so neither has a second side to photograph. */
const SINGLE_SIDED_ID = new Set(["PASSPORT"]);
const SINGLE_SIDED_PASS = new Set(["IPA"]);

const PASS_LABELS = {
  WORK_PERMIT: "Work Permit",
  EMPLOYMENT_PASS: "Employment Pass",
  S_PASS: "S Pass",
  STUDENT_PASS: "Student Pass",
  DEPENDANT_PASS: "Dependant Pass",
  LONG_TERM_VISIT_PASS: "Long Term Visit Pass",
  IPA: "In-Principle Approval",
  OTHER: "pass",
};

/** How long before expiry we start warning. A month is roughly the lead time
    on an MOM or ICA renewal appointment, so warning earlier is noise and
    warning later is too late to act on. */
export const EXPIRING_SOON_DAYS = 30;

/** How long after arrival an IPA holder has to produce the real card. An IPA is
    the letter MOM or ICA issues before the pass exists; two weeks is Mark's
    rule and roughly what collection actually takes. */
export const IPA_GRACE_DAYS = 14;

/** Free text on the admin form, so match rather than compare. One of the two
    rows on file reads "Student Pass (IPA granted, not yet issued)". */
export function isIpa(type) {
  return Boolean(type) && /ipa|in-principle/i.test(type);
}

/**
 * Does this document need a photo of its back?
 *
 * @param {{kind: "ID"|"PASS", type: string|null}} doc
 */
export function needsBackImage({ kind, type }) {
  if (!type) return false;
  if (kind === "ID") return !SINGLE_SIDED_ID.has(type);
  // An unrecognised pass type is far likelier to be a card than a letter, and
  // the cost of asking for a second photo is one photo. The cost of not asking
  // is finding out at an audit that half the file is one-sided.
  return !SINGLE_SIDED_PASS.has(type);
}

/** Human label for a pass type, for use mid-sentence. Falls through unchanged
    for values typed by hand into the admin form rather than picked from the
    list, of which there are two on file. */
export function passLabel(type) {
  if (!type) return "pass";
  return PASS_LABELS[type] ?? type;
}

/** Whole days from `from` to `iso`, in calendar terms rather than elapsed
    hours, so a pass expiring later today reads as 0 and not -1. */
function daysUntil(iso, from) {
  const end = new Date(`${iso}T00:00:00+08:00`);
  if (Number.isNaN(end.getTime())) return null;
  const start = new Date(
    `${new Date(from).toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" })}T00:00:00+08:00`
  );
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

/**
 * Where a tenant's pass stands.
 *
 * States:
 *   NOT_APPLICABLE  no pass on file and none expected (a Singaporean or PR)
 *   MISSING         a pass type on file with no usable expiry date
 *   EXPIRED         the date has passed
 *   EXPIRING_SOON   inside EXPIRING_SOON_DAYS
 *   VALID           nothing to do
 *
 * `blocking` marks the states that earn an unmissable prompt in the portal.
 *
 * @param {{pass_type?: string|null, pass_expiry?: string|null, moved_in_at?: string|null}|null} details
 * @param {Date|number} [now]
 */
export function passStatus(details, now = new Date()) {
  const type = details?.pass_type ?? null;
  const expiry = details?.pass_expiry ?? null;

  if (!type) {
    return { state: "NOT_APPLICABLE", blocking: false, daysLeft: null, type: null, expiry: null };
  }

  // An IPA is a promise of a pass, not a pass, and its own expiry date says
  // nothing about whether the holder ever collected the card. Judge it on how
  // long the tenant has been here instead. Before they arrive there is nothing
  // to collect, so the clock does not start.
  if (isIpa(type)) {
    const movedIn = details?.moved_in_at ?? null;
    const daysHere = movedIn ? -daysUntil(String(movedIn).slice(0, 10), now) : null;
    if (daysHere !== null && daysHere > IPA_GRACE_DAYS) {
      return {
        state: "IPA_GRACE_ELAPSED",
        blocking: true,
        daysLeft: null,
        daysHere,
        type,
        expiry,
      };
    }
    return {
      state: "IPA_PENDING",
      blocking: false,
      daysLeft: daysHere === null ? null : IPA_GRACE_DAYS - daysHere,
      daysHere,
      type,
      expiry,
    };
  }

  const daysLeft = expiry ? daysUntil(expiry, now) : null;

  if (daysLeft === null) {
    return { state: "MISSING", blocking: true, daysLeft: null, type, expiry };
  }
  if (daysLeft < 0) {
    return { state: "EXPIRED", blocking: true, daysLeft, type, expiry };
  }
  // Inclusive: "expiring within 30 days" has to include the thirtieth day, or
  // the window is quietly 29 days long and the copy is a lie.
  if (daysLeft <= EXPIRING_SOON_DAYS) {
    return { state: "EXPIRING_SOON", blocking: false, daysLeft, type, expiry };
  }
  return { state: "VALID", blocking: false, daysLeft, type, expiry };
}

/** The private bucket every tenant document lives in. */
export const TENANT_DOCS_BUCKET = "tenant-documents";

/**
 * Turn whatever is stored in a *_url column into a bucket object path.
 *
 * Older rows hold a bucket-public url (which answers 400, because the bucket
 * is private) or a signed url whose token died an hour after upload. New rows
 * hold the bare path. All three shapes resolve to the same object path here,
 * and the caller signs a fresh url from it at render time.
 */
export function storagePathFrom(value) {
  if (!value) return null;
  const marker = `/${TENANT_DOCS_BUCKET}/`;
  let raw = value.includes(marker) ? value.split(marker)[1] : value;
  if (raw.startsWith(`${TENANT_DOCS_BUCKET}/`)) raw = raw.slice(TENANT_DOCS_BUCKET.length + 1);
  const path = raw.split("?")[0];
  return path || null;
}

/**
 * Sign a short-lived url for a stored tenant document.
 *
 * Takes the supabase client as an argument so the tests can hand it a fake.
 * Returns null when there is nothing on file or the object cannot be signed,
 * never the stored value itself: a raw stored url cannot open a private
 * object, so offering it as a fallback only hands the admin a 400.
 */
export async function signTenantDoc(client, value, expiresIn = 3600) {
  const path = storagePathFrom(value);
  if (!path) return null;
  try {
    const { data, error } = await client.storage
      .from(TENANT_DOCS_BUCKET)
      .createSignedUrl(path, expiresIn);
    if (error) return null;
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}
