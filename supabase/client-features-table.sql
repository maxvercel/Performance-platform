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

-- Coaches can insert features for their clients
CREATE POLICY "Coaches can insert client features"
  ON client_features FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coach_client
      WHERE coach_client.coach_id = auth.uid()
      AND coach_client.client_id = client_features.client_id
      AND coach_client.active = true
    )
  );

-- Coaches can update features for their clients
CREATE POLICY "Coaches can update client features"
  ON client_features FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM coach_client
      WHERE coach_client.coach_id = auth.uid()
      AND coach_client.client_id = client_features.client_id
      AND coach_client.active = true
    )
  );

-- Admins can do everything with features
CREATE POLICY "Admins can manage all features"
  ON client_features FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Allow admin to update any profile role
-- (needed for the role-change feature in admin panel)
-- NOTE: Check if this policy already exists before running
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admin can update profiles' AND tablename = 'profiles'
  ) THEN
    CREATE POLICY "Admin can update profiles"
      ON profiles FOR UPDATE
      USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;
