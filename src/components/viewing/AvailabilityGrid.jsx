import React, { useCallback, useMemo, useRef, useState } from "react";

const SLOT_START_HOUR = 10; // 10 AM
const SLOT_END_HOUR = 20; // 8 PM
const SLOT_MINUTES = 30;
const SLOTS_PER_DAY = ((SLOT_END_HOUR - SLOT_START_HOUR) * 60) / SLOT_MINUTES; // 20

/** Build an array of 30-min Date slots for a single day */
function buildDaySlots(date) {
  const slots = [];
  for (let i = 0; i < SLOTS_PER_DAY; i++) {
    const d = new Date(date);
    d.setHours(SLOT_START_HOUR + Math.floor((i * SLOT_MINUTES) / 60));
    d.setMinutes((i * SLOT_MINUTES) % 60, 0, 0);
    slots.push(d);
  }
  return slots;
}

/** Format time label: "10:00 AM", "10:30 AM", etc. */
function formatTime(slotIndex) {
  const totalMinutes = SLOT_START_HOUR * 60 + slotIndex * SLOT_MINUTES;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}

/** Check if two Date objects represent the same 30-min slot */
function isSameSlot(a, b) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate() &&
    a.getHours() === b.getHours() &&
    a.getMinutes() === b.getMinutes()
  );
}

/** Short day name */
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function AvailabilityGrid({
  startDate,
  days = 7,
  selectedSlots = [],
  onSlotsChange,
  readOnly = false,
  highlightSlot,
}) {
  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragModeRef = useRef(null); // "select" or "deselect"

  // Build the grid data: array of { date, dayLabel, dateNum, month, slots[] }
  const columns = useMemo(() => {
    const cols = [];
    for (let d = 0; d < days; d++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + d);
      date.setHours(0, 0, 0, 0);
      cols.push({
        date,
        dayLabel: DAY_NAMES[date.getDay()],
        dateNum: date.getDate(),
        month: MONTH_NAMES[date.getMonth()],
        slots: buildDaySlots(date),
      });
    }
    return cols;
  }, [startDate, days]);

  // Build a Set key for fast lookup of selected slots
  const selectedKeys = useMemo(() => {
    const keys = new Set();
    for (const s of selectedSlots) {
      keys.add(`${s.getFullYear()}-${s.getMonth()}-${s.getDate()}-${s.getHours()}-${s.getMinutes()}`);
    }
    return keys;
  }, [selectedSlots]);

  const slotKey = (d) =>
    `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}`;

  const isSelected = useCallback(
    (d) => selectedKeys.has(slotKey(d)),
    [selectedKeys],
  );

  const isHighlighted = useCallback(
    (d) => isSameSlot(d, highlightSlot),
    [highlightSlot],
  );

  const toggleSlot = useCallback(
    (slot, forceMode) => {
      if (readOnly || !onSlotsChange) return;
      const key = slotKey(slot);
      const currentlySelected = selectedKeys.has(key);
      const shouldSelect =
        forceMode !== undefined ? forceMode : !currentlySelected;

      if (shouldSelect && !currentlySelected) {
        onSlotsChange([...selectedSlots, slot]);
      } else if (!shouldSelect && currentlySelected) {
        onSlotsChange(selectedSlots.filter((s) => !isSameSlot(s, slot)));
      }
    },
    [readOnly, onSlotsChange, selectedKeys, selectedSlots],
  );

  // Drag handlers for multi-select
  const handlePointerDown = useCallback(
    (slot) => {
      if (readOnly) return;
      const mode = isSelected(slot) ? false : true;
      dragModeRef.current = mode;
      setIsDragging(true);
      toggleSlot(slot, mode);
    },
    [readOnly, isSelected, toggleSlot],
  );

  const handlePointerEnter = useCallback(
    (slot) => {
      if (!isDragging || readOnly) return;
      toggleSlot(slot, dragModeRef.current);
    },
    [isDragging, readOnly, toggleSlot],
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    dragModeRef.current = null;
  }, []);

  // Time labels
  const timeLabels = useMemo(() => {
    const labels = [];
    for (let i = 0; i < SLOTS_PER_DAY; i++) {
      labels.push(formatTime(i));
    }
    return labels;
  }, []);

  return (
    <div
      className="rounded-2xl bg-white border border-[#bbcac6]/15 shadow-sm p-4 sm:p-6"
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Heading */}
      <h3
        className="text-sm font-semibold text-[#121c2a] mb-4"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        Select your availability
      </h3>

      {/* Scrollable container — shows 3 days on mobile, all on desktop */}
      <div
        ref={containerRef}
        className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0"
      >
        <div
          className="min-w-[640px] select-none"
          style={{
            display: "grid",
            gridTemplateColumns: `60px repeat(${days}, 1fr)`,
            gap: "2px",
            fontFamily: "'Manrope', sans-serif",
          }}
        >
          {/* Header row: empty corner + day headers */}
          <div className="sticky left-0 z-10 bg-white" />
          {columns.map((col, ci) => (
            <div
              key={ci}
              className="flex flex-col items-center py-2 select-none"
            >
              <span className="text-xs font-medium text-[#6c7a77]">
                {col.dayLabel}
              </span>
              <span
                className="text-base font-bold text-[#121c2a] leading-tight"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {col.dateNum}
              </span>
              <span className="text-[10px] text-[#6c7a77] uppercase tracking-wide">
                {col.month}
              </span>
            </div>
          ))}

          {/* Slot rows */}
          {timeLabels.map((label, ri) => (
            <React.Fragment key={`row-${ri}`}>
              {/* Time label — sticky on mobile */}
              <div
                className="sticky left-0 z-10 bg-white flex items-center justify-end pr-2"
              >
                <span className="text-[10px] text-[#6c7a77] whitespace-nowrap tabular-nums">
                  {label}
                </span>
              </div>

              {/* Day cells for this time row */}
              {columns.map((col, ci) => {
                const slot = col.slots[ri];
                const selected = isSelected(slot);
                const highlighted = isHighlighted(slot);

                let cellClass =
                  "h-8 rounded-md flex items-center justify-center transition-colors duration-100";

                if (highlighted) {
                  cellClass += " bg-green-500";
                } else if (selected) {
                  cellClass += " bg-[#006b5f]";
                } else {
                  cellClass += " bg-[#f1f3f5]";
                }

                if (!readOnly) {
                  cellClass += " cursor-pointer hover:opacity-80 active:scale-95";
                }

                return (
                  <div
                    key={`c-${ci}-${ri}`}
                    className={cellClass}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      handlePointerDown(slot);
                    }}
                    onPointerEnter={() => handlePointerEnter(slot)}
                    role={readOnly ? "presentation" : "button"}
                    aria-label={`${col.dayLabel} ${col.dateNum} ${col.month}, ${label}${selected ? " — selected" : ""}${highlighted ? " — matched" : ""}`}
                    tabIndex={readOnly ? -1 : 0}
                    onKeyDown={(e) => {
                      if (!readOnly && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        toggleSlot(slot);
                      }
                    }}
                  >
                    {highlighted && (
                      <span className="text-white text-sm font-bold">★</span>
                    )}
                    {selected && !highlighted && (
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 text-[10px] text-[#6c7a77]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-[#f1f3f5]" />
          Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-[#006b5f]" />
          Selected
        </span>
        {highlightSlot && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-green-500" />
            Matched
          </span>
        )}
      </div>
    </div>
  );
}
