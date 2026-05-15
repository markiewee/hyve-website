// V3 booking metadata — labels, time formatting, slot/window state copy.
// Pure data, browser-safe.

export const WINDOW_LABELS = {
  "fri-evening":   "Friday evening",
  "sat-morning":   "Saturday morning",
  "sun-afternoon": "Sunday afternoon",
};

export const WINDOW_TIMES = {
  "fri-evening":   "7–10 pm",
  "sat-morning":   "10 am – 1 pm",
  "sun-afternoon": "4–6 pm",
};

/**
 * Returns a human label + clickability for a window card.
 * @param {{state:string, anchor_property:string|null, free_slot_count:number}} window
 * @param {'CP'|'IH'|'TG'} propertyOfInterest
 */
export function describeWindowState(window, propertyOfInterest) {
  if (window.state === "CLOSED") {
    return { label: "Closed this week", clickable: false, tone: "muted" };
  }
  if (window.state === "OPEN-PROP" && window.anchor_property !== propertyOfInterest) {
    return {
      label: `Booked for ${window.anchor_property} this week`,
      clickable: false,
      tone: "muted",
    };
  }
  if (window.free_slot_count === 0) {
    return { label: "Fully booked", clickable: false, tone: "muted" };
  }
  return {
    label: `${window.free_slot_count} slot${window.free_slot_count === 1 ? "" : "s"} open`,
    clickable: true,
    tone: window.anchor_property === propertyOfInterest ? "anchor" : "open",
  };
}

/**
 * Should this slot pill be clickable?
 */
export function isSlotClickable(slot, propertyOfInterest, anchorProperty) {
  if (slot.state === "BOOKED") return false;
  if (slot.state === "BLOCKED-BUFFER") return false;
  if (slot.state === "WINDOW-CLOSED") return false;
  if (slot.state === "PROP-RESERVED") return anchorProperty === propertyOfInterest;
  return slot.state === "OPEN-ANY";
}

/**
 * Copy for slot pill state.
 */
export function slotStateClass(slot, isSelected) {
  if (isSelected) return "bg-[#A87813] text-white shadow-md scale-105";
  if (slot.state === "BOOKED") return "bg-slate-100 text-slate-300 cursor-not-allowed line-through";
  if (slot.state === "BLOCKED-BUFFER") return "bg-amber-50 text-amber-300 cursor-not-allowed";
  if (slot.state === "PROP-RESERVED") return "bg-[#D9A441]/10 text-[#00423b] hover:bg-[#D9A441]/25";
  return "bg-[#e6e8ea] text-[#1F2937] hover:bg-[#D9A441]/20 hover:text-[#00423b]";
}
