// src/lib/booking.js
// Single source of truth for the Booking Site 2.0 destination (book.lazybee.sg).
// Every marketing CTA that means "browse / reserve / book a room" deep-links here.
export const BOOKING_URL =
  import.meta.env.VITE_BOOKING_URL || 'https://book.lazybee.sg';

/** Build an absolute booking-site URL. `bookingUrl('/?area=lentor')` → 'https://book.lazybee.sg/?area=lentor' */
export function bookingUrl(path = '') {
  if (!path) return BOOKING_URL;
  return `${BOOKING_URL.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}
