import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";
import AcStatusIndicator from "../../components/portal/AcStatusIndicator";
import UsageProgressBar from "../../components/portal/UsageProgressBar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";

function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  return { start, end };
}

export default function PropertyOverviewPage() {
  const { profile } = useAuth();
  const propertyId = profile?.property_id ?? profile?.rooms?.property_id;
  const propertyName = profile?.properties?.name ?? "";

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!propertyId) {
      setLoading(false);
      return;
    }

    async function fetchRooms() {
      // Fetch all rooms for this property
      const { data: roomData, error: roomError } = await supabase
        .from("rooms")
        .select("id, name, unit_code")
        .eq("property_id", propertyId);

      if (roomError) {
        console.error("Error fetching rooms:", roomError);
        setLoading(false);
        return;
      }

      if (!roomData || roomData.length === 0) {
        setRooms([]);
        setLoading(false);
        return;
      }

      const roomIds = roomData.map((r) => r.id);
      const { start, end } = getCurrentMonthRange();

      // Fetch monthly AC usage for all rooms
      const { data: usageData } = await supabase
        .from("ac_monthly_usage")
        .select("room_id, total_hours")
        .in("room_id", roomIds)
        .gte("period_start", start)
        .lte("period_start", end);

      // Fetch device status for all rooms
      const { data: deviceData } = await supabase
        .from("device_status")
        .select("room_id, ac_state")
        .in("room_id", roomIds);

      const usageMap = {};
      (usageData ?? []).forEach((u) => {
        usageMap[u.room_id] = u.total_hours;
      });

      const deviceMap = {};
      (deviceData ?? []).forEach((d) => {
        deviceMap[d.room_id] = d.ac_state;
      });

      const enriched = roomData.map((room) => ({
        ...room,
        totalHours: usageMap[room.id] ?? 0,
        acState: deviceMap[room.id] ?? null,
      }));

      // Sort by usage, highest first
      enriched.sort((a, b) => b.totalHours - a.totalHours);

      setRooms(enriched);
      setLoading(false);
    }

    fetchRooms();
  }, [propertyId]);

  return (
    <PortalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Property Overview</h1>
        {propertyName && (
          <p className="text-muted-foreground text-sm mt-1">{propertyName}</p>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded-lg p-4 space-y-3">
              <div className="h-5 w-24 bg-gray-100 animate-pulse rounded" />
              <div className="h-4 w-32 bg-gray-100 animate-pulse rounded" />
              <div className="h-2 w-full bg-gray-100 animate-pulse rounded-full" />
            </div>
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <p className="text-sm text-muted-foreground">No rooms found for this property.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => (
            <Card key={room.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{room.name}</span>
                  <span className="text-xs font-mono bg-muted text-muted-foreground px-2 py-0.5 rounded">
                    {room.unit_code}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <AcStatusIndicator status={room.acState} />
                <UsageProgressBar totalHours={room.totalHours} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PortalLayout>
  );
}
