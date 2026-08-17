## What was wrong

Mark asked for two things: a confirmation when someone books a viewing, and an email the day before telling them where to go. Both were already built. One of them had been silently dead for a month.

**The day-before email has not sent since 17 July 2026.** `property_viewings.reminder_24h_sent_at` was last stamped on 17 Jul. Wei Wee's viewing on 15 Aug had a real email address, sat squarely inside the sweep window, and she was told nothing.

The sender was never the problem. Firing `viewing-reminder-24h` by hand returns `{"sent":true,"to":"...","cc":"admin@meetmillia.com"}` and the mail arrives. The trigger was the problem. It was a Vercel cron on `/api/booking/cron`, and Vercel crons hit the **deployment** URL. This project's `ssoProtection.deploymentType` is `prod_deployment_urls_and_all_previews`, so `https://hyve-website-<hash>.vercel.app/api/booking/cron` now answers `302` to `vercel.com/sso-api`. The handler simply stopped being reachable.

Nothing looked broken from any angle a person would check: the route is healthy on the public domain (`https://www.lazybee.sg/api/booking/cron` returns `403` from its own auth gate, which is correct), the cron is registered and enabled in Vercel, and the only signal of failure was an email that failed to arrive.

**Every prospect-facing email was still on the pre-redesign layout.** Mark spotted this from the confirmation he received. There were two email design systems in the repo. `_shared/emailShell.js` is design system v1.0, the alabaster ground with brass rules, Cormorant Garamond, Inter Tight and JetBrains Mono, and only `notify-tenant` imported it. `viewing-notify` carried its own private `shell()` with a `#006b5f` teal header and a system sans stack, and all eight prospect and lead templates hung off it. The email redesign in #91 rebuilt the tenant lifecycle mail and never touched the viewing side, so the first email a prospect ever received from us was a design generation behind the contract they would later sign.

Two smaller defects fell out of the same read:

- The confirmation promised "a reminder 24 hours and 2 hours before". No 2h reminder exists in code, only an unused `reminder_2h_sent_at` column. We were promising a send that never happens.
- `captain_id` is null on every viewing on the books, so the confirmation printed the literal sentinel: `House captain: House Captain`. Edward Jeremy Lo (IH) and Sophia (TG) are both active `HOUSE_CAPTAIN` rows with `property_id` set.

## What this does

**Moves the sweep to a scheduler that can reach us.** `fn_viewing_reminder_sweep()` plus pg_cron job `viewing-reminder-24h` on hyve-iot, the same scheduler that already runs rent, late fees and the partner worker without missing. Same 12 to 36 hour window as before, and the edge function still owns stamping `reminder_24h_sent_at`, so a send that fails is retried on the next run rather than being marked done. Removed from the Vercel handler rather than left in both places, because two schedulers racing on the same flag would double-send to a prospect.

**One email design system.** The six templates move out of `viewing-notify/index.ts` into `_shared/viewingEmails.js` and render through the same shell as the tenant mail. The function drops from 661 lines to 305. Because the templates no longer touch Deno, a Supabase client or a network, `node --test` renders every one of them: 14 tests that fail the moment a template falls back off the design system, the sentinel captain name leaks into copy, the door code goes missing, or an em-dash appears in a subject line. The legacy V1 captain notify was a fourth hand-rolled copy of the same email and now calls the shared template, so a copy change cannot miss it.

**Copy and data fixes.** The confirmation stops promising the 2h reminder and promises the day-before mail instead, which is the one that actually sends. `loadCaptain` falls back to the property's active house captain when the booking did not name one, so prospects get "Edward Jeremy Lo, +65 83654765" rather than a placeholder. Chiltern Park genuinely has no captain and that stays a real answer: those emails read as self-serve on the door code rather than naming a phantom. Both prospect emails gained an "Open in maps" link on the address, because standing at the wrong block is the failure mode this product actually has.

## Verification

- 14 new template tests plus the 13 existing `emailShell` tests pass.
- Migration applied to production: job 19 registered and active on `0 12 * * *`.
- `select public.fn_viewing_reminder_sweep()` returns `0` today, correct, because nothing sits in the 12 to 36 hour window on 18 Aug.
- The selection query against the 21 Aug run returns all three 22 Aug viewings (Mark x2, Stephanie). Stephanie has no email on file, so the edge function will skip her with `{"skipped":"no prospect email"}`, which is the right behaviour.
- Edge function deployed and both emails sent for real to `markwee99@gmail.com`. Resend reports both `delivered`. The day-before mail landed in the inbox with the new shell, the new subject and `cc admin@meetmillia.com`.
- Both templates rendered headless and read as images, not just asserted on: the door code, the maps link, the named captain and the guard instruction are all on the page.
- The probe's `reminder_24h_sent_at` was reset afterwards so the real 21 Aug run still fires.

## Not fixed here

- **The off-horizon lead sweep still runs on that same unreachable Vercel cron.** Zero lead reminders have fired since 17 Jul either. Same fix, separate change.
- No 2h reminder is built. The copy stops promising it; `reminder_2h_sent_at` stays unused.
- Nothing alerts when a queued `pg_net` request comes back non-200, here or on the TA_READY trigger from #101. A second silent failure of this shape would look exactly like the first.
- `20260823000000_notify_ta_ready_trigger.sql` hardcodes the anon key. It should read the vault the way this sweep does.
- Abigail's 29 Aug viewing has `abigailzoewu@gmail.co`, missing the `m`. Her confirmation bounced and her reminder will too. Data fix, not code.
- Two pre-existing lint errors in `_shared/emailShell.test.js` are left alone to keep this diff to one subject.
