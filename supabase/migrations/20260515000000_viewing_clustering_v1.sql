-- ──────────────────────────────────────────────────────────────────────
-- Viewing clustering V1 — additive migration
-- Spec: docs/specs/2026-05-15-viewing-clustering.md
--
-- Changes (all additive, zero destructive ops):
--   1. property_viewings.viewing_rules_version  TEXT DEFAULT 'v0'
--      Existing rows get 'v0' (grandfathered). New V3 bookings = 'v1'.
--   2. get_viewing_windows(int)  helper SQL fn — returns Fri/Sat/Sun
--      window ranges for the next N days, anchored to Asia/Singapore.
--   3. leads_off_horizon_idx  partial index on intent->>'off_horizon'.
-- ──────────────────────────────────────────────────────────────────────

-- 1. Rules version on property_viewings
ALTER TABLE property_viewings
  ADD COLUMN IF NOT EXISTS viewing_rules_version TEXT NOT NULL DEFAULT 'v0';

COMMENT ON COLUMN property_viewings.viewing_rules_version IS
  'V3 clustering rules: v0 = grandfathered (no clustering check), v1 = V3 form, admin = bypassed via admin UI';

-- 2. Helper function: list upcoming Fri/Sat/Sun viewing windows
CREATE OR REPLACE FUNCTION public.get_viewing_windows(_horizon_days int DEFAULT 7)
RETURNS TABLE (
  window_key   text,
  window_start timestamptz,
  window_end   timestamptz,
  day_of_week  text
) LANGUAGE sql STABLE AS $$
  WITH days AS (
    SELECT generate_series(
      (date_trunc('day', now() AT TIME ZONE 'Asia/Singapore'))::date,
      ((date_trunc('day', now() AT TIME ZONE 'Asia/Singapore'))::date + (_horizon_days - 1)),
      interval '1 day'
    )::date AS d
  )
  SELECT
    CASE EXTRACT(DOW FROM d)::int
      WHEN 5 THEN 'fri-evening'
      WHEN 6 THEN 'sat-morning'
      WHEN 0 THEN 'sun-afternoon'
    END AS window_key,
    ((d::timestamp + (CASE EXTRACT(DOW FROM d)::int
                       WHEN 5 THEN interval '19 hours'
                       WHEN 6 THEN interval '10 hours'
                       WHEN 0 THEN interval '16 hours' END))
       AT TIME ZONE 'Asia/Singapore') AS window_start,
    ((d::timestamp + (CASE EXTRACT(DOW FROM d)::int
                       WHEN 5 THEN interval '22 hours'
                       WHEN 6 THEN interval '13 hours'
                       WHEN 0 THEN interval '18 hours' END))
       AT TIME ZONE 'Asia/Singapore') AS window_end,
    to_char(d, 'Day') AS day_of_week
  FROM days
  WHERE EXTRACT(DOW FROM d)::int IN (0, 5, 6);
$$;

COMMENT ON FUNCTION public.get_viewing_windows(int) IS
  'V3 viewing windows: Fri 19-22, Sat 10-13, Sun 16-18 (SGT). Returns rows for the next N days.';

-- 3. Off-horizon leads index — fast lookup for the daily reminder cron
CREATE INDEX IF NOT EXISTS leads_off_horizon_idx
  ON leads ((intent->>'off_horizon'))
  WHERE (intent->>'off_horizon') = 'true';
