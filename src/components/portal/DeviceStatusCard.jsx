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

export default function DeviceStatusCard({ device }) {
  const { rooms, ac_state, last_heartbeat, wifi_rssi } = device;
  const unitCode = rooms?.unit_code ?? "—";
  const roomName = rooms?.name ?? "—";
  const propertyName = rooms?.properties?.name ?? "";
  const online = isOnline(last_heartbeat);
  const wifi = wifiSignalLabel(wifi_rssi);

  return (
    <div className="border rounded-lg p-4 bg-card space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded">
              {unitCode}
            </span>
            <span className="text-sm font-medium text-foreground">{roomName}</span>
          </div>
          {propertyName && (
            <p className="text-xs text-muted-foreground mt-0.5">{propertyName}</p>
          )}
        </div>

        {/* Online/Offline badge */}
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium shrink-0 ${
            online
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              online ? "bg-green-500" : "bg-red-500"
            }`}
          />
          {online ? "Online" : "Offline"}
        </span>
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {/* AC state */}
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded font-medium ${
            ac_state === "ON"
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          AC {ac_state ?? "—"}
        </span>

        {/* WiFi signal */}
        {wifi && (
          <span className={`font-medium ${wifi.class}`}>
            WiFi: {wifi.label} ({wifi_rssi} dBm)
          </span>
        )}

        {/* Last seen */}
        <span className="text-muted-foreground ml-auto">
          Last seen: {formatLastSeen(last_heartbeat)}
        </span>
      </div>
    </div>
  );
}
