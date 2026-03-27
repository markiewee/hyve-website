export default function AcStatusIndicator({ status }) {
  if (status === "ON") {
    return (
      <div className="flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
        </span>
        <span className="text-sm font-medium text-green-700">AC Running</span>
      </div>
    );
  }

  if (status === "OFF") {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex rounded-full h-3 w-3 bg-gray-400" />
        <span className="text-sm font-medium text-gray-500">AC Off</span>
      </div>
    );
  }

  // null / unknown — no recent data from sensor
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="inline-flex rounded-full h-3 w-3 bg-gray-300" />
        <span className="text-sm font-medium text-gray-400">No data</span>
      </div>
      <span className="text-xs text-gray-400">Sensor offline or not yet configured</span>
    </div>
  );
}
