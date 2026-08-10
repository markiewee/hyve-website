export default function AcStatusIndicator({ status }) {
  if (status === "ON") {
    return (
      <div className="flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
        </span>
        <span className="text-sm font-medium text-emerald-300">AC Running</span>
      </div>
    );
  }

  if (status === "OFF") {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex rounded-full h-3 w-3 bg-foreground-variant" />
        <span className="text-sm font-medium text-foreground-variant">AC Off</span>
      </div>
    );
  }

  // null / unknown, no recent data from sensor
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="inline-flex rounded-full h-3 w-3 bg-foreground-variant/60" />
        <span className="text-sm font-medium text-foreground-variant">No data</span>
      </div>
      <span className="text-xs text-foreground-variant">Sensor offline or not yet configured</span>
    </div>
  );
}
