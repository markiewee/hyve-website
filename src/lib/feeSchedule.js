/**
 * Generate a fee schedule with prorated first and last months.
 * Rent is always due on the 1st. If the start date is not the 1st,
 * the first payment is prorated. If the end date is not the last day
 * of a month, the last payment is prorated.
 *
 * @param {string} startDate - ISO date string (YYYY-MM-DD)
 * @param {string} endDate - ISO date string (YYYY-MM-DD)
 * @param {number} monthlyRent - Full monthly rent amount
 * @returns {{ rows: Array<{label, amount, date, dateISO}>, totalMonths: number }}
 */
export function generateFeeSchedule(startDate, endDate, monthlyRent) {
  if (!startDate || !monthlyRent) return { rows: [], totalMonths: 0 };

  const start = new Date(startDate + "T00:00:00");
  const end = endDate ? new Date(endDate + "T00:00:00") : null;
  const rent = Number(monthlyRent);
  const rows = [];

  const fmtDate = (d) =>
    d.toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric" });

  const fmtAmount = (a) =>
    Number(a).toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

  const startDay = start.getDate();

  // ── First month (possibly prorated) ──
  if (startDay === 1) {
    // Starts on 1st — full month
    rows.push({
      label: "Licence Fee (1)",
      amount: fmtAmount(rent),
      amountNum: rent,
      date: fmtDate(start),
      dateISO: startDate,
    });
  } else {
    // Prorated: from start day to end of that month
    const totalDays = daysInMonth(start.getFullYear(), start.getMonth());
    const remainingDays = totalDays - startDay + 1;
    const prorated = Math.round((rent / totalDays) * remainingDays * 100) / 100;
    rows.push({
      label: `Licence Fee (1) — prorated ${remainingDays}/${totalDays} days`,
      amount: fmtAmount(prorated),
      amountNum: prorated,
      date: `${fmtDate(start)} – ${fmtDate(new Date(start.getFullYear(), start.getMonth() + 1, 0))}`,
      dateISO: startDate,
    });
  }

  // ── Full months (from next 1st until last full month) ──
  // Next payment is always the 1st of the following month
  let current = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  let counter = 2;

  while (true) {
    // Check if this month is beyond the end date
    if (end) {
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
      if (current > end) break;

      // Check if end date falls within this month (last partial month)
      if (end <= monthEnd && end.getDate() < monthEnd.getDate()) {
        // Prorated last month
        const totalDays = daysInMonth(current.getFullYear(), current.getMonth());
        const activeDays = end.getDate();
        const prorated = Math.round((rent / totalDays) * activeDays * 100) / 100;
        rows.push({
          label: `Licence Fee (${counter}) — prorated ${activeDays}/${totalDays} days`,
          amount: fmtAmount(prorated),
          amountNum: prorated,
          date: `${fmtDate(current)} – ${fmtDate(end)}`,
          dateISO: current.toISOString().split("T")[0],
        });
        break;
      }
    }

    // Full month
    rows.push({
      label: `Licence Fee (${counter})`,
      amount: fmtAmount(rent),
      amountNum: rent,
      date: fmtDate(current),
      dateISO: current.toISOString().split("T")[0],
    });

    counter++;
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);

    // Safety: max 36 months
    if (counter > 37) break;
  }

  return { rows, totalMonths: rows.length };
}

/**
 * Generate HTML rows for the fee schedule in the TA template.
 */
export function generateFeeScheduleHtml(startDate, endDate, monthlyRent) {
  const { rows } = generateFeeSchedule(startDate, endDate, monthlyRent);
  return rows.map((r) =>
    `<div class="bg-surface-container-lowest p-4 clause-text">${r.label}</div>
<div class="bg-surface-container-lowest p-4 clause-text">S$${r.amount}</div>
<div class="bg-surface-container-lowest p-4 clause-text">${r.date}</div>`
  ).join("\n");
}
