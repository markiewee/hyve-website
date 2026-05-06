-- Per-room max occupancy. Default 1 — only Master rooms and select Premium
-- rooms with twin-bed setups are set to 2 (managed in the UI / SQL).
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS max_occupancy INT NOT NULL DEFAULT 1;

COMMENT ON COLUMN rooms.max_occupancy
  IS 'Maximum number of people allowed in this room. Used for booking caps + listing display.';

-- Seed values matching the live state set 6 May 2026.
UPDATE rooms SET max_occupancy = 2
  WHERE unit_code IN ('TG-MR','TG-PR1','IH-PR1','CP-MR','CP-PR3');
