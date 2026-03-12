-- ============================================================
-- 9toFit Performance Platform — Readiness & RPE Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- ─── 1. Daily Readiness Check-in Table ──────────────────────
CREATE TABLE IF NOT EXISTS daily_readiness (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id    uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  date         date NOT NULL DEFAULT CURRENT_DATE,
  sleep_hours  numeric(3,1),
  sleep_quality integer CHECK (sleep_quality BETWEEN 1 AND 5),
  energy_level  integer CHECK (energy_level BETWEEN 1 AND 5),
  stress_level  integer CHECK (stress_level BETWEEN 1 AND 5),
  muscle_soreness integer CHECK (muscle_soreness BETWEEN 1 AND 5),
  motivation    integer CHECK (motivation BETWEEN 1 AND 5),
  notes         text,
  readiness_score numeric(3,1),
  created_at   timestamptz DEFAULT now(),
  UNIQUE (client_id, date)
);

-- ─── 2. Add RPE column to exercise_logs ─────────────────────
ALTER TABLE exercise_logs
  ADD COLUMN IF NOT EXISTS rpe numeric(3,1) CHECK (rpe >= 1 AND rpe <= 10);

-- ─── 3. RLS Policies for daily_readiness ────────────────────
ALTER TABLE daily_readiness ENABLE ROW LEVEL SECURITY;

-- Users can read their own readiness data
CREATE POLICY "Users can read own readiness"
  ON daily_readiness FOR SELECT
  USING (auth.uid() = client_id);

-- Users can insert their own readiness data
CREATE POLICY "Users can insert own readiness"
  ON daily_readiness FOR INSERT
  WITH CHECK (auth.uid() = client_id);

-- Users can update their own readiness data
CREATE POLICY "Users can update own readiness"
  ON daily_readiness FOR UPDATE
  USING (auth.uid() = client_id);

-- Coaches can read their clients' readiness data
CREATE POLICY "Coaches can read client readiness"
  ON daily_readiness FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM coach_client
      WHERE coach_id = auth.uid()
        AND client_id = daily_readiness.client_id
        AND active = true
    )
  );

-- ─── 4. Index for fast lookups ──────────────────────────────
CREATE INDEX IF NOT EXISTS idx_daily_readiness_client_date
  ON daily_readiness (client_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_exercise_logs_rpe
  ON exercise_logs (rpe) WHERE rpe IS NOT NULL;
