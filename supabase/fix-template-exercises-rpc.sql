-- ============================================================
-- RPC functions for template_exercises (bypasses PostgREST schema cache)
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Save exercises for a template day
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
  -- Delete existing exercises for this day
  DELETE FROM template_exercises WHERE day_id = p_day_id;

  -- Insert new exercises
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

-- 2. Load exercises for multiple template days
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
