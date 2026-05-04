-- Claims: house captain expense reimbursement requests
CREATE TABLE claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by UUID NOT NULL REFERENCES auth.users(id),
  property_id UUID NOT NULL REFERENCES properties(id),
  category TEXT NOT NULL CHECK (category IN (
    'PLUMBING', 'ELECTRICAL', 'CLEANING_SUPPLIES',
    'FURNITURE', 'TRANSPORT', 'OTHER'
  )),
  amount_sgd NUMERIC(10,2) NOT NULL CHECK (amount_sgd > 0),
  description TEXT NOT NULL,
  receipt_url TEXT NOT NULL,
  item_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN (
    'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID'
  )),
  admin_comment TEXT,
  payment_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  paid_at TIMESTAMPTZ
);

CREATE INDEX idx_claims_submitted_by ON claims (submitted_by, created_at DESC);
CREATE INDEX idx_claims_property_status ON claims (property_id, status);
CREATE INDEX idx_claims_status_created ON claims (status, created_at DESC);

CREATE TRIGGER trg_claims_updated_at
  BEFORE UPDATE ON claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
