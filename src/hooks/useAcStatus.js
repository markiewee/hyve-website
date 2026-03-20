import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useAcStatus(roomId) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) {
      setLoading(false);
      return;
    }

    // Fetch latest ac_event for the room
    supabase
      .from("ac_events")
      .select("state, timestamp")
      .eq("room_id", roomId)
      .order("timestamp", { ascending: false })
      .limit(1)
      .single()
      .then(({ data, error }) => {
        if (error && error.code !== "PGRST116") {
          console.error("Error fetching AC status:", error);
        }
        setStatus(data ? data.state : null);
        setLoading(false);
      });

    // Subscribe to realtime INSERT events for this room
    const channel = supabase
      .channel(`ac_events_room_${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ac_events",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          setStatus(payload.new.state);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  return { status, loading };
}
