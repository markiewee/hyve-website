import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";
import DeviceStatusCard from "../../components/portal/DeviceStatusCard";
import { useLatestEnergyReadings } from "../../hooks/useEnergyReadings";

const ONLINE_THRESHOLD_MINUTES = 20;

export default function AdminDevicesPage() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const { readings: energyReadings } = useLatestEnergyReadings();

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

  const onlineThreshold = new Date(Date.now() - ONLINE_THRESHOLD_MINUTES * 60 * 1000);
  const onlineCount = devices.filter(
    (d) => d.last_heartbeat && new Date(d.last_heartbeat) > onlineThreshold
  ).length;
  const offlineCount = devices.length - onlineCount;

  return (
    <PortalLayout>
      {/* Page header */}
      <div className="mb-10">
        <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a] tracking-tight">
          IoT Devices & Energy
        </h1>
        <p className="text-[#6c7a77] font-['Manrope'] font-medium mt-1">
          Monitor AC controllers, energy sensors, and smart devices across all properties.
        </p>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-10">
        <div className="bg-white rounded-2xl p-6 border border-[#bbcac6]/15 shadow-sm">
          <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-3">
            Total Devices
          </p>
          {loading ? (
            <div className="h-8 w-12 bg-[#eff4ff] animate-pulse rounded" />
          ) : (
            <p className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a]">
              {devices.length}
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 border border-[#bbcac6]/15 shadow-sm">
          <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-3">
            Online
          </p>
          {loading ? (
            <div className="h-8 w-12 bg-[#eff4ff] animate-pulse rounded" />
          ) : (
            <p className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#006b5f]">
              {onlineCount}
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 border border-[#bbcac6]/15 shadow-sm">
          <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-3">
            Offline
          </p>
          {loading ? (
            <div className="h-8 w-12 bg-[#eff4ff] animate-pulse rounded" />
          ) : (
            <p className={`font-['Plus_Jakarta_Sans'] text-3xl font-extrabold ${offlineCount > 0 ? "text-[#ba1a1a]" : "text-[#121c2a]"}`}>
              {offlineCount}
            </p>
          )}
        </div>

        <div className="bg-[#006b5f] rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -mr-10 -mt-10 pointer-events-none" />
          <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#71f8e4]/80 font-bold mb-3">
            Online Rate
          </p>
          {loading ? (
            <div className="h-8 w-12 bg-white/10 animate-pulse rounded" />
          ) : (
            <p className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-white">
              {devices.length > 0 ? Math.round((onlineCount / devices.length) * 100) : 0}%
            </p>
          )}
        </div>
      </div>

      {/* Device cards */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-6 border border-[#bbcac6]/15 shadow-sm space-y-4"
            >
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className="h-4 w-28 bg-[#eff4ff] animate-pulse rounded" />
                  <div className="h-3 w-20 bg-[#eff4ff] animate-pulse rounded" />
                </div>
                <div className="h-6 w-16 bg-[#eff4ff] animate-pulse rounded-full" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-full bg-[#eff4ff] animate-pulse rounded" />
                <div className="h-3 w-3/4 bg-[#eff4ff] animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : devices.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-[#bbcac6]/15 shadow-sm flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-[#eff4ff] rounded-2xl flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[#006b5f] text-[32px]">router</span>
          </div>
          <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a] text-lg mb-2">
            No devices registered
          </h3>
          <p className="text-[#6c7a77] font-['Manrope'] text-sm">
            IoT devices will appear here once they are configured and connected.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {devices.map((device) => (
            <DeviceStatusCard key={device.id} device={device} energyReading={energyReadings[device.room_id]} />
          ))}
        </div>
      )}
    </PortalLayout>
  );
}
