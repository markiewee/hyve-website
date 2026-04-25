/**
 * Invoice Code Format: {3-digit property}{1-digit room}{3-digit sequence}
 *
 * Property codes:
 *   TG (Thomson Grove 588)  = 100
 *   CP (Chiltern Park 135)  = 200
 *   IH (Ivory Heights 122)  = 300
 *
 * Room digit (extracted from unit_code):
 *   MR  = 0
 *   PR1 = 1, PR2 = 2, PR3 = 3, PR4 = 4
 *   STD1 = 5, STD2 = 6, STD3 = 7, STD4 = 8
 *
 * Examples:
 *   TG PR1, 1st invoice  → 1001001
 *   CP PR4, 3rd invoice  → 2004003
 *   IH STD2, 12th invoice → 3006012
 */

const PROPERTY_CODES = {
  TG: "100",
  CP: "200",
  IH: "300",
};

const ROOM_DIGITS = {
  MR: "0",
  PR1: "1", PR2: "2", PR3: "3", PR4: "4",
  STD1: "5", STD2: "6", STD3: "7", STD4: "8",
};

/**
 * @param {string} propertyCode - "TG", "CP", or "IH"
 * @param {string} roomUnitCode - e.g. "TG-PR1", "CP-STD2"
 * @param {number} seq - invoice sequence number (1-based)
 * @returns {string} e.g. "1001001"
 */
export function generateInvoiceCode(propertyCode, roomUnitCode, seq = 1) {
  const propCode = PROPERTY_CODES[propertyCode] ?? "000";
  const roomSuffix = roomUnitCode.includes("-")
    ? roomUnitCode.split("-").slice(1).join("-")
    : roomUnitCode;
  const roomDigit = ROOM_DIGITS[roomSuffix] ?? "9";
  const seqPart = String(seq).padStart(3, "0");
  return `${propCode}${roomDigit}${seqPart}`;
}
