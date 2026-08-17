// src/lib/reserveOnboarding.js
//
// Pure seeding decisions for a reserve that is being claimed. No I/O: the
// endpoint owns every Supabase call and just asks this module what to write.
//
// Exists because api/portal/claim-reserve.js used to inline three wrong
// answers: it let moved_in_at fall through to now(), it hardcoded the first
// onboarding step to DEPOSIT, and it keyed idempotency on a single reserve row
// so a second reserve for the same room minted a second tenant profile.

/** First step a claimed reserve lands on. Registration comes before money. */
export const RESERVE_FIRST_STEP = "PERSONAL_DETAILS";

/** A reserve in one of these states must never donate its profile. */
const DEAD_RESERVE_STATES = new Set(["lost", "expired"]);

/**
 * start + months, minus one day.
 *
 * Matches AdminOnboardingPage.jsx and AdminOnboardingDetailPage.jsx exactly,
 * including JS setMonth day-overflow (31 Jan + 1 month lands in March), so the
 * API and the admin screen can never disagree about the same tenancy. Computed
 * in UTC so the result does not shift with the server's timezone.
 *
 * @returns {string|null} "YYYY-MM-DD", or null if it cannot be computed.
 */
export function addMonthsMinusADay(startDate, months) {
  const n = Number(months);
  if (!startDate || !Number.isFinite(n) || n <= 0) return null;

  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(startDate));
  if (!m) return null;

  const [, y, mo, d] = m;
  const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  if (Number.isNaN(dt.getTime())) return null;

  dt.setUTCMonth(dt.getUTCMonth() + n);
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

/**
 * Calendar months between two ISO dates, floored at 1. Zero if either is missing.
 *
 * Mirrors AdminOnboardingPage.jsx and hyve-booking's lib/tenancyDates.ts, so a tenancy
 * has the same stated length on the booking site, in the database and on the admin
 * screen. Deliberately ignores the day of month, exactly as the admin screen does.
 *
 * @returns {number}
 */
export function monthSpan(start, end) {
  const s = /^(\d{4})-(\d{2})/.exec(String(start ?? ""));
  const e = /^(\d{4})-(\d{2})/.exec(String(end ?? ""));
  if (!s || !e) return 0;

  const months = (Number(e[1]) - Number(s[1])) * 12 + (Number(e[2]) - Number(s[2]));
  return months > 0 ? months : 1;
}

/**
 * Given every other soft_reserve for the same room and prospect, return the
 * tenant_profile_id we should reuse instead of minting a new one.
 *
 * Oldest first: the first profile a person got is the one their documents,
 * onboarding progress and Stripe customer already hang off.
 *
 * @returns {string|null}
 */
export function pickReusableProfileId(siblingReserves) {
  if (!Array.isArray(siblingReserves)) return null;

  const usable = siblingReserves
    .filter((r) => r && r.tenant_profile_id && !DEAD_RESERVE_STATES.has(r.status))
    .sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));

  return usable.length > 0 ? usable[0].tenant_profile_id : null;
}

/**
 * The tenancy end date for a reserve.
 *
 * The prospect's own move-out date wins whenever they gave one. Real tenancies rarely
 * land exactly on start + N months, so the derived value used to be wrong often enough
 * that an admin had to correct it by hand afterwards. The derivation stays as the
 * fallback for reserves taken before the booking form asked for a move-out date.
 *
 * @returns {string|null} "YYYY-MM-DD", or null if neither source can supply one.
 */
function tenancyEnd(reserve, moveIn) {
  return (
    reserve.preferred_move_out ||
    addMonthsMinusADay(moveIn, Number(reserve.duration_months))
  );
}

function depositAmount(room) {
  if (!room || room.deposit_months == null || room.price_monthly == null) return null;
  const amount = Number(room.deposit_months) * Number(room.price_monthly);
  return Number.isFinite(amount) ? amount : null;
}

/**
 * The tenant_profiles insert payload.
 *
 * moved_in_at is set explicitly from the reserve's preferred move-in. The column
 * is NOT NULL DEFAULT now(), so omitting it silently records the submission
 * timestamp as the tenancy start. When we genuinely have no date we omit the
 * key and accept the default rather than invent one.
 */
export function buildProfileSeed({ reserve, room }) {
  const r = reserve || {};
  const monthly = room && room.price_monthly != null ? Number(room.price_monthly) : null;

  const seed = {
    room_id: r.room_id,
    property_id: r.property_id,
    role: "TENANT",
    is_active: true,
    monthly_rent: Number.isFinite(monthly) ? monthly : null,
  };

  const moveIn = r.preferred_move_in || null;
  if (moveIn) {
    seed.moved_in_at = moveIn;

    const end = tenancyEnd(r, moveIn);
    if (end) {
      seed.lease_end = end;
      seed.lease_months = monthSpan(moveIn, end);
    }
  }

  return seed;
}

/**
 * The onboarding_progress insert payload.
 *
 * current_step starts at RESERVE_FIRST_STEP. It used to be hardcoded to
 * DEPOSIT, which asked people for money before they had given their details,
 * uploaded ID, or signed anything.
 */
export function buildOnboardingSeed({ tenantProfileId, reserve, room }) {
  const r = reserve || {};

  const seed = {
    tenant_profile_id: tenantProfileId,
    room_id: r.room_id,
    current_step: RESERVE_FIRST_STEP,
    status: "ONBOARDING",
  };

  const deposit = depositAmount(room);
  if (deposit != null) seed.deposit_amount = deposit;

  const moveIn = r.preferred_move_in || null;
  if (moveIn) {
    seed.tenancy_start_date = moveIn;
    const end = tenancyEnd(r, moveIn);
    if (end) seed.tenancy_end_date = end;
  }

  return seed;
}
