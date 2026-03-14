-- ============================================
-- FIX 1: Progress Photos Storage Bucket + Policies
-- ============================================

-- Create the storage bucket (skip if exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('progress-photos', 'progress-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies if any
DROP POLICY IF EXISTS "Users can upload own photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view photos" ON storage.objects;

-- Users can upload photos to their own folder
CREATE POLICY "Users can upload own photos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'progress-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can update their own photos
CREATE POLICY "Users can update own photos" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'progress-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own photos
CREATE POLICY "Users can delete own photos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'progress-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Anyone can view photos (public bucket)
CREATE POLICY "Anyone can view photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'progress-photos');

-- ============================================
-- FIX 2: Ensure client_features table + policies
-- ============================================

CREATE TABLE IF NOT EXISTS client_features (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  feature text NOT NULL,
  enabled boolean DEFAULT false NOT NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_id, feature)
);

CREATE INDEX IF NOT EXISTS idx_client_features_client ON client_features(client_id);

ALTER TABLE client_features ENABLE ROW LEVEL SECURITY;

-- Drop and recreate all policies cleanly
DROP POLICY IF EXISTS "Users can read own features" ON client_features;
DROP POLICY IF EXISTS "Coaches can read client features" ON client_features;
DROP POLICY IF EXISTS "Coaches can insert client features" ON client_features;
DROP POLICY IF EXISTS "Coaches can update client features" ON client_features;
DROP POLICY IF EXISTS "Admins can manage all features" ON client_features;
DROP POLICY IF EXISTS "Service can manage features" ON client_features;

CREATE POLICY "Users can read own features"
  ON client_features FOR SELECT
  USING (auth.uid() = client_id);

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

CREATE POLICY "Admins can manage all features"
  ON client_features FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- FIX 3: Admin can update profile roles
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admin can update profiles' AND tablename = 'profiles'
  ) THEN
    EXECUTE 'CREATE POLICY "Admin can update profiles" ON profiles FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = ''admin'')) WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = ''admin''))';
  END IF;
END $$;
