// src/lib/useRoomAvailability.js
//
// The room records with each room's next free date read live from hyve-iot.
//
// First render (and the prerendered HTML) uses the static dates in
// src/data/lazybeeRooms.js. After mount, one call to the anon RPC
// get_room_availability() replaces them. The RPC returns unit_code and
// next_available only, no tenant data. The request is shared: every component
// on the page that uses this hook waits on the same single call per page load.
// No polling. If the call fails, the static dates stay.

import { useEffect, useState } from 'react';
import { ROOMS } from '../data/lazybeeRooms';
import { mergeAvailability } from './roomAvailability';

let request = null;

function loadAvailability() {
  if (!request) {
    request = import('./supabase')
      .then(({ supabase }) => supabase.rpc('get_room_availability'))
      .then(({ data, error }) => (error ? null : data))
      .catch(() => null);
  }
  return request;
}

export function useRoomAvailability() {
  const [rooms, setRooms] = useState(ROOMS);
  useEffect(() => {
    let alive = true;
    loadAvailability().then((rows) => {
      if (alive && rows) setRooms(mergeAvailability(ROOMS, rows));
    });
    return () => { alive = false; };
  }, []);
  return rooms;
}
