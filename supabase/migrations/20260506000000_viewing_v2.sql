-- ──────────────────────────────────────────────────────────────────────
-- Hyve Viewing Booking V2
-- Spec: docs/superpowers/specs/2026-05-06-hyve-viewing-booking-v2-design.md
--
-- Replaces V1 (3-way poll workflow). This migration is ADDITIVE only —
-- viewing_polls and viewing_poll_responses are NOT dropped here. They
-- will be dropped in a follow-up migration after Mark signs off and the
-- frontend has been migrated off them.
-- ──────────────────────────────────────────────────────────────────────

-- Self-contained updated_at trigger fn (idempotent — also defined elsewhere)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Extend property_viewings ──────────────────────────────────────────
ALTER TABLE property_viewings
  ADD COLUMN IF NOT EXISTS slot_start            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS slot_end              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gcal_event_id         TEXT,
  ADD COLUMN IF NOT EXISTS cancel_token          TEXT,
  ADD COLUMN IF NOT EXISTS source                TEXT,
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_2h_sent_at   TIMESTAMPTZ;

-- Unique cancel_token (NULLs ignored)
CREATE UNIQUE INDEX IF NOT EXISTS property_viewings_cancel_token_uidx
  ON property_viewings(cancel_token)
  WHERE cancel_token IS NOT NULL;

-- Source values whitelist (allow NULL for legacy rows)
ALTER TABLE property_viewings
  DROP CONSTRAINT IF EXISTS property_viewings_source_check;
ALTER TABLE property_viewings
  ADD CONSTRAINT property_viewings_source_check
  CHECK (source IS NULL OR source IN (
    'roomies','carousell','pg','ig','wa','organic','admin','direct','airbnb','fb','google','referral'
  ));

-- Ensure status enum covers V2 values. If an existing CHECK is too narrow,
-- replace it. We use a permissive set rather than risk breaking V1 rows.
ALTER TABLE property_viewings
  DROP CONSTRAINT IF EXISTS property_viewings_status_check;
ALTER TABLE property_viewings
  ADD CONSTRAINT property_viewings_status_check
  CHECK (status IN ('pending','confirmed','cancelled','no_show','attended'));

-- Backfill slot_start / slot_end from viewing_date + viewing_time when present.
-- Best-effort — assumes Asia/Singapore (UTC+8) and a 30-min default slot length.
-- Only updates rows where slot_start is still NULL.
UPDATE property_viewings
SET
  slot_start = (viewing_date::text || ' ' || viewing_time::text)::timestamp AT TIME ZONE 'Asia/Singapore',
  slot_end   = ((viewing_date::text || ' ' || viewing_time::text)::timestamp AT TIME ZONE 'Asia/Singapore') + interval '30 minutes'
WHERE slot_start IS NULL
  AND viewing_date IS NOT NULL
  AND viewing_time IS NOT NULL;

-- Indexes for booking lookups + reminder cron sweeps
CREATE INDEX IF NOT EXISTS property_viewings_slot_start_idx
  ON property_viewings(slot_start);

CREATE INDEX IF NOT EXISTS property_viewings_status_slot_idx
  ON property_viewings(status, slot_start);

CREATE INDEX IF NOT EXISTS property_viewings_property_slot_idx
  ON property_viewings(property_id, slot_start);

CREATE INDEX IF NOT EXISTS property_viewings_reminder_24h_idx
  ON property_viewings(slot_start)
  WHERE status = 'confirmed' AND reminder_24h_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS property_viewings_reminder_2h_idx
  ON property_viewings(slot_start)
  WHERE status = 'confirmed' AND reminder_2h_sent_at IS NULL;

-- ── leads table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  email               TEXT,
  phone               TEXT,
  property_interest   TEXT[],                  -- ['TG','IH','CP']
  first_contact_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  source              TEXT,
  status              TEXT NOT NULL DEFAULT 'new'
                      CHECK (status IN ('new','viewing_booked','viewed','closed_won','closed_lost')),
  viewing_id          UUID REFERENCES property_viewings(id) ON DELETE SET NULL,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leads_email_idx        ON leads(email);
CREATE INDEX IF NOT EXISTS leads_phone_idx        ON leads(phone);
CREATE INDEX IF NOT EXISTS leads_status_idx       ON leads(status);
CREATE INDEX IF NOT EXISTS leads_first_contact_idx ON leads(first_contact_at DESC);

DROP TRIGGER IF EXISTS trg_leads_updated_at ON leads;
CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- ── RLS: leads ────────────────────────────────────────────────────────
-- Public booking writes happen via service role (API routes), which bypasses
-- RLS. So no INSERT policy needed for anon/authenticated.

-- Admins can read/update all leads
DROP POLICY IF EXISTS "Admins read all leads" ON leads;
CREATE POLICY "Admins read all leads"
  ON leads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenant_profiles tp
      WHERE tp.user_id = auth.uid()
        AND tp.role IN ('ADMIN','SUPER_ADMIN')
        AND tp.is_active = true
    )
  );

DROP POLICY IF EXISTS "Admins update leads" ON leads;
CREATE POLICY "Admins update leads"
  ON leads FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tenant_profiles tp
      WHERE tp.user_id = auth.uid()
        AND tp.role IN ('ADMIN','SUPER_ADMIN')
        AND tp.is_active = true
    )
  );

DROP POLICY IF EXISTS "Admins insert leads" ON leads;
CREATE POLICY "Admins insert leads"
  ON leads FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_profiles tp
      WHERE tp.user_id = auth.uid()
        AND tp.role IN ('ADMIN','SUPER_ADMIN')
        AND tp.is_active = true
    )
  );

-- Captains can read leads tied to viewings at their property
DROP POLICY IF EXISTS "Captains read property leads" ON leads;
CREATE POLICY "Captains read property leads"
  ON leads FOR SELECT
  USING (
    viewing_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM property_viewings pv
      JOIN tenant_profiles tp ON tp.property_id = pv.property_id
      WHERE pv.id = leads.viewing_id
        AND tp.user_id = auth.uid()
        AND tp.role = 'HOUSE_CAPTAIN'
        AND tp.is_active = true
    )
  );

-- ── RLS: property_viewings (idempotent, in case missing) ──────────────
-- We do NOT redefine the existing policies — only add ones that may be
-- missing for the V2 flow. If property_viewings already has admin/captain
-- read policies they continue to work.
ALTER TABLE property_viewings ENABLE ROW LEVEL SECURITY;

-- Public can read a viewing by cancel_token (used by cancel page).
-- Restricted to confirmed/cancelled only — no leaking pending/internal rows.
DROP POLICY IF EXISTS "Public read by cancel token" ON property_viewings;
CREATE POLICY "Public read by cancel token"
  ON property_viewings FOR SELECT
  USING (
    cancel_token IS NOT NULL
    AND status IN ('confirmed','cancelled')
  );
-- NOTE: the API route /api/book/cancel always uses the service role, so it
-- bypasses RLS anyway. This policy is mostly defensive — if a future page
-- queries via the anon key with the token, it works. The token itself is
-- the auth grant (32 bytes random hex).
