---
title: We rebuilt availability on one query
date: 2026-06-18
excerpt: >
  For a long time the booking site read a stored column and the calendar worked it
  out from the bookings, and the two quietly disagreed. Nineteen rooms is small
  enough to catch that by hand, which is exactly why it went on so long.
tags: [Building, Operations]
author: Mark Wee
hero: /photos/cp/Common-1.jpg
heroAlt: The common area at Chiltern Park
---

There is a particular kind of bug that does not crash anything. Nothing goes red, no alert fires, and every page loads. It just tells two different people two different things, and you find out when one of them is standing in your living room.

Ours was availability.

## The two sources of truth

The room record carried a field for the next date the room came free. Something wrote to it when a booking was made. Somewhere else, the calendar worked the same thing out from the bookings themselves, filtering out the ones that had been cancelled or archived.

Most of the time the two agreed, which is the worst possible failure rate. If they had disagreed constantly we would have fixed it in a week. Because they agreed nearly always, we trusted the stored field, and the stored field was the one that went stale.

It went stale in the ordinary ways. A booking cancelled and the field never rolled back. A tenant extended by a month and the field never moved. A room archived on one screen and still live on another. None of it was dramatic. All of it was wrong.

## What it actually cost

Not money, directly. Time and credibility.

Someone asks about a room. We say it is free from the first. They arrange to see it. Then we look properly and it is free from the fifteenth, or it is not free at all. Now we are the operator who does not know what they have, and the person we are talking to is quietly recalculating whether we would be any better at handling their deposit.

You cannot recover that with an apology. The only fix is to stop being wrong.

## The fix

We deleted the stored field from the read path and made every screen derive availability the same way: from the bookings, live, filtered to the ones that are actually active and not archived. One function. Booking site, calendar, admin, all of it calls the same thing.

That is the entire change. It is not clever. It took a weekend, most of which was going back through the places that had quietly grown their own version of the logic.

## What we took from it

Two things.

The first is the obvious one. If a number can be derived, derive it. A cached copy of a fact is a second fact, and a second fact will eventually be a different fact. Cache when the derivation is genuinely too slow, which at nineteen rooms it never is.

The second is less obvious and more useful. Our portfolio is small enough that a person could always check by hand, and that was the trap. Every disagreement was catchable by a human who happened to look, so every disagreement got caught individually and none of them got fixed at the root. Being small does not protect you from bad data. It hides the bad data behind somebody's diligence until that person is busy.
