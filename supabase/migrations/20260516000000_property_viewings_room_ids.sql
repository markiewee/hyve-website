-- property_viewings: support up to 2 rooms per viewing
--
-- Prospects can now pick up to 2 rooms they want to see in one viewing slot.
-- Old single-room column (room_id) kept for back-compat — mirrors room_ids[0].
--
-- Why an array (not a join table): viewings are read-heavy (admin dashboard,
-- captain assignments, reminder cron), and the rooms list is always fetched
-- together with the viewing. A uuid[] column with a GIN index gives us O(1)
-- "did anyone book this room" lookups without a join. Keeps migration tiny.

ALTER TABLE property_viewings
  ADD COLUMN IF NOT EXISTS room_ids uuid[];

-- 1-2 rooms (NULL allowed for "I'm flexible — show me anything")
ALTER TABLE property_viewings
  DROP CONSTRAINT IF EXISTS property_viewings_room_ids_max_two;
ALTER TABLE property_viewings
  ADD CONSTRAINT property_viewings_room_ids_max_two
  CHECK (room_ids IS NULL OR (array_length(room_ids, 1) BETWEEN 1 AND 2));

-- Reverse-lookup index: "give me every viewing that includes this room"
CREATE INDEX IF NOT EXISTS idx_property_viewings_room_ids
  ON property_viewings USING GIN (room_ids);

-- Backfill from the legacy singular column
UPDATE property_viewings
   SET room_ids = ARRAY[room_id]
 WHERE room_id IS NOT NULL
   AND room_ids IS NULL;

-- Trigger: keep room_id mirrored to room_ids[0] so legacy queries
-- (admin dashboard joins, gcal builders, captain reminders) keep working
-- without forcing every callsite to switch to the array column today.
CREATE OR REPLACE FUNCTION sync_property_viewings_room_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.room_ids IS NOT NULL AND array_length(NEW.room_ids, 1) >= 1 THEN
    NEW.room_id := NEW.room_ids[1];
  ELSIF NEW.room_ids IS NULL THEN
    -- caller cleared the array — leave room_id alone unless they also nulled it
    NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_property_viewings_sync_room_id ON property_viewings;
CREATE TRIGGER trg_property_viewings_sync_room_id
  BEFORE INSERT OR UPDATE OF room_ids ON property_viewings
  FOR EACH ROW
  EXECUTE FUNCTION sync_property_viewings_room_id();

COMMENT ON COLUMN property_viewings.room_ids IS
  'Up to 2 rooms the prospect wants to view. NULL = flexible / show what is available. room_id is auto-mirrored to room_ids[0] via trigger for back-compat.';
