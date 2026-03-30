import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Fetch the latest energy reading for each room (for admin device overview).
 * Returns a map of room_id → latest reading.
 */
export function useLatestEnergyReadings() {
  const [readings, setReadings] = useState({});
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      // Get the latest reading per room using a distinct-on equivalent
      // Supabase doesn't support DISTINCT ON, so we get recent readings and dedupe client-side
      const { data, error } = await supabase
        .from('energy_readings')
        .select('room_id, current_amps, voltage, power_watts, energy_kwh, timestamp')
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) {
        // Table might not exist yet
        if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
          setReadings({});
          setLoading(false);
          return;
        }
        throw error;
      }

      // Dedupe: keep only the latest reading per room
      const map = {};
      for (const row of data ?? []) {
        if (!map[row.room_id]) {
          map[row.room_id] = row;
        }
      }
      setReadings(map);
    } catch (err) {
      console.warn('[useLatestEnergyReadings] Error:', err.message);
      setReadings({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    // Refresh every 60 seconds
    const interval = setInterval(fetch, 60000);
    return () => clearInterval(interval);
  }, [fetch]);

  return { readings, loading, refresh: fetch };
}

/**
 * Fetch energy readings for a specific room over a time period.
 * Used for per-room energy charts.
 */
export function useRoomEnergyReadings(roomId, hours = 24) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) return;

    async function fetchReadings() {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      try {
        const { data: rows, error } = await supabase
          .from('energy_readings')
          .select('current_amps, voltage, power_watts, energy_kwh, timestamp')
          .eq('room_id', roomId)
          .gte('timestamp', since)
          .order('timestamp', { ascending: true });

        if (error) {
          if (error.code === 'PGRST205') {
            setData([]);
            setLoading(false);
            return;
          }
          throw error;
        }
        setData(rows ?? []);
      } catch (err) {
        console.warn('[useRoomEnergyReadings] Error:', err.message);
        setData([]);
      } finally {
        setLoading(false);
      }
    }

    fetchReadings();
    const interval = setInterval(fetchReadings, 60000);
    return () => clearInterval(interval);
  }, [roomId, hours]);

  return { data, loading };
}
