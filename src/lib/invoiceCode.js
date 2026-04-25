/**
 * Generate a unique invoice code.
 * Format: HV-{PROPERTY_CODE}-{ROOM_CODE}-{YYYYMM}-{SUFFIX}
 */
export function generateInvoiceCode(propertyCode, roomUnitCode, month, type, seq = 1) {
  const roomSuffix = roomUnitCode.includes("-")
    ? roomUnitCode.split("-").slice(1).join("-")
    : roomUnitCode;
  const yyyymm = month.substring(0, 7).replace("-", "");
  let suffix;
  if (type === "MOVE_IN") suffix = "MI";
  else if (type === "MOVE_OUT") suffix = "MO";
  else suffix = String(seq).padStart(3, "0");
  return `HV-${propertyCode}-${roomSuffix}-${yyyymm}-${suffix}`;
}
