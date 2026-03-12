-- ============================================
-- FIX: RLS Policies for exercise_logs table
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================

-- 1. Check if RLS is enabled on exercise_logs
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'exercise_logs';

-- 2. Check existing policies
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'exercise_logs';

-- 3. Enable RLS if not already enabled
ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;

-- 4. Allow authenticated users to SELECT their own exercise logs
-- (via workout_logs join to match client_id)
CREATE POLICY IF NOT EXISTS "Users can view own exercise logs" ON exercise_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workout_logs
      WHERE workout_logs.id = exercise_logs.workout_log_id
      AND workout_logs.client_id = auth.uid()
    )
  );

-- 5. Allow authenticated users to INSERT their own exercise logs
-- (the workout_log must belong to them)
CREATE POLICY IF NOT EXISTS "Users can insert own exercise logs" ON exercise_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_logs
      WHERE workout_logs.id = exercise_logs.workout_log_id
      AND workout_logs.client_id = auth.uid()
    )
  );

-- 6. Allow authenticated users to DELETE their own exercise logs
CREATE POLICY IF NOT EXISTS "Users can delete own exercise logs" ON exercise_logs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workout_logs
      WHERE workout_logs.id = exercise_logs.workout_log_id
      AND workout_logs.client_id = auth.uid()
    )
  );

-- 7. Allow coaches to view their clients' exercise logs
CREATE POLICY IF NOT EXISTS "Coaches can view client exercise logs" ON exercise_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workout_logs wl
      JOIN coach_client cc ON cc.client_id = wl.client_id
      WHERE wl.id = exercise_logs.workout_log_id
      AND cc.coach_id = auth.uid()
      AND cc.active = true
    )
  );

-- ============================================
-- VERIFY: Check the exercise_logs columns exist
-- ============================================
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'exercise_logs'
ORDER BY ordinal_position;

-- ============================================
-- VERIFY: Check foreign key from exercise_logs → workout_logs
-- ============================================
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'exercise_logs'
  AND tc.constraint_type = 'FOREIGN KEY';
