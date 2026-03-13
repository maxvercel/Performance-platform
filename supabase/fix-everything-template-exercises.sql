-- ============================================================
-- COMPLETE FIX: Drop and recreate template_exercises + RPC functions
-- Run this ENTIRE script in Supabase SQL Editor in one go
-- ============================================================

-- 1. Drop existing RPC functions (if they exist)
DROP FUNCTION IF EXISTS save_template_exercises(uuid, jsonb);
DROP FUNCTION IF EXISTS get_template_exercises(uuid[]);

-- 2. Drop and recreate the table with correct schema
DROP TABLE IF EXISTS template_exercises CASCADE;

CREATE TABLE template_exercises (
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

-- 3. Enable RLS
ALTER TABLE template_exercises ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies (allow all for authenticated users via service role)
CREATE POLICY "template_exercises_select" ON template_exercises FOR SELECT USING (true);
CREATE POLICY "template_exercises_insert" ON template_exercises FOR INSERT WITH CHECK (true);
CREATE POLICY "template_exercises_update" ON template_exercises FOR UPDATE USING (true);
CREATE POLICY "template_exercises_delete" ON template_exercises FOR DELETE USING (true);

-- 5. Index for fast lookups
CREATE INDEX idx_template_exercises_day_id ON template_exercises(day_id);

-- 6. RPC: Save exercises for a template day
CREATE OR REPLACE FUNCTION save_template_exercises(
  p_day_id uuid,
  p_exercises jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ex jsonb;
  i integer := 0;
BEGIN
  DELETE FROM template_exercises WHERE day_id = p_day_id;

  FOR ex IN SELECT * FROM jsonb_array_elements(p_exercises)
  LOOP
    INSERT INTO template_exercises (day_id, exercise_name, sets, reps, weight_kg, rest_seconds, notes, order_index)
    VALUES (
      p_day_id,
      COALESCE(ex->>'name', 'Unnamed'),
      COALESCE((ex->>'sets')::integer, 3),
      COALESCE(ex->>'reps', '8-10'),
      CASE WHEN ex->>'weight_kg' IS NOT NULL AND ex->>'weight_kg' != 'null' THEN (ex->>'weight_kg')::numeric ELSE NULL END,
      COALESCE((ex->>'rest_seconds')::integer, 90),
      NULLIF(ex->>'notes', 'null'),
      i
    );
    i := i + 1;
  END LOOP;

  RETURN i;
END;
$$;

-- 7. RPC: Load exercises for multiple template days
CREATE OR REPLACE FUNCTION get_template_exercises(p_day_ids uuid[])
RETURNS TABLE (
  id uuid,
  day_id uuid,
  exercise_name text,
  sets integer,
  reps text,
  weight_kg numeric,
  rest_seconds integer,
  notes text,
  order_index integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
    SELECT te.id, te.day_id, te.exercise_name, te.sets, te.reps, te.weight_kg, te.rest_seconds, te.notes, te.order_index
    FROM template_exercises te
    WHERE te.day_id = ANY(p_day_ids)
    ORDER BY te.day_id, te.order_index;
END;
$$;

-- 8. Verify it worked
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'template_exercises' ORDER BY ordinal_position;
