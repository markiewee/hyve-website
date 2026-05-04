-- Add flag + ACKNOWLEDGED status to maintenance_tickets
-- Lets admins/captains: (a) flag urgent tickets to pin them, (b) acknowledge
-- without committing to "In Progress" so the resident gets a faster update.

ALTER TABLE maintenance_tickets
  ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE maintenance_tickets
  ADD COLUMN IF NOT EXISTS acknowledged_by UUID REFERENCES auth.users(id);

ALTER TABLE maintenance_tickets
  ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;

-- Replace the status CHECK so ACKNOWLEDGED is a valid value.
ALTER TABLE maintenance_tickets
  DROP CONSTRAINT IF EXISTS maintenance_tickets_status_check;

ALTER TABLE maintenance_tickets
  ADD CONSTRAINT maintenance_tickets_status_check
  CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED'));

CREATE INDEX IF NOT EXISTS idx_maintenance_tickets_flagged_status
  ON maintenance_tickets (is_flagged, status)
  WHERE is_flagged = true;
