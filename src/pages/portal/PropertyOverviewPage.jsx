import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";
import AcStatusIndicator from "../../components/portal/AcStatusIndicator";
import UsageProgressBar from "../../components/portal/UsageProgressBar";

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

      const { data: usageData } = await supabase
        .from("ac_monthly_usage")
        .select("room_id, total_hours")
        .in("room_id", roomIds)
        .gte("period_start", start)
        .lte("period_start", end);

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

      enriched.sort((a, b) => b.totalHours - a.totalHours);

      setRooms(enriched);
      setLoading(false);
    }

    fetchRooms();
  }, [propertyId]);

  const acOnCount = rooms.filter((r) => r.acState === "on" || r.acState === "cool").length;
  const totalHoursAll = rooms.reduce((sum, r) => sum + r.totalHours, 0);

  return (
    <PortalLayout>
      {/* Page header */}
      <div className="mb-10">
        <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a] tracking-tight">
          Property Overview
        </h1>
        {propertyName && (
          <p className="text-[#6c7a77] font-['Manrope'] font-medium mt-1">{propertyName}</p>
        )}
      </div>

      {/* Stat cards */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-10">
          <div className="bg-white rounded-2xl p-6 border border-[#bbcac6]/15 shadow-sm">
            <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-3">Total Rooms</p>
            <p className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a]">{rooms.length}</p>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-[#bbcac6]/15 shadow-sm">
            <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-3">AC Running</p>
            <p className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-blue-600">{acOnCount}</p>
          </div>
          <div className="bg-[#006b5f] rounded-2xl p-6">
            <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#71f8e4]/80 font-bold mb-3">Total AC Hours</p>
            <p className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-white">
              {totalHoursAll.toFixed(0)}
              <span className="text-base font-['Manrope'] font-normal text-white/70 ml-1">h</span>
            </p>
          </div>
          <div className="bg-[#ffdad6]/30 rounded-2xl p-6 border border-[#ba1a1a]/10">
            <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#ba1a1a] font-bold mb-3">Alerts</p>
            <p className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a]">0</p>
          </div>
        </div>
      )}

      {/* Room grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-[#bbcac6]/15 shadow-sm space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className="h-5 w-32 bg-[#eff4ff] animate-pulse rounded" />
                  <div className="h-3 w-20 bg-[#eff4ff] animate-pulse rounded" />
                </div>
                <div className="h-6 w-12 bg-[#eff4ff] animate-pulse rounded" />
              </div>
              <div className="h-1.5 w-full bg-[#eff4ff] animate-pulse rounded-full" />
            </div>
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-[#bbcac6]/15 shadow-sm text-center">
          <p className="text-[#6c7a77] font-['Manrope'] text-sm">No rooms found for this property.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map((room) => {
            const acOn = room.acState === "on" || room.acState === "cool";
            return (
              <div
                key={room.id}
                className="bg-white rounded-2xl p-5 border border-[#bbcac6]/10 hover:border-[#006b5f]/30 transition-all group shadow-sm"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#121c2a] group-hover:text-[#006b5f] transition-colors">
                      {room.name}
                    </h4>
                    <span className="font-['Inter'] text-xs font-bold bg-[#eff4ff] text-[#006b5f] px-2 py-0.5 rounded">
                      {room.unit_code}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className={`material-symbols-outlined text-[22px] ${acOn ? "text-blue-500" : "text-[#bbcac6]"}`}>
                      ac_unit
                    </span>
                    <p className={`text-[10px] font-bold ${acOn ? "text-blue-500" : "text-[#bbcac6]"}`}>
                      {acOn ? "ON" : "OFF"}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <AcStatusIndicator status={room.acState} />
                  <UsageProgressBar totalHours={room.totalHours} />
                  <div className="flex justify-between text-xs font-['Inter']">
                    <span className="text-[#6c7a77]">Monthly Usage</span>
                    <span className="font-bold text-[#121c2a]">{room.totalHours.toFixed(1)}h</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PortalLayout>
  );
}
