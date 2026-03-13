-- Migration: Add superset_group columns and update RPC functions
-- Description: Adds superset grouping functionality to template and program exercises

-- Add superset_group column to template_exercises table
ALTER TABLE template_exercises
ADD COLUMN superset_group TEXT NULL;

-- Add superset_group column to program_exercises table
ALTER TABLE program_exercises
ADD COLUMN superset_group TEXT NULL;

-- Update the save_template_exercises RPC function to handle superset_group
CREATE OR REPLACE FUNCTION save_template_exercises(
  p_template_id UUID,
  p_exercises JSONB
)
RETURNS TABLE (
  id UUID,
  template_id UUID,
  exercise_id UUID,
  "order" INT,
  sets INT,
  reps INT,
  weight NUMERIC,
  notes TEXT,
  superset_group TEXT
) AS $$
BEGIN
  -- Delete existing exercises for this template
  DELETE FROM template_exercises WHERE template_id = p_template_id;

  -- Insert new exercises from the provided JSON array
  RETURN QUERY
  INSERT INTO template_exercises (
    template_id,
    exercise_id,
    "order",
    sets,
    reps,
    weight,
    notes,
    superset_group
  )
  SELECT
    p_template_id,
    (exercise->>'exercise_id')::UUID,
    (exercise->>'order')::INT,
    (exercise->>'sets')::INT,
    (exercise->>'reps')::INT,
    (exercise->>'weight')::NUMERIC,
    exercise->>'notes',
    exercise->>'superset_group'
  FROM jsonb_array_elements(p_exercises) AS exercise
  RETURNING
    template_exercises.id,
    template_exercises.template_id,
    template_exercises.exercise_id,
    template_exercises."order",
    template_exercises.sets,
    template_exercises.reps,
    template_exercises.weight,
    template_exercises.notes,
    template_exercises.superset_group;
END;
$$ LANGUAGE plpgsql;

-- Update the get_template_exercises RPC function to return superset_group
CREATE OR REPLACE FUNCTION get_template_exercises(
  p_template_id UUID
)
RETURNS TABLE (
  id UUID,
  template_id UUID,
  exercise_id UUID,
  exercise_name TEXT,
  "order" INT,
  sets INT,
  reps INT,
  weight NUMERIC,
  notes TEXT,
  superset_group TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    te.id,
    te.template_id,
    te.exercise_id,
    e.name,
    te."order",
    te.sets,
    te.reps,
    te.weight,
    te.notes,
    te.superset_group
  FROM template_exercises te
  LEFT JOIN exercises e ON te.exercise_id = e.id
  WHERE te.template_id = p_template_id
  ORDER BY te."order" ASC;
END;
$$ LANGUAGE plpgsql;

-- Verification: Check that columns were added successfully
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'template_exercises' AND column_name = 'superset_group'
  ) THEN
    RAISE NOTICE 'Successfully added superset_group column to template_exercises table';
  ELSE
    RAISE WARNING 'Failed to add superset_group column to template_exercises table';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'program_exercises' AND column_name = 'superset_group'
  ) THEN
    RAISE NOTICE 'Successfully added superset_group column to program_exercises table';
  ELSE
    RAISE WARNING 'Failed to add superset_group column to program_exercises table';
  END IF;

  RAISE NOTICE 'Migration completed: Superset group functionality added to tables and RPC functions';
END $$;
