-- Per-property default door code + access instructions used by the V2
-- viewing reminder email so prospects can self-serve entry without
-- depending on a house captain being assigned and reachable.
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS default_access_code TEXT,
  ADD COLUMN IF NOT EXISTS default_security_instructions TEXT;

COMMENT ON COLUMN properties.default_access_code
  IS 'Door / lift / mailbox code shown by default in viewing reminder emails when no per-room code exists.';
COMMENT ON COLUMN properties.default_security_instructions
  IS 'Free-text mailbox / parking / building-entry instructions shown in viewing reminder emails.';
