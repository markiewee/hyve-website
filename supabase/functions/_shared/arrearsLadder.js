/**
 * The arrears ladder, as a pure decision.
 *
 * Lifted out of check-late-fees so the boundaries can be tested without a
 * database. The rungs and the 5% rate are unchanged from the ladder that has
 * been running since 9 August 2026. The one thing that changes is that each
 * rung now names its own event type instead of every rung shouting
 * RENT_OVERDUE, which is why a tenant 3 days late and a tenant 29 days late
 * used to receive a word-for-word identical email.
 *
 * The five event names are the five templates that already existed in
 * notify-tenant and had never been called by anything.
 */

export const LATE_FEE_RATE = 0.05;

/** Automated chasing stops here; past this it is a conversation, not an email. */
export const CAP_DAYS = 30;

export function round2(n) {
  return Math.round(n * 100) / 100;
}

const NONE = (reason) => ({
  event: null,
  reason,
  newFee: 0,
  newFeeCount: null,
  estimatedLateFee: 0,
});

/**
 * Decide which rung, if any, fires for one overdue row today.
 *
 * @param {object} s
 * @param {number} s.daysOverdue        whole days past due_date, Singapore time
 * @param {number} s.lastRemindedAtDays rent_payments.last_reminder_days_overdue
 * @param {number} s.feeCount           rent_payments.late_fee_count
 * @param {number} s.outstanding        rent + fees already applied, less paid
 * @param {number} s.currentFee         rent_payments.late_fee
 * @returns {{event: string|null, reason: string, newFee: number,
 *            newFeeCount: number|null, estimatedLateFee: number}}
 */
export function selectRung(s) {
  const days = Number(s.daysOverdue);
  const last = Number(s.lastRemindedAtDays ?? 0);
  const feeCount = Number(s.feeCount ?? 0);
  const outstanding = Number(s.outstanding ?? 0);

  if (outstanding <= 0) return NONE("nothing_outstanding");
  if (days > CAP_DAYS) return NONE("past_cap");

  // Always 5% of what is still owed, not of the original rent: a tenant who
  // paid most of the month should not be charged as though they paid none.
  const fee = round2(outstanding * LATE_FEE_RATE);

  // 29+ days: final notice, second 5%.
  if (days >= 29 && last < 29) {
    const charge = feeCount < 2 ? fee : 0;
    return {
      event: "INVOICE_FINAL_NOTICE",
      reason: "final_notice",
      newFee: charge,
      newFeeCount: charge > 0 ? feeCount + 1 : feeCount,
      estimatedLateFee: fee,
    };
  }

  // 7+ days, every other day: keep reminding, no further fee.
  if (days >= 7 && (days - 7) % 2 === 0 && last < days) {
    return {
      event: "INVOICE_OVERDUE_REMINDER",
      reason: "reminder",
      newFee: 0,
      newFeeCount: null,
      estimatedLateFee: fee,
    };
  }

  // 5+ days: the first 5% lands.
  if (days >= 5 && feeCount < 1) {
    return {
      event: "INVOICE_OVERDUE",
      reason: "first_fee",
      newFee: fee,
      newFeeCount: 1,
      estimatedLateFee: fee,
    };
  }

  // 4 days: the fee lands tomorrow.
  if (days === 4 && last < 4) {
    return {
      event: "INVOICE_LATE_FEE_WARNING",
      reason: "fee_warning",
      newFee: 0,
      newFeeCount: null,
      estimatedLateFee: fee,
    };
  }

  // 3 days: friendly nudge, no fee.
  if (days === 3 && last < 3) {
    return {
      event: "INVOICE_LATE_NOTICE",
      reason: "nudge",
      newFee: 0,
      newFeeCount: null,
      estimatedLateFee: fee,
    };
  }

  return NONE("no_rung");
}
