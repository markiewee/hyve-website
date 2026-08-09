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

/**
 * Property Overview.
 *  - ADMIN role: fetches ALL properties + lettable rooms, grouped by property.
 *  - HOUSE_CAPTAIN / TENANT: scoped to their own property only.
 */
export default function PropertyOverviewPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "ADMIN";
  const ownPropertyId = profile?.property_id ?? profile?.rooms?.property_id;

  const [groups, setGroups] = useState([]); // [{ property: {id,name,code}, rooms: [...] }]
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin && !ownPropertyId) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      // Fetch properties (all for admin, scoped for everyone else)
      let propsQ = supabase.from("properties").select("id, name, code").order("name");
      if (!isAdmin) propsQ = propsQ.eq("id", ownPropertyId);
      const { data: props, error: propsErr } = await propsQ;
      if (propsErr) {
        console.error("Properties query failed:", propsErr);
        setLoading(false);
        return;
      }

      if (!props || props.length === 0) {
        setGroups([]);
        setLoading(false);
        return;
      }
      const propertyIds = props.map((p) => p.id);

      // Lettable bedrooms only — skip common areas / kitchens / yards / toilets
      const { data: roomData, error: roomErr } = await supabase
        .from("rooms")
        .select("id, name, unit_code, property_id")
        .in("property_id", propertyIds)
        .not("room_type", "is", null)
        .order("unit_code");

      if (roomErr) {
        console.error("Rooms query failed:", roomErr);
        setLoading(false);
        return;
      }

      const roomIds = (roomData ?? []).map((r) => r.id);
      const { start, end } = getCurrentMonthRange();

      const [{ data: usageData }, { data: deviceData }] = await Promise.all([
        roomIds.length
          ? supabase
              .from("ac_monthly_usage")
              .select("room_id, total_hours")
              .in("room_id", roomIds)
              .gte("period_start", start)
              .lte("period_start", end)
          : { data: [] },
        roomIds.length
          ? supabase
              .from("device_status")
              .select("room_id, ac_state")
              .in("room_id", roomIds)
          : { data: [] },
      ]);

      const usageMap = {};
      (usageData ?? []).forEach((u) => { usageMap[u.room_id] = u.total_hours; });
      const deviceMap = {};
      (deviceData ?? []).forEach((d) => { deviceMap[d.room_id] = d.ac_state; });

      const enrichedRooms = (roomData ?? []).map((room) => ({
        ...room,
        totalHours: usageMap[room.id] ?? 0,
        acState: deviceMap[room.id] ?? null,
      }));

      const grouped = props.map((p) => {
        const rooms = enrichedRooms
          .filter((r) => r.property_id === p.id)
          .sort((a, b) => b.totalHours - a.totalHours);
        return { property: p, rooms };
      });

      setGroups(grouped);
      setLoading(false);
    }

    fetchData();
  }, [isAdmin, ownPropertyId]);

  const allRooms = groups.flatMap((g) => g.rooms);
  const acOnCount = allRooms.filter(
    (r) => r.acState === "on" || r.acState === "cool",
  ).length;
  const totalHoursAll = allRooms.reduce((sum, r) => sum + r.totalHours, 0);

  return (
    <PortalLayout>
      {/* Page header */}
      <div className="mb-10">
        <h1 className="font-['Hanken_Grotesk'] text-3xl font-extrabold text-foreground tracking-tight">
          Property Overview
        </h1>
        <p className="text-foreground-variant font-['Inter'] font-medium mt-1">
          {isAdmin
            ? `${groups.length} ${groups.length === 1 ? "property" : "properties"}`
            : groups[0]?.property?.name || ""}
        </p>
      </div>

      {/* Stat cards */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-10">
          <div className="bg-surface rounded-2xl p-6 border border-border">
            <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold mb-3">Total Rooms</p>
            <p className="font-['Hanken_Grotesk'] text-3xl font-extrabold text-foreground">{allRooms.length}</p>
          </div>
          <div className="bg-surface rounded-2xl p-6 border border-border">
            <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold mb-3">AC Running</p>
            <p className="font-['Hanken_Grotesk'] text-3xl font-extrabold text-blue-300">{acOnCount}</p>
          </div>
          <div className="bg-accent rounded-2xl p-6">
            <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-white/80 font-bold mb-3">Total AC Hours</p>
            <p className="font-['Hanken_Grotesk'] text-3xl font-extrabold text-white">
              {totalHoursAll.toFixed(0)}
              <span className="text-base font-['Inter'] font-normal text-white/70 ml-1">h</span>
            </p>
          </div>
          <div className="bg-red-500/10 rounded-2xl p-6 border border-red-500/25">
            <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-red-300 font-bold mb-3">Alerts</p>
            <p className="font-['Hanken_Grotesk'] text-3xl font-extrabold text-foreground">0</p>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-surface rounded-2xl p-5 border border-border space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className="h-5 w-32 bg-white/5 animate-pulse rounded" />
                  <div className="h-3 w-20 bg-white/5 animate-pulse rounded" />
                </div>
                <div className="h-6 w-12 bg-white/5 animate-pulse rounded" />
              </div>
              <div className="h-1.5 w-full bg-white/5 animate-pulse rounded-full" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && groups.length === 0 && (
        <div className="bg-surface rounded-2xl p-12 border border-border text-center">
          <p className="text-foreground-variant font-['Inter'] text-sm">No properties found.</p>
        </div>
      )}

      {/* Grouped by property */}
      {!loading && groups.length > 0 && (
        <div className="space-y-10">
          {groups.map((g) => (
            <section key={g.property.id}>
              <div className="flex items-baseline justify-between mb-4 border-b border-border pb-2">
                <h2 className="font-['Hanken_Grotesk'] text-xl font-extrabold text-foreground tracking-tight">
                  {g.property.name}
                  {g.property.code && (
                    <span className="ml-2 align-middle text-xs font-['Inter'] font-bold bg-white/5 text-accent px-2 py-0.5 rounded">
                      {g.property.code}
                    </span>
                  )}
                </h2>
                <span className="font-['Inter'] text-xs text-foreground-variant font-medium">
                  {g.rooms.length} room{g.rooms.length === 1 ? "" : "s"}
                </span>
              </div>

              {g.rooms.length === 0 ? (
                <p className="text-sm text-foreground-variant font-['Inter']">No rooms.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {g.rooms.map((room) => {
                    const acOn = room.acState === "on" || room.acState === "cool";
                    return (
                      <div
                        key={room.id}
                        className="bg-surface rounded-2xl p-5 border border-border hover:border-accent/30 transition-all group"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="font-['Hanken_Grotesk'] font-bold text-lg text-foreground group-hover:text-accent transition-colors">
                              {room.name}
                            </h4>
                            <span className="font-['Inter'] text-xs font-bold bg-white/5 text-accent px-2 py-0.5 rounded">
                              {room.unit_code}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className={`material-symbols-outlined text-[22px] ${acOn ? "text-blue-300" : "text-foreground-variant"}`}>
                              ac_unit
                            </span>
                            <p className={`text-[10px] font-bold ${acOn ? "text-blue-300" : "text-foreground-variant"}`}>
                              {acOn ? "ON" : "OFF"}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <AcStatusIndicator status={room.acState} />
                          <UsageProgressBar totalHours={room.totalHours} />
                          <div className="flex justify-between text-xs font-['Inter']">
                            <span className="text-foreground-variant">Monthly Usage</span>
                            <span className="font-bold text-foreground">{room.totalHours.toFixed(1)}h</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </PortalLayout>
  );
}
