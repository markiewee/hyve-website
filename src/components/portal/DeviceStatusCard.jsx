const ONLINE_THRESHOLD_MINUTES = 20;

function isOnline(lastHeartbeat) {
  if (!lastHeartbeat) return false;
  const thresholdMs = ONLINE_THRESHOLD_MINUTES * 60 * 1000;
  return Date.now() - new Date(lastHeartbeat).getTime() < thresholdMs;
}

function formatLastSeen(lastHeartbeat) {
  if (!lastHeartbeat) return "Never";
  const date = new Date(lastHeartbeat);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString("en-SG", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function wifiSignalLabel(rssi) {
  if (rssi == null) return null;
  if (rssi >= -55) return { label: "Excellent", class: "text-green-600" };
  if (rssi >= -70) return { label: "Good", class: "text-green-500" };
  if (rssi >= -80) return { label: "Fair", class: "text-yellow-600" };
  return { label: "Weak", class: "text-red-600" };
}

export default function DeviceStatusCard({ device, energyReading }) {
  const { rooms, ac_state, last_heartbeat, wifi_rssi } = device;
  const unitCode = rooms?.unit_code ?? "—";
  const roomName = rooms?.name ?? "—";
  const propertyName = rooms?.properties?.name ?? "";
  const online = isOnline(last_heartbeat);
  const wifi = wifiSignalLabel(wifi_rssi);

  const current = energyReading?.current_amps;
  const power = energyReading?.power_watts;
  const voltage = energyReading?.voltage;
  const energy = energyReading?.energy_kwh;
  const hasEnergy = current != null;

  return (
    <div className="bg-white rounded-2xl p-5 border border-[#bbcac6]/15 shadow-sm space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-['Inter'] text-xs font-bold bg-[#eff4ff] text-[#006b5f] px-2 py-0.5 rounded">
              {unitCode}
            </span>
            <span className="text-sm font-['Manrope'] font-bold text-[#121c2a]">{roomName}</span>
          </div>
          {propertyName && (
            <p className="text-xs text-[#6c7a77] font-['Manrope'] mt-0.5">{propertyName}</p>
          )}
        </div>

        {/* Online/Offline badge */}
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
            online
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              online ? "bg-green-500 animate-pulse" : "bg-red-400"
            }`}
          />
          {online ? "Online" : "Offline"}
        </span>
      </div>

      {/* Energy readings — show if available */}
      {hasEnergy && (
        <div className="grid grid-cols-4 gap-2 bg-[#f8f9ff] rounded-xl p-3">
          <div className="text-center">
            <p className="font-['Plus_Jakarta_Sans'] text-lg font-bold text-[#121c2a]">{Number(current).toFixed(1)}</p>
            <p className="text-[10px] text-[#6c7a77] font-['Inter'] uppercase tracking-wider">Amps</p>
          </div>
          <div className="text-center">
            <p className="font-['Plus_Jakarta_Sans'] text-lg font-bold text-[#121c2a]">{Math.round(Number(power || 0))}</p>
            <p className="text-[10px] text-[#6c7a77] font-['Inter'] uppercase tracking-wider">Watts</p>
          </div>
          <div className="text-center">
            <p className="font-['Plus_Jakarta_Sans'] text-lg font-bold text-[#121c2a]">{Math.round(Number(voltage || 0))}</p>
            <p className="text-[10px] text-[#6c7a77] font-['Inter'] uppercase tracking-wider">Volts</p>
          </div>
          <div className="text-center">
            <p className="font-['Plus_Jakarta_Sans'] text-lg font-bold text-[#006b5f]">{Number(energy || 0).toFixed(1)}</p>
            <p className="text-[10px] text-[#6c7a77] font-['Inter'] uppercase tracking-wider">kWh</p>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {/* AC state */}
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold ${
            ac_state === "ON"
              ? "bg-green-50 text-green-700"
              : "bg-[#eff4ff] text-[#6c7a77]"
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">ac_unit</span>
          AC {ac_state ?? "—"}
        </span>

        {/* WiFi signal */}
        {wifi && (
          <span className={`font-['Inter'] font-semibold ${wifi.class}`}>
            WiFi: {wifi.label}
          </span>
        )}

        {/* Last seen */}
        <span className="text-[#6c7a77] font-['Inter'] ml-auto">
          {formatLastSeen(last_heartbeat)}
        </span>
      </div>
    </div>
  );
}
