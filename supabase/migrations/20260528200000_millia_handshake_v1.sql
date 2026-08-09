-- Millia ↔ Lazybee partner webhook handshake (v1).
--
-- Supersedes the prior local-only 20260528100000_webhook_deliveries migration.
-- That migration was never applied to remote — safe to DROP and replace.
--
-- See docs/integrations/millia-handshake-v1.md for the full protocol spec.

-- ---------------------------------------------------------------------------
-- 0. Drop superseded table (prior pass, never deployed remotely).
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS webhook_deliveries;

-- ---------------------------------------------------------------------------
-- 1. Echo-prevention column on maintenance_tickets.
--    Outbound enqueue only fires when last_sync_source = 'local'.
-- ---------------------------------------------------------------------------
ALTER TABLE maintenance_tickets
  ADD COLUMN IF NOT EXISTS last_sync_source TEXT
    NOT NULL DEFAULT 'local'
    CHECK (last_sync_source IN ('local', 'partner_inbound', 'outbound_to_partner'));

CREATE INDEX IF NOT EXISTS idx_maintenance_tickets_last_sync_source
  ON maintenance_tickets (last_sync_source);

-- ---------------------------------------------------------------------------
-- 2. Inbound audit + dedup log (Millia → Lazybee).
--    delivery_id is the PK — transport-level idempotency.
--    Status: pending | applied | unmapped | rejected
-- ---------------------------------------------------------------------------
CREATE TABLE partner_inbound_log (
  delivery_id     UUID PRIMARY KEY,
  partner         TEXT NOT NULL DEFAULT 'millia',
  event           TEXT NOT NULL,
  ticket_id       UUID NULL REFERENCES maintenance_tickets(id) ON DELETE SET NULL,
  payload         JSONB NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('pending', 'applied', 'unmapped', 'rejected')),
  received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at    TIMESTAMPTZ NULL,
  id              UUID NOT NULL DEFAULT gen_random_uuid()
);

CREATE INDEX idx_partner_inbound_log_ticket   ON partner_inbound_log (ticket_id, received_at DESC);
CREATE INDEX idx_partner_inbound_log_partner  ON partner_inbound_log (partner, received_at DESC);
CREATE INDEX idx_partner_inbound_log_status   ON partner_inbound_log (status, received_at DESC);

ALTER TABLE partner_inbound_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin reads partner_inbound_log"
  ON partner_inbound_log FOR SELECT
  USING (get_user_role(auth.uid()) = 'ADMIN');

-- ---------------------------------------------------------------------------
-- 3. Outbound queue + dead-letter (Lazybee → Millia).
--    Worker pops pending rows where next_attempt_at <= now(), POSTs, updates.
-- ---------------------------------------------------------------------------
CREATE TABLE partner_outbound_queue (
  delivery_id       UUID PRIMARY KEY,
  partner           TEXT NOT NULL DEFAULT 'millia',
  ticket_id         UUID NOT NULL REFERENCES maintenance_tickets(id) ON DELETE CASCADE,
  event             TEXT NOT NULL,
  payload           JSONB NOT NULL,
  attempt           INT NOT NULL DEFAULT 0,
  next_attempt_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_status_code  INT NULL,
  last_response     TEXT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'in_flight', 'delivered', 'dead_lettered')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at      TIMESTAMPTZ NULL,
  id                UUID NOT NULL DEFAULT gen_random_uuid()
);

CREATE INDEX idx_partner_outbound_queue_pending
  ON partner_outbound_queue (next_attempt_at)
  WHERE status = 'pending';

CREATE INDEX idx_partner_outbound_queue_ticket
  ON partner_outbound_queue (ticket_id, created_at DESC);

CREATE INDEX idx_partner_outbound_queue_status
  ON partner_outbound_queue (status, created_at DESC);

ALTER TABLE partner_outbound_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin reads partner_outbound_queue"
  ON partner_outbound_queue FOR SELECT
  USING (get_user_role(auth.uid()) = 'ADMIN');

-- ---------------------------------------------------------------------------
-- 4. Partner ↔ local room mapping (bootstrap for inbound resolution).
--    Composite PK (partner, partner_room_id) means same room can map for
--    multiple partners later.
-- ---------------------------------------------------------------------------
CREATE TABLE partner_property_mappings (
  partner             TEXT NOT NULL,
  partner_room_id     TEXT NOT NULL,
  partner_unit_code   TEXT NULL,
  millia_property_id  UUID NULL,
  room_id             UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (partner, partner_room_id)
);

CREATE INDEX idx_partner_property_mappings_room
  ON partner_property_mappings (room_id);

CREATE INDEX idx_partner_property_mappings_unit_code
  ON partner_property_mappings (partner, partner_unit_code);

ALTER TABLE partner_property_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin reads partner_property_mappings"
  ON partner_property_mappings FOR SELECT
  USING (get_user_role(auth.uid()) = 'ADMIN');

-- Service role (edge functions) bypasses RLS by default. No write policies needed.

COMMENT ON COLUMN maintenance_tickets.last_sync_source IS
  'Source of last write: local (user/admin), partner_inbound (Millia callback), outbound_to_partner (audit stamp after our outbound success). Outbound enqueue only fires on local.';
COMMENT ON TABLE partner_inbound_log IS
  'Audit + idempotency log for inbound partner webhooks. delivery_id PK = dedup key.';
COMMENT ON TABLE partner_outbound_queue IS
  'Outbound webhook delivery queue. Backoff: 1m, 2m, 5m, 15m, 30m, 1h, 2h, 4h, 8h (cap). Dead-letter after 24h.';
COMMENT ON TABLE partner_property_mappings IS
  'Maps partner-side room ids → our rooms(id). Populated via /functions/v1/partner-room-sync.';
