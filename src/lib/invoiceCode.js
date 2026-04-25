/**
 * Generate a sequential numeric invoice code.
 * Starts at 10001 and increments.
 * @param {number} seq - sequence number
 * @returns {string} invoice code e.g. "10001"
 */
export function generateInvoiceCode(seq) {
  return String(10000 + seq);
}
