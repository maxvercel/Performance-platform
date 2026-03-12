-- Fix: Add missing RLS policies for coaches on programs table
-- Coaches need DELETE, UPDATE, INSERT, SELECT on programs they created

-- Allow coaches to delete programs they created
CREATE POLICY "Coach can delete own programs"
  ON programs FOR DELETE
  USING (coach_id = auth.uid());

-- Allow coaches to update programs they created (for toggling is_active)
CREATE POLICY "Coach can update own programs"
  ON programs FOR UPDATE
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- Allow coaches to select programs they created
CREATE POLICY "Coach can view own programs"
  ON programs FOR SELECT
  USING (coach_id = auth.uid());

-- Allow clients to select their own programs
CREATE POLICY "Client can view own programs"
  ON programs FOR SELECT
  USING (client_id = auth.uid());
