// supabase/functions/_shared/viewingEmails.js
//
// Every email a viewing prospect, a house captain or the admin inbox receives.
//
// These used to live inside viewing-notify/index.ts behind a private shell()
// with a teal #006b5f header and a system sans stack. When the tenant emails
// were rebuilt on the design system (PR #91) nothing pulled the viewing side
// along, so the first email a prospect ever got from us was a design
// generation behind the contract they would later sign. Pulling them out here
// does two things: they render through the same emailShell as the tenant mail,
// and they become plain functions that node --test can render without Deno, a
// Supabase client or a network.
//
// Everything in this file is pure. Lookups, transport and the dispatch switch
// stay in viewing-notify/index.ts.

import { generic, escape, T, F } from "./emailShell.js";

const PUBLIC_SITE_URL = "https://www.lazybee.sg";

/* ── formatting ───────────────────────────────────────────────────── */

/** "Saturday, 22 August 2026, 1:15 pm" in Singapore time, which is where the
    reader is standing when they use it. */
export function fmtDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("en-GB", {
    timeZone: "Asia/Singapore",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** A prospect standing at the wrong block is the whole failure mode this
    product has. Give them a map link, not just a postal code. */
export function mapsUrl(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/** btoa only takes latin-1, so utf-8 goes through TextEncoder first. A prospect
    called Rönkkö breaks the naive version. */
export function b64(s) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

/** RFC5545 UTC: 20260822T051500Z */
function toIcsDateUtc(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

/** Commas and semicolons are field separators in RFC5545. Every Lazybee address
    has commas in it, so skipping this truncates LOCATION in the invite. */
function escapeIcs(s) {
  return String(s)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function buildIcs({ uid, start, end, summary, description, location, status }) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lazybee Co-living//Viewing//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:" + (status === "CANCELLED" ? "CANCEL" : "REQUEST"),
    "BEGIN:VEVENT",
    `UID:${uid}@lazybee.sg`,
    `DTSTAMP:${toIcsDateUtc(new Date().toISOString())}`,
    `DTSTART:${toIcsDateUtc(start)}`,
    `DTEND:${toIcsDateUtc(end)}`,
    `SUMMARY:${escapeIcs(summary)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    `LOCATION:${escapeIcs(location)}`,
    `STATUS:${status || "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/* ── shared bits ──────────────────────────────────────────────────── */

/** loadCaptain returns this literal when a viewing has no captain and the
    property has none either. It is a sentinel for our code, never a name to
    show a reader: "House captain: House Captain" is what a prospect saw
    before this was handled. */
const NO_CAPTAIN = "House Captain";

function hasCaptain(captain) {
  return Boolean(captain && captain.name && captain.name !== NO_CAPTAIN);
}

function captainValue(captain) {
  if (!hasCaptain(captain)) return null;
  return captain.phone
    ? `${escape(captain.name)} &middot; ${escape(captain.phone)}`
    : escape(captain.name);
}

function slotOf(viewing) {
  return viewing.slot_start || `${viewing.viewing_date}T${viewing.viewing_time}+08:00`;
}

function propertyOf(viewing) {
  const p = viewing.properties || {};
  return {
    name: p.name || "Lazybee",
    code: p.code || "",
    address: p.address || "",
    accessCode: viewing.access_code || viewing.rooms?.access_code || p.default_access_code || null,
    security:
      viewing.security_instructions ||
      viewing.rooms?.security_instructions ||
      p.default_security_instructions ||
      null,
  };
}

function roomOf(viewing) {
  return viewing.rooms?.name || viewing.rooms?.unit_code || null;
}

/** A quiet line under the details for the address, so the reader can tap
    through to a map instead of retyping a postal code. */
function addressValue(address) {
  if (!address) return null;
  return `${escape(address)}<br><a href="${escape(mapsUrl(address))}" style="font-family:${F.mono};font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:${T.accentText};text-decoration:none;border-bottom:1px solid ${T.line}">Open in maps</a>`;
}

/* ── prospect: booked ─────────────────────────────────────────────── */

export function tplConfirmation({ viewing, captain, cancelUrl }) {
  const slotIso = slotOf(viewing);
  const slotEndIso = viewing.slot_end || slotIso;
  const p = propertyOf(viewing);
  const room = roomOf(viewing) || "any available room";
  const when = fmtDateTime(slotIso);

  const details = [
    { label: "When", value: escape(when) },
    { label: "Property", value: escape(p.code ? `${p.name} (${p.code})` : p.name) },
  ];
  if (p.address) details.push({ label: "Address", value: addressValue(p.address) });
  details.push({ label: "Room", value: escape(room) });
  const cap = captainValue(captain);
  if (cap) details.push({ label: "Showing you around", value: cap });

  const html = generic({
    preheader: `${p.name} on ${when}`,
    badge: "Viewing confirmed",
    headline: "Your viewing is locked in.",
    greeting: `Hi ${viewing.prospect_name || "there"},`,
    paragraphs: [
      "Looking forward to showing you around. A calendar invite is attached to this email.",
      "We will send you everything you need to get in, the door code and where to meet, the day before.",
    ],
    details,
    cta: { label: "Get Directions", url: p.address ? mapsUrl(p.address) : `${PUBLIC_SITE_URL}/book` },
    ctaCaption: "Door code follows the day before",
    secondary: { label: "Cancel this viewing", url: cancelUrl },
  });

  const ics = buildIcs({
    uid: viewing.id,
    start: slotIso,
    end: slotEndIso,
    summary: `Lazybee viewing, ${p.name}`,
    description: `Lazybee room viewing.\nProperty: ${p.name}\nRoom: ${room}${
      hasCaptain(captain) ? `\nShowing you around: ${captain.name}${captain.phone ? " " + captain.phone : ""}` : ""
    }\n\nCancel: ${cancelUrl}`,
    location: p.address || p.name,
    status: "CONFIRMED",
  });

  return {
    subject: `Viewing confirmed, ${p.name} on ${when}`,
    html,
    attachments: [
      {
        filename: "viewing.ics",
        content: b64(ics),
        content_type: "text/calendar; charset=utf-8; method=REQUEST",
      },
    ],
  };
}

/* ── prospect: the day before ─────────────────────────────────────── */

export function tplReminder24h({ viewing, captain, cancelUrl }) {
  const slotIso = slotOf(viewing);
  const p = propertyOf(viewing);
  const when = fmtDateTime(slotIso);

  const details = [
    { label: "When", value: escape(when) },
    { label: "Property", value: escape(p.name) },
  ];
  if (p.address) details.push({ label: "Address", value: addressValue(p.address) });
  details.push({
    label: "Door code",
    value: p.accessCode
      ? `<span style="font-family:${F.mono};font-size:15px;letter-spacing:.12em;color:${T.ink}">${escape(p.accessCode)}</span>`
      : "WhatsApp us when you arrive and we will let you in",
  });
  const cap = captainValue(captain);
  details.push({
    label: "Meeting you",
    value: cap || "Nobody needs to let you in, the code above is enough",
  });
  if (p.security) details.push({ label: "Finding the door", value: escape(p.security) });

  const html = generic({
    preheader: `${p.name} on ${when}, door code and meeting point inside`,
    badge: "Tomorrow",
    headline: "Your viewing is tomorrow.",
    greeting: `Hi ${viewing.prospect_name || "there"},`,
    paragraphs: ["Everything you need to get in is below. See you there."],
    details,
    cta: { label: "Get Directions", url: p.address ? mapsUrl(p.address) : `${PUBLIC_SITE_URL}/book` },
    ctaCaption: "Running late? WhatsApp us, we will wait",
    secondary: { label: "Cancel this viewing", url: cancelUrl },
  });

  return { subject: `Tomorrow: your viewing at ${p.name}`, html };
}

/* ── moved ────────────────────────────────────────────────────────── */

/**
 * A viewing that moved.
 *
 * Sent to the prospect with a fresh invite so their calendar follows, and to
 * the captain and the ops inbox, because a captain who turns up on the old
 * Saturday is exactly the failure this is meant to prevent. Says the old time
 * as well as the new one: "your viewing is confirmed" with no reference to what
 * it used to be reads like a duplicate booking.
 */
export function tplRescheduled({ viewing, captain, cancelUrl, previousStart, recipientType = "prospect" }) {
  const slotIso = slotOf(viewing);
  const slotEndIso = viewing.slot_end || slotIso;
  const p = propertyOf(viewing);
  const room = roomOf(viewing) || "any available room";
  const when = fmtDateTime(slotIso);
  const was = previousStart ? fmtDateTime(previousStart) : null;

  const details = [
    { label: "New time", value: escape(when) },
    ...(was ? [{ label: "Was", value: `<s>${escape(was)}</s>` }] : []),
    { label: "Property", value: escape(p.code ? `${p.name} (${p.code})` : p.name) },
  ];
  if (p.address) details.push({ label: "Address", value: addressValue(p.address) });
  details.push({ label: "Room", value: escape(room) });

  if (recipientType === "prospect") {
    const cap = captainValue(captain);
    if (cap) details.push({ label: "Showing you around", value: cap });

    const html = generic({
      preheader: `Moved to ${when} at ${p.name}`,
      badge: "Viewing moved",
      headline: "Your viewing has moved.",
      greeting: `Hi ${viewing.prospect_name || "there"},`,
      paragraphs: [
        "All sorted. Your new time is below and a fresh calendar invite is attached, so you can delete the old one.",
        "We will send the door code and where to meet the day before, as usual.",
      ],
      details,
      cta: { label: "Get Directions", url: p.address ? mapsUrl(p.address) : `${PUBLIC_SITE_URL}/book` },
      ctaCaption: "Need to change it again? Use the link below",
      secondary: { label: "Change or cancel this viewing", url: cancelUrl },
    });

    const ics = buildIcs({
      uid: viewing.id,
      start: slotIso,
      end: slotEndIso,
      summary: `Lazybee viewing, ${p.name}`,
      description: `Lazybee room viewing.\nProperty: ${p.name}\nRoom: ${room}\n\nChange or cancel: ${cancelUrl}`,
      location: p.address || p.name,
      status: "CONFIRMED",
    });

    return {
      subject: `Moved: your viewing is now ${when}`,
      html,
      attachments: [
        {
          filename: "viewing.ics",
          content: b64(ics),
          content_type: "text/calendar; charset=utf-8; method=REQUEST",
        },
      ],
    };
  }

  const forCaptain = recipientType === "captain";
  details.push({ label: "Prospect", value: escape(viewing.prospect_name || "Not given") });
  if (!forCaptain) {
    details.push({
      label: "Contact",
      value: escape(`${viewing.prospect_email || "No email"} / ${viewing.prospect_phone || "No phone"}`),
    });
  }

  return {
    subject: `Viewing moved: ${viewing.prospect_name} is now ${when}`,
    html: generic({
      preheader: `${viewing.prospect_name} moved to ${when}`,
      badge: "Viewing moved",
      headline: forCaptain ? "A viewing at your place moved." : "A viewing moved.",
      paragraphs: [
        forCaptain
          ? "The prospect changed the time themselves. The new slot is below. Nothing else for you to do."
          : "The prospect moved this themselves through the link in their email.",
      ],
      details,
      cta: {
        label: forCaptain ? "Open Portal" : "View in Admin",
        url: forCaptain
          ? `${PUBLIC_SITE_URL}/portal/viewings`
          : `${PUBLIC_SITE_URL}/portal/admin/viewings`,
      },
    }),
  };
}

/* ── prospect: cancelled ──────────────────────────────────────────── */

/* No cancelUrl here on purpose: offering "cancel this viewing" inside the mail
   telling you it is already cancelled is the kind of detail that makes people
   trust the rest of it less. The prospect gets a rebook link instead. */
export function tplCancelled({ viewing, recipientType }) {
  const slotIso = slotOf(viewing);
  const slotEndIso = viewing.slot_end || slotIso;
  const p = propertyOf(viewing);
  const room = roomOf(viewing) || "(flexible)";
  const when = fmtDateTime(slotIso);

  let opts;
  if (recipientType === "prospect") {
    opts = {
      badge: "Viewing cancelled",
      headline: "That viewing is cancelled.",
      greeting: `Hi ${viewing.prospect_name || "there"},`,
      paragraphs: ["No problem at all. Whenever you are ready, the calendar is open and you can pick a new slot."],
      details: [
        { label: "Was", value: escape(when) },
        { label: "Property", value: escape(p.name) },
      ],
      cta: { label: "Book a New Slot", url: `${PUBLIC_SITE_URL}/book` },
      ctaCaption: "Takes under a minute",
    };
  } else if (recipientType === "captain") {
    opts = {
      badge: "Viewing cancelled",
      headline: "A viewing at your place was cancelled.",
      paragraphs: ["Nothing for you to do. The slot frees itself up."],
      details: [
        { label: "Was", value: escape(when) },
        { label: "Property", value: escape(p.name) },
        { label: "Room", value: escape(room) },
        { label: "Prospect", value: escape(viewing.prospect_name || "Not given") },
      ],
      cta: { label: "Open Portal", url: `${PUBLIC_SITE_URL}/portal/viewings` },
    };
  } else {
    opts = {
      badge: "Viewing cancelled",
      headline: "A viewing was cancelled.",
      paragraphs: ["Logged for the record."],
      details: [
        { label: "Was", value: escape(when) },
        { label: "Property", value: escape(p.code ? `${p.name} (${p.code})` : p.name) },
        { label: "Room", value: escape(room) },
        { label: "Prospect", value: escape(viewing.prospect_name || "Not given") },
        {
          label: "Contact",
          value: escape(`${viewing.prospect_email || "No email"} / ${viewing.prospect_phone || "No phone"}`),
        },
      ],
      cta: { label: "View in Admin", url: `${PUBLIC_SITE_URL}/portal/admin/viewings` },
    };
  }

  const html = generic({ preheader: `${p.name} on ${when}`, ...opts });

  const attachments =
    recipientType === "prospect"
      ? [
          {
            filename: "viewing-cancelled.ics",
            content: b64(
              buildIcs({
                uid: viewing.id,
                start: slotIso,
                end: slotEndIso,
                summary: `Lazybee viewing, ${p.name}`,
                description: "Cancelled.",
                location: p.address || p.name,
                status: "CANCELLED",
              })
            ),
            content_type: "text/calendar; charset=utf-8; method=CANCEL",
          },
        ]
      : undefined;

  return { subject: `Viewing cancelled, ${p.name} on ${when}`, html, attachments };
}

/* ── captain and admin ────────────────────────────────────────────── */

export function tplCaptainNotify({ viewing, captainName }) {
  const slotIso = slotOf(viewing);
  const p = propertyOf(viewing);
  const room = roomOf(viewing) || "any available";
  const when = fmtDateTime(slotIso);

  const details = [
    { label: "When", value: escape(when) },
    { label: "Property", value: escape(p.name) },
    { label: "Room", value: escape(room) },
    { label: "Prospect", value: escape(viewing.prospect_name || "Not given") },
    { label: "Email", value: escape(viewing.prospect_email || "Not given") },
    { label: "Phone", value: escape(viewing.prospect_phone || "Not given") },
    { label: "Source", value: escape(viewing.source || "Not given") },
  ];
  if (viewing.special_notes) details.push({ label: "Notes", value: escape(viewing.special_notes) });

  const html = generic({
    preheader: `${viewing.prospect_name} at ${p.name} on ${when}`,
    badge: "New viewing",
    headline: "Someone booked a viewing.",
    greeting: hasCaptain({ name: captainName }) ? `Hi ${captainName},` : "Hi,",
    paragraphs: ["Please be there to let them in and show them around."],
    details,
    cta: { label: "Open Portal", url: `${PUBLIC_SITE_URL}/portal/viewings` },
  });

  return { subject: `New viewing: ${viewing.prospect_name} at ${p.name}, ${when}`, html };
}

export function tplAdminNotify({ viewing }) {
  const slotIso = slotOf(viewing);
  const p = propertyOf(viewing);
  const room = roomOf(viewing) || "(flexible)";
  const when = fmtDateTime(slotIso);

  const html = generic({
    preheader: `${viewing.prospect_name} at ${p.name} on ${when}`,
    badge: "Viewing booked",
    headline: "A viewing came in.",
    paragraphs: ["Booked through the site. No action needed unless something looks wrong."],
    details: [
      { label: "When", value: escape(when) },
      { label: "Property", value: escape(p.code ? `${p.name} (${p.code})` : p.name) },
      { label: "Room", value: escape(room) },
      { label: "Prospect", value: escape(viewing.prospect_name || "Not given") },
      {
        label: "Contact",
        value: escape(`${viewing.prospect_email || "No email"} / ${viewing.prospect_phone || "No phone"}`),
      },
      { label: "Source", value: escape(viewing.source || "Not given") },
    ],
    cta: { label: "View in Admin", url: `${PUBLIC_SITE_URL}/portal/admin/viewings` },
  });

  return { subject: `[Lazybee] Viewing: ${viewing.prospect_name} at ${p.code || p.name}, ${when}`, html };
}

/* ── lead: booked too far out to show a slot ──────────────────────── */

export function tplOffHorizonReminder(lead) {
  const property = (lead.property_interest && lead.property_interest[0]) || "Lazybee";
  const targetDate = lead.intent?.target_move_in_date || "your move-in window";

  const html = generic({
    preheader: `Viewing slots are open at ${property}`,
    badge: "Slots open",
    headline: "Ready to come and see it?",
    greeting: `Hi ${lead.name || "there"},`,
    paragraphs: [
      `You mentioned moving in around <strong>${escape(targetDate)}</strong>. We have viewing slots open at <strong>${escape(property)}</strong> over the next two weekends.`,
      "Happy to answer anything before you come down. Just reply to this email.",
    ],
    cta: { label: "Book a Viewing", url: `${PUBLIC_SITE_URL}/book` },
    ctaCaption: "Weekends, 10am to 2pm",
  });

  return { subject: `Slots are open at ${property}`, html };
}
