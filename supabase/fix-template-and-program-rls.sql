-- ============================================================
-- FIX: Missing INSERT RLS policies for coaches
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Programs table — coaches need INSERT
CREATE POLICY "Coach can insert programs"
  ON programs FOR INSERT
  WITH CHECK (coach_id = auth.uid());

-- 2. Program weeks — coaches need full CRUD via program ownership
-- First check if RLS is enabled
ALTER TABLE program_weeks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach can insert program_weeks"
  ON program_weeks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM programs WHERE programs.id = program_weeks.program_id AND programs.coach_id = auth.uid()
    )
  );

CREATE POLICY "Coach can select program_weeks"
  ON program_weeks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM programs WHERE programs.id = program_weeks.program_id AND (programs.coach_id = auth.uid() OR programs.client_id = auth.uid())
    )
  );

CREATE POLICY "Coach can delete program_weeks"
  ON program_weeks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM programs WHERE programs.id = program_weeks.program_id AND programs.coach_id = auth.uid()
    )
  );

-- 3. Program days
ALTER TABLE program_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach can insert program_days"
  ON program_days FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM program_weeks pw
      JOIN programs p ON p.id = pw.program_id
      WHERE pw.id = program_days.week_id AND p.coach_id = auth.uid()
    )
  );

CREATE POLICY "Coach can select program_days"
  ON program_days FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM program_weeks pw
      JOIN programs p ON p.id = pw.program_id
      WHERE pw.id = program_days.week_id AND (p.coach_id = auth.uid() OR p.client_id = auth.uid())
    )
  );

CREATE POLICY "Coach can delete program_days"
  ON program_days FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM program_weeks pw
      JOIN programs p ON p.id = pw.program_id
      WHERE pw.id = program_days.week_id AND p.coach_id = auth.uid()
    )
  );

-- 4. Program exercises
ALTER TABLE program_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach can insert program_exercises"
  ON program_exercises FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM program_days pd
      JOIN program_weeks pw ON pw.id = pd.week_id
      JOIN programs p ON p.id = pw.program_id
      WHERE pd.id = program_exercises.day_id AND p.coach_id = auth.uid()
    )
  );

CREATE POLICY "Coach can select program_exercises"
  ON program_exercises FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM program_days pd
      JOIN program_weeks pw ON pw.id = pd.week_id
      JOIN programs p ON p.id = pw.program_id
      WHERE pd.id = program_exercises.day_id AND (p.coach_id = auth.uid() OR p.client_id = auth.uid())
    )
  );

CREATE POLICY "Coach can delete program_exercises"
  ON program_exercises FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM program_days pd
      JOIN program_weeks pw ON pw.id = pd.week_id
      JOIN programs p ON p.id = pw.program_id
      WHERE pd.id = program_exercises.day_id AND p.coach_id = auth.uid()
    )
  );

-- 5. Exercises table — coaches need INSERT for AI-created exercises
-- (AI auto-creates exercises that don't exist yet)
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

-- Everyone can read exercises
CREATE POLICY "Anyone can view exercises"
  ON exercises FOR SELECT
  USING (true);

-- Coaches can insert new exercises
CREATE POLICY "Coach can insert exercises"
  ON exercises FOR INSERT
  WITH CHECK (true);

-- 6. Template tables — coaches need full CRUD
ALTER TABLE program_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach can manage own templates"
  ON program_templates FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

ALTER TABLE template_weeks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach can manage template_weeks"
  ON template_weeks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM program_templates pt WHERE pt.id = template_weeks.template_id AND pt.coach_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM program_templates pt WHERE pt.id = template_weeks.template_id AND pt.coach_id = auth.uid()
    )
  );

ALTER TABLE template_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach can manage template_days"
  ON template_days FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM template_weeks tw
      JOIN program_templates pt ON pt.id = tw.template_id
      WHERE tw.id = template_days.week_id AND pt.coach_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM template_weeks tw
      JOIN program_templates pt ON pt.id = tw.template_id
      WHERE tw.id = template_days.week_id AND pt.coach_id = auth.uid()
    )
  );

-- 7. Create template_exercises table if it doesn't exist
-- This stores the generated exercises per template day
CREATE TABLE IF NOT EXISTS template_exercises (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  day_id uuid NOT NULL REFERENCES template_days(id) ON DELETE CASCADE,
  exercise_name text NOT NULL,
  sets integer DEFAULT 3,
  reps text DEFAULT '8-10',
  weight_kg numeric DEFAULT NULL,
  rest_seconds integer DEFAULT 90,
  notes text DEFAULT NULL,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE template_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach can manage template_exercises"
  ON template_exercises FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM template_days td
      JOIN template_weeks tw ON tw.id = td.week_id
      JOIN program_templates pt ON pt.id = tw.template_id
      WHERE td.id = template_exercises.day_id AND pt.coach_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM template_days td
      JOIN template_weeks tw ON tw.id = td.week_id
      JOIN program_templates pt ON pt.id = tw.template_id
      WHERE td.id = template_exercises.day_id AND pt.coach_id = auth.uid()
    )
  );
