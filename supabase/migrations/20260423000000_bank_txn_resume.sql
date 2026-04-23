-- Allow bank_transactions to be created without a batch (for Aspire direct-save)
ALTER TABLE bank_transactions ALTER COLUMN import_batch_id DROP NOT NULL;

-- Add unique index on reference for upsert deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_transactions_reference_unique
  ON bank_transactions (reference) WHERE reference IS NOT NULL;

-- Add room_id and transaction_type if not present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_transactions' AND column_name = 'room_id') THEN
    ALTER TABLE bank_transactions ADD COLUMN room_id UUID REFERENCES rooms(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_transactions' AND column_name = 'transaction_type') THEN
    ALTER TABLE bank_transactions ADD COLUMN transaction_type TEXT;
  END IF;
END $$;

-- Expand the status check to include UNTAGGED
ALTER TABLE bank_transactions DROP CONSTRAINT IF EXISTS bank_transactions_status_check;
ALTER TABLE bank_transactions ADD CONSTRAINT bank_transactions_status_check
  CHECK (status IN ('PENDING', 'UNTAGGED', 'AUTO_TAGGED', 'CONFIRMED', 'IGNORED'));
