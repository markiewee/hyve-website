-- Hyve IoT Tenant Portal — Initial Schema
-- Mirrored from Millia Supabase
CREATE TABLE properties (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE
);

CREATE TABLE rooms (
  id UUID PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES properties(id),
  name TEXT NOT NULL,
  unit_code TEXT NOT NULL UNIQUE
);

-- Device authentication keys
CREATE TABLE device_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) UNIQUE,
  api_key TEXT NOT NULL UNIQUE,
  ac_threshold DECIMAL NOT NULL DEFAULT 0.5,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AC runtime events from RPi devices
CREATE TABLE ac_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id),
  state TEXT NOT NULL CHECK (state IN ('ON', 'OFF')),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL CHECK (source IN ('STATE_CHANGE', 'HEARTBEAT'))
);

CREATE INDEX idx_ac_events_room_timestamp ON ac_events (room_id, timestamp);

-- Monthly usage summaries for billing
CREATE TABLE ac_monthly_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id),
  month DATE NOT NULL,
  total_hours DECIMAL NOT NULL DEFAULT 0,
  free_hours DECIMAL NOT NULL DEFAULT 300,
  overage_hours DECIMAL GENERATED ALWAYS AS (GREATEST(total_hours - free_hours, 0)) STORED,
  stripe_invoice_id TEXT,
  stripe_hosted_url TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'INVOICED', 'PAID')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_id, month)
);

-- Tenant profiles linked to auth
CREATE TABLE tenant_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  room_id UUID NOT NULL REFERENCES rooms(id),
  property_id UUID NOT NULL REFERENCES properties(id),
  role TEXT NOT NULL DEFAULT 'TENANT' CHECK (role IN ('TENANT', 'HOUSE_CAPTAIN', 'ADMIN')),
  invite_token TEXT UNIQUE,
  invite_expires_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  moved_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  moved_out_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Maintenance tickets
CREATE TABLE maintenance_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id),
  property_id UUID NOT NULL REFERENCES properties(id),
  submitted_by UUID NOT NULL REFERENCES auth.users(id),
  category TEXT NOT NULL CHECK (category IN ('AC', 'PLUMBING', 'ELECTRICAL', 'FURNITURE', 'CLEANING', 'OTHER')),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED')),
  assigned_to UUID REFERENCES auth.users(id),
  resolved_by UUID REFERENCES auth.users(id),
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_maintenance_tickets_property_status ON maintenance_tickets (property_id, status);

