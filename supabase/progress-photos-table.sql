-- Progress Photos table
-- Run this in Supabase SQL Editor to enable the progress photos feature

CREATE TABLE IF NOT EXISTS progress_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('front', 'side', 'back')),
  taken_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;

-- Clients can view their own photos
CREATE POLICY "Clients can view own photos"
  ON progress_photos FOR SELECT
  USING (auth.uid() = client_id);

-- Clients can insert their own photos
CREATE POLICY "Clients can insert own photos"
  ON progress_photos FOR INSERT
  WITH CHECK (auth.uid() = client_id);

-- Clients can delete their own photos
CREATE POLICY "Clients can delete own photos"
  ON progress_photos FOR DELETE
  USING (auth.uid() = client_id);

-- Coaches can view their clients' photos
CREATE POLICY "Coaches can view client photos"
  ON progress_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM coach_client
      WHERE coach_client.coach_id = auth.uid()
      AND coach_client.client_id = progress_photos.client_id
    )
  );

-- Create storage bucket for photos (run this separately if needed)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('progress-photos', 'progress-photos', true);

-- Storage policies
-- CREATE POLICY "Users can upload own photos" ON storage.objects
--   FOR INSERT WITH CHECK (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "Anyone can view photos" ON storage.objects
--   FOR SELECT USING (bucket_id = 'progress-photos');
