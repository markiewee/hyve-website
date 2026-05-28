-- Idempotency + audit log for inbound webhooks from external automation backends.
-- Each delivery_id is processed at most once; replays return the original result.
CREATE TABLE webhook_deliveries (
  delivery_id UUID PRIMARY KEY,
  source TEXT NOT NULL,
  ticket_id UUID REFERENCES maintenance_tickets(id),
  payload JSONB NOT NULL,
  result_status INT NOT NULL,
  result_body JSONB,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_deliveries_ticket ON webhook_deliveries (ticket_id, received_at DESC);
CREATE INDEX idx_webhook_deliveries_source ON webhook_deliveries (source, received_at DESC);

ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Only the service role (edge function) writes; admins can read for debugging.
CREATE POLICY "Admin reads webhook_deliveries"
  ON webhook_deliveries FOR SELECT
  USING (get_user_role(auth.uid()) = 'ADMIN');