-- Multiple photos per ticket
CREATE TABLE ticket_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES maintenance_tickets(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Device health monitoring
CREATE TABLE device_status (
  room_id UUID PRIMARY KEY REFERENCES rooms(id),
  last_heartbeat TIMESTAMPTZ NOT NULL,
  last_state TEXT NOT NULL CHECK (last_state IN ('ON', 'OFF')),
  wifi_rssi INT,
  uptime_seconds INT
);

-- Auto-update updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ac_monthly_usage_updated_at
  BEFORE UPDATE ON ac_monthly_usage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_maintenance_tickets_updated_at
  BEFORE UPDATE ON maintenance_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_tenant_profiles_updated_at
  BEFORE UPDATE ON tenant_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS Policies
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE ac_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ac_monthly_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_keys ENABLE ROW LEVEL SECURITY;

-- Public read for properties and rooms (authenticated users)
CREATE POLICY "Authenticated users read properties"
  ON properties FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users read rooms"
  ON rooms FOR SELECT
  USING (auth.role() = 'authenticated');

-- Tenant policies
CREATE POLICY "Tenants read own ac_events"
  ON ac_events FOR SELECT
  USING (room_id IN (
    SELECT room_id FROM tenant_profiles
    WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Tenants read own ac_monthly_usage"
  ON ac_monthly_usage FOR SELECT
  USING (room_id IN (
    SELECT room_id FROM tenant_profiles
    WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Tenants read own tickets"
  ON maintenance_tickets FOR SELECT
  USING (submitted_by = auth.uid());

CREATE POLICY "Tenants create tickets"
  ON maintenance_tickets FOR INSERT
  WITH CHECK (submitted_by = auth.uid());

CREATE POLICY "Tenants read own ticket photos"
  ON ticket_photos FOR SELECT
  USING (ticket_id IN (
    SELECT id FROM maintenance_tickets WHERE submitted_by = auth.uid()
  ));

CREATE POLICY "Tenants insert ticket photos"
  ON ticket_photos FOR INSERT
  WITH CHECK (ticket_id IN (
    SELECT id FROM maintenance_tickets WHERE submitted_by = auth.uid()
  ));

CREATE POLICY "Users read own profile"
  ON tenant_profiles FOR SELECT
  USING (user_id = auth.uid());

-- House Captain policies
CREATE POLICY "Captains read property ac_events"
  ON ac_events FOR SELECT
  USING (room_id IN (
    SELECT r.id FROM rooms r
    JOIN tenant_profiles tp ON tp.property_id = r.property_id
    WHERE tp.user_id = auth.uid() AND tp.role = 'HOUSE_CAPTAIN' AND tp.is_active = true
  ));

CREATE POLICY "Captains read property ac_monthly_usage"
  ON ac_monthly_usage FOR SELECT
  USING (room_id IN (
    SELECT r.id FROM rooms r
    JOIN tenant_profiles tp ON tp.property_id = r.property_id
    WHERE tp.user_id = auth.uid() AND tp.role = 'HOUSE_CAPTAIN' AND tp.is_active = true
  ));

CREATE POLICY "Captains read property tickets"
  ON maintenance_tickets FOR SELECT
  USING (property_id IN (
    SELECT property_id FROM tenant_profiles
    WHERE user_id = auth.uid() AND role = 'HOUSE_CAPTAIN' AND is_active = true
  ));

CREATE POLICY "Captains update property tickets"
  ON maintenance_tickets FOR UPDATE
  USING (property_id IN (
    SELECT property_id FROM tenant_profiles
    WHERE user_id = auth.uid() AND role = 'HOUSE_CAPTAIN' AND is_active = true
  ));

CREATE POLICY "Captains read property ticket photos"
  ON ticket_photos FOR SELECT
  USING (ticket_id IN (
    SELECT id FROM maintenance_tickets WHERE property_id IN (
      SELECT property_id FROM tenant_profiles
      WHERE user_id = auth.uid() AND role = 'HOUSE_CAPTAIN' AND is_active = true
    )
  ));

CREATE POLICY "Captains read property profiles"
  ON tenant_profiles FOR SELECT
  USING (property_id IN (
    SELECT property_id FROM tenant_profiles
    WHERE user_id = auth.uid() AND role = 'HOUSE_CAPTAIN' AND is_active = true
  ));

-- Admin policies (full access)
CREATE POLICY "Admin full access ac_events"
  ON ac_events FOR ALL
  USING (EXISTS (
    SELECT 1 FROM tenant_profiles
    WHERE user_id = auth.uid() AND role = 'ADMIN' AND is_active = true
  ));

CREATE POLICY "Admin full access ac_monthly_usage"
  ON ac_monthly_usage FOR ALL
  USING (EXISTS (
    SELECT 1 FROM tenant_profiles
    WHERE user_id = auth.uid() AND role = 'ADMIN' AND is_active = true
  ));

CREATE POLICY "Admin full access maintenance_tickets"
  ON maintenance_tickets FOR ALL
  USING (EXISTS (
    SELECT 1 FROM tenant_profiles
    WHERE user_id = auth.uid() AND role = 'ADMIN' AND is_active = true
  ));

CREATE POLICY "Admin full access ticket_photos"
  ON ticket_photos FOR ALL
  USING (EXISTS (
    SELECT 1 FROM tenant_profiles
    WHERE user_id = auth.uid() AND role = 'ADMIN' AND is_active = true
  ));

CREATE POLICY "Admin full access tenant_profiles"
  ON tenant_profiles FOR ALL
  USING (EXISTS (
    SELECT 1 FROM tenant_profiles
    WHERE user_id = auth.uid() AND role = 'ADMIN' AND is_active = true
  ));

CREATE POLICY "Admin full access device_status"
  ON device_status FOR ALL
  USING (EXISTS (
    SELECT 1 FROM tenant_profiles
    WHERE user_id = auth.uid() AND role = 'ADMIN' AND is_active = true
  ));

CREATE POLICY "Admin full access device_keys"
  ON device_keys FOR ALL
  USING (EXISTS (
    SELECT 1 FROM tenant_profiles
    WHERE user_id = auth.uid() AND role = 'ADMIN' AND is_active = true
  ));

-- Seed properties
INSERT INTO properties (id, name, code) VALUES
  ('d3e7e40f-a32c-4c8e-a54f-59e8f9cbc4a6', 'Thomson Grove 588', 'TG'),
  ('358c5333-00fd-4efb-b330-3d6e131e9b10', 'Ivory Heights 122', 'IH'),
  ('1d1cff29-0542-4520-bcf7-dfe0f7e8cb48', 'Chiltern Park 135', 'CP');
