# Staff desk booking link, design

Date: 25 Sep 2026. Approved in chat by Mark (option 1 plus My bookings).
Supersedes `docs/superpowers/plans/2026-09-24-staff-desk-booking-request.md` (enquiry-then-approve).

## What it does

Anyone holding a room desk PIN at lazybee.sg/staff (Amber, Awehome, Good Life, WelcomeStay, Mark, captains) can book a room for a student from the room card. They enter the student's name, email, phone, nationality, move-in date and months. The server returns a one-time sign-up link on the spot. The consultant copies it or shares it straight to WhatsApp. The student opens the link and goes through the tenant onboarding that already exists: sign-up, personal details, ID and pass, tenancy agreement, deposit.

A "My bookings" tab on the desk lists every booking made with that PIN and how far each student has got: link sent, signed up, details in, ID in, agreement signed, deposit paid, or link expired. A consultant can copy an unclaimed link again from there.

## Decisions

- **Instant link, room committed on deposit.** No approval step. Mark and Kavi get an email for every desk booking and can cancel it from the admin onboarding page as today. Overlapping bookings are allowed (Rule 17). Whoever pays the deposit first gets the room.
- **Attribution.** The booking carries the PIN's channel. A PIN with no channel (Mark, captains) books as `direct`. Commission is unchanged: paid after the deposit, as agreed with partners.
- **Price.** The server quotes the room for that channel and stay length with the same `quoteFor` the Partner API uses, and stores the monthly rate and deposit on the booking and on `onboarding_progress.deposit_amount`. The browser never sends a price.
- **Link life.** 7 days, the same as an admin invite. An expired link shows as "expired" in My bookings. Mark reissues from admin.
- **Scope of My bookings.** Per PIN, not per channel. Amber uses one shared team PIN, so the whole team sees the whole list.

## Data

- `booking_requests` gains `source` (`api` or `desk`, default `api`), `staff_pin`, `tenant_profile_id`, `quoted_monthly`, `quoted_deposit`. One table for every partner booking, so Mark reads one list.
- The link is the existing `tenant_profiles.invite_token` flow (`/portal/signup?token=`). `tenant_details` is prefilled with the student's name, email, phone and nationality. `onboarding_progress` is created with the tenancy dates, `licence_period`, and deposit.
- `room_calendar` gets an `ENQUIRY` row that does not block, as Partner API requests do today.
- New RPC `desk_bookings_for_pin(p_pin)`, security definer, returns only rows made with that PIN. It includes the student name, because the consultant typed it. It returns the invite URL only while the link is unclaimed and unexpired.

## Where the code lives

The Vercel project is at the 12-function cap, so the server route is `POST /api/booking/desk-book` inside the existing catch-all. Validation and stage logic are pure functions in `src/lib/deskBooking.js` with `node:test` tests. UI: `BookRoomForm.jsx` inside `RoomCard`, `MyBookings.jsx` as a second tab on the desk page, EN and ZH strings.

## Out of scope

Payments changes, confirming a tenancy (unchanged), consultant-side cancel, book.lazybee.sg, and the Partner API.
