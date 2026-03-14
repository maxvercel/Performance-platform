-- ============================================
-- Client Features (per-client feature toggles)
-- Run this in Supabase SQL Editor
-- ============================================

-- Feature toggles per client (e.g. nutrition, habits, etc.)
CREATE TABLE IF NOT EXISTS client_features (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  feature text NOT NULL,
  enabled boolean DEFAULT false NOT NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_id, feature)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_client_features_client ON client_features(client_id);
CREATE INDEX IF NOT EXISTS idx_client_features_lookup ON client_features(client_id, feature);

-- RLS
ALTER TABLE client_features ENABLE ROW LEVEL SECURITY;

-- Clients can read their own feature flags
CREATE POLICY "Users can read own features"
  ON client_features FOR SELECT
  USING (auth.uid() = client_id);

-- Coaches can read features of their clients
CREATE POLICY "Coaches can read client features"
  ON client_features FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM coach_client
      WHERE coach_client.coach_id = auth.uid()
      AND coach_client.client_id = client_features.client_id
      AND coach_client.active = true
    )
  );

-- Service role can insert/update (via API route)
CREATE POLICY "Service can manage features"
  ON client_features FOR ALL
  USING (true)
  WITH CHECK (true);

-- Also: allow admin to update any profile role
-- (needed for the role-change feature in admin panel)
CREATE POLICY "Admin can update profiles"
  ON profiles FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
