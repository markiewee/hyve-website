# PRD: pass compliance, both sides and a stale-pass prompt

**Date:** 18 Aug 2026
**Asked for by:** Mark
**Status:** built, PR open

## The ask

> "If they upload a pass, they need to upload front and back for the pass. By default, any other document apart from passports are their front and back. Make that in the onboarding flow. And when they are already inside the portal, if the pass is out of date, the first thing they should do is update pass. It should show very, very big."

## Why it matters now

We are required to hold a valid immigration pass for every foreign resident. What we actually hold, as of today:

- **15 active tenants have a pass type on file.** Every one of them has, at most, a photo of the **front** of the card. `tenant_details` has `id_front_url` and `id_back_url` for the NRIC but only a single `pass_url` for the pass, so the back was never asked for. The back is the side carrying the employer or school and the pass details.
- **One tenant has been living here on an expired pass since 13 Aug 2026.** Nothing in the product told her, and nothing told us.
- **Two tenants have a pass type with no expiry date at all**, so we cannot say whether their pass is valid.
- **One tenant has an expiry date but no pass image.**
- Two more expire on 18 Sep, inside the renewal lead time.

There was also no route for an existing tenant to update a pass. `IdScanForm` is mounted only inside onboarding, so once someone finished onboarding, the product had no way for them to hand us a renewed pass.

## Decisions

**Which documents have two sides.** Passport is a single photo page. IPA is a letter. Everything else is a card and needs both sides: NRIC, Work Permit, Employment Pass, S Pass, Student Pass, Dependant Pass, LTVP. A pass type we have not seen before is treated as a card, because an unknown type is far likelier to be a card than a letter and the cost of asking is one photo, whereas the cost of not asking is finding out at an audit.

**How hard the portal pushes back.** Big and unmissable, not blocking. The expired banner sits above the content on **every** portal page, not just the dashboard, because someone opening `/portal/billing` to pay rent would otherwise never see it, and it cannot be dismissed. It does not lock the portal: a tenant who cannot renew today still needs to pay rent and still needs to report a burst pipe, and blocking both to chase a document creates a worse problem than the one it solves.

**Three states, not two.** Expired and undated both earn the red treatment, since a pass type with no date tells us nothing about validity. Inside 30 days is amber, 30 being roughly the lead time on an MOM or ICA renewal appointment: warning earlier is noise, warning later is too late to act on.

**A dedicated renewal page rather than reusing onboarding.** `/portal/pass` asks only for what changed. Someone whose Student Pass ran out has not changed nationality and does not need to re-photograph their passport, and walking them back through residency, passport and OCR is how you get people abandoning halfway.

## What was built

| Piece | File |
|---|---|
| The rules, with 20 tests | `src/lib/idDocuments.js` |
| `pass_back_url` column | `supabase/migrations/20260825000000_pass_back_image.sql` |
| Front and back in onboarding | `src/components/portal/IdScanForm.jsx` |
| The banner | `src/components/portal/PassExpiryBanner.jsx`, mounted in `PortalLayout` |
| The renewal page | `src/pages/portal/PassUpdatePage.jsx`, route `/portal/pass` |
| Both sides visible to admin, plus a "back of pass missing" marker | `src/pages/portal/AdminOnboardingDetailPage.jsx` |

An upload files an admin task, because otherwise the tenant does their part and the document sits unchecked in a bucket. The renewal page rejects an expiry date that has already passed rather than letting an admin discover it later.

## Deliberately out of scope

- **Backfilling the missing backs.** 15 tenants need to be asked for the back of a card we already hold the front of. That is an outreach job, not a code change, and the marker in the admin view is what makes the list visible.
- **Chasing on a schedule.** Nothing emails or WhatsApps a tenant whose pass is expiring. The banner only works on someone who opens the portal. A cron on `pass_expiry` is the obvious next step and is not in this change.
- **Passport expiry.** The same staleness problem applies to passports and is not addressed here.
- **The `pass_url` name.** It means "front" now, and says so in a column comment. Renaming it buys tidiness at the cost of a migration that can half-apply across three call sites and every row on file.
