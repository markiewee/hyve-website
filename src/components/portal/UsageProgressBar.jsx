const RATE_PER_HOUR = 0.3; // SGD per hour over free allowance

export default function UsageProgressBar({ totalHours, freeHours = 300 }) {
  const hours = totalHours ?? 0;
  const isOver = hours > freeHours;
  const remaining = freeHours - hours;
  const overBy = hours - freeHours;
  const progressPct = Math.min((hours / freeHours) * 100, 100);
  const estCharge = overBy * RATE_PER_HOUR;

  return (
    <div className="flex flex-col gap-2">
      {/* Labels */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {hours.toFixed(1)} / {freeHours} free hours
        </span>
        {isOver ? (
          <span className="text-red-600 font-medium">
            {overBy.toFixed(1)}h over — est. SGD ${estCharge.toFixed(2)}
          </span>
        ) : (
          <span className="text-muted-foreground">
            {remaining.toFixed(1)}h remaining
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full rounded-full transition-all ${isOver ? "bg-red-500" : "bg-green-500"}`}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}
