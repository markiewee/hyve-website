import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";
import DeviceStatusCard from "../../components/portal/DeviceStatusCard";

export default function AdminDevicesPage() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDevices() {
      const { data, error } = await supabase
        .from("device_status")
        .select("*, rooms(name, unit_code, properties(name, code))")
        .order("last_heartbeat", { ascending: false });

      if (error) {
        console.error("Error fetching devices:", error);
      }
      setDevices(data ?? []);
      setLoading(false);
    }

    fetchDevices();

    // Realtime subscription for device heartbeats
    const channel = supabase
      .channel("device_status_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "device_status",
        },
        () => {
          fetchDevices();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <PortalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Devices</h1>
        {!loading && (
          <p className="text-muted-foreground text-sm mt-1">
            {devices.length} device{devices.length !== 1 ? "s" : ""} registered
          </p>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded-lg p-4 space-y-3">
              <div className="flex justify-between">
                <div className="flex gap-2">
                  <div className="h-5 w-14 bg-gray-100 animate-pulse rounded" />
                  <div className="h-5 w-24 bg-gray-100 animate-pulse rounded" />
                </div>
                <div className="h-5 w-16 bg-gray-100 animate-pulse rounded" />
              </div>
              <div className="flex gap-3">
                <div className="h-4 w-12 bg-gray-100 animate-pulse rounded" />
                <div className="h-4 w-24 bg-gray-100 animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : devices.length === 0 ? (
        <p className="text-sm text-muted-foreground">No devices registered.</p>
      ) : (
        <div className="space-y-3">
          {devices.map((device) => (
            <DeviceStatusCard key={device.id} device={device} />
          ))}
        </div>
      )}
    </PortalLayout>
  );
}
