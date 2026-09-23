// src/lib/roomAvailability.js
//
// Folds the live next-free dates from hyve-iot's get_room_availability() RPC
// into the static room records. Pure, so it is testable without a network.
//
// The static `next` stays whenever the live answer is unusable: a room the RPC
// did not return, a null date (occupied with no agreed end), or anything that
// is not a YYYY-MM-DD string. A failed call therefore changes nothing.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function mergeAvailability(rooms, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rooms;
  const live = new Map();
  for (const row of rows) {
    if (row && typeof row.unit_code === 'string' && typeof row.next_available === 'string'
        && ISO_DATE.test(row.next_available)) {
      live.set(row.unit_code, row.next_available);
    }
  }
  if (live.size === 0) return rooms;
  return rooms.map((room) => {
    const next = live.get(room.code);
    return next && next !== room.next ? { ...room, next } : room;
  });
}
