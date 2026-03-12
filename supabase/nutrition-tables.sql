-- Nutrition tracking tables
-- Run this in Supabase SQL Editor

-- Nutrition logs (meal entries)
CREATE TABLE IF NOT EXISTS nutrition_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('ontbijt', 'lunch', 'diner', 'snack')),
  name TEXT NOT NULL,
  calories INTEGER,
  protein_g NUMERIC(6,1),
  carbs_g NUMERIC(6,1),
  fat_g NUMERIC(6,1),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Nutrition targets (per user)
CREATE TABLE IF NOT EXISTS nutrition_targets (
  client_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  calories INTEGER DEFAULT 2500,
  protein_g INTEGER DEFAULT 180,
  carbs_g INTEGER DEFAULT 280,
  fat_g INTEGER DEFAULT 80,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for nutrition_logs
ALTER TABLE nutrition_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own nutrition logs"
  ON nutrition_logs FOR SELECT USING (auth.uid() = client_id);

CREATE POLICY "Users can insert own nutrition logs"
  ON nutrition_logs FOR INSERT WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Users can delete own nutrition logs"
  ON nutrition_logs FOR DELETE USING (auth.uid() = client_id);

CREATE POLICY "Coaches can view client nutrition"
  ON nutrition_logs FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM coach_client
      WHERE coach_client.coach_id = auth.uid()
      AND coach_client.client_id = nutrition_logs.client_id
    )
  );

-- RLS for nutrition_targets
ALTER TABLE nutrition_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own targets"
  ON nutrition_targets FOR SELECT USING (auth.uid() = client_id);

CREATE POLICY "Users can upsert own targets"
  ON nutrition_targets FOR INSERT WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Users can update own targets"
  ON nutrition_targets FOR UPDATE USING (auth.uid() = client_id);

-- Index for fast date lookups
CREATE INDEX IF NOT EXISTS idx_nutrition_logs_client_date
  ON nutrition_logs(client_id, date);
