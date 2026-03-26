-- Hyve Smart Expense Import — Staging & Tagging Tables

-- import_batches must be created first as bank_transactions references it
CREATE TABLE import_batches (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename            TEXT,
  source              TEXT DEFAULT 'CSV',
  row_count           INT DEFAULT 0,
  auto_tagged_count   INT DEFAULT 0,
  confirmed_count     INT DEFAULT 0,
  status              TEXT DEFAULT 'PROCESSING' CHECK (status IN ('PROCESSING', 'REVIEWING', 'COMPLETE')),
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE bank_transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id     UUID NOT NULL REFERENCES import_batches(id),
  transaction_date    DATE NOT NULL,
  description         TEXT NOT NULL,
  amount              NUMERIC(12,2) NOT NULL,
  currency            TEXT DEFAULT 'SGD',
  reference           TEXT,
  property_id         UUID REFERENCES properties(id),
  category            TEXT,
  status              TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'AUTO_TAGGED', 'CONFIRMED', 'IGNORED')),
  confidence          NUMERIC(3,2) DEFAULT 0,
  matched_rule_id     UUID,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tagging_rules (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_pattern      TEXT NOT NULL,
  property_id         UUID REFERENCES properties(id),
  category            TEXT NOT NULL,
  hit_count           INT DEFAULT 1,
  last_used_at        TIMESTAMPTZ DEFAULT now(),
  created_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE (vendor_pattern, property_id, category)
);

-- Indexes
CREATE INDEX idx_bank_transactions_status         ON bank_transactions (status);
CREATE INDEX idx_bank_transactions_import_batch   ON bank_transactions (import_batch_id);
CREATE INDEX idx_tagging_rules_vendor_pattern     ON tagging_rules (vendor_pattern);

-- RLS — admin-only access on all three tables
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access bank_transactions" ON bank_transactions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM tenant_profiles
    WHERE user_id = auth.uid() AND role = 'ADMIN' AND is_active = true
  ));

ALTER TABLE tagging_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access tagging_rules" ON tagging_rules FOR ALL
  USING (EXISTS (
    SELECT 1 FROM tenant_profiles
    WHERE user_id = auth.uid() AND role = 'ADMIN' AND is_active = true
  ));

ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access import_batches" ON import_batches FOR ALL
  USING (EXISTS (
    SELECT 1 FROM tenant_profiles
    WHERE user_id = auth.uid() AND role = 'ADMIN' AND is_active = true
  ));
