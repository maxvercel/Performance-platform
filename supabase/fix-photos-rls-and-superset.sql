-- ============================================================
-- FIX 1: Progress photos RLS policies
-- ============================================================

-- Enable RLS if not already enabled
ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "progress_photos_select" ON progress_photos;
DROP POLICY IF EXISTS "progress_photos_insert" ON progress_photos;
DROP POLICY IF EXISTS "progress_photos_delete" ON progress_photos;

-- Users can view their own photos
CREATE POLICY "progress_photos_select" ON progress_photos
  FOR SELECT USING (client_id = auth.uid());

-- Users can upload their own photos
CREATE POLICY "progress_photos_insert" ON progress_photos
  FOR INSERT WITH CHECK (client_id = auth.uid());

-- Users can delete their own photos
CREATE POLICY "progress_photos_delete" ON progress_photos
  FOR DELETE USING (client_id = auth.uid());

-- Also allow coaches to view their clients' photos
CREATE POLICY "progress_photos_coach_select" ON progress_photos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM coach_client
      WHERE coach_client.coach_id = auth.uid()
      AND coach_client.client_id = progress_photos.client_id
      AND coach_client.active = true
    )
  );

-- ============================================================
-- FIX 2: Add superset_group column to both tables
-- ============================================================

ALTER TABLE template_exercises ADD COLUMN IF NOT EXISTS superset_group TEXT DEFAULT NULL;
ALTER TABLE program_exercises ADD COLUMN IF NOT EXISTS superset_group TEXT DEFAULT NULL;

-- ============================================================
-- FIX 3: Update RPC functions to include superset_group
-- ============================================================

DROP FUNCTION IF EXISTS save_template_exercises(uuid, jsonb);
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
    INSERT INTO template_exercises (day_id, exercise_name, sets, reps, weight_kg, rest_seconds, notes, order_index, superset_group)
    VALUES (
      p_day_id,
      COALESCE(ex->>'name', 'Unnamed'),
      COALESCE((ex->>'sets')::integer, 3),
      COALESCE(ex->>'reps', '8-10'),
      CASE WHEN ex->>'weight_kg' IS NOT NULL AND ex->>'weight_kg' != 'null' THEN (ex->>'weight_kg')::numeric ELSE NULL END,
      COALESCE((ex->>'rest_seconds')::integer, 90),
      NULLIF(ex->>'notes', 'null'),
      i,
      NULLIF(ex->>'superset_group', 'null')
    );
    i := i + 1;
  END LOOP;
  RETURN i;
END;
$$;

DROP FUNCTION IF EXISTS get_template_exercises(uuid[]);
CREATE OR REPLACE FUNCTION get_template_exercises(p_day_ids uuid[])
RETURNS TABLE (
  id uuid, day_id uuid, exercise_name text, sets integer, reps text,
  weight_kg numeric, rest_seconds integer, notes text, order_index integer, superset_group text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
    SELECT te.id, te.day_id, te.exercise_name, te.sets, te.reps, te.weight_kg, te.rest_seconds, te.notes, te.order_index, te.superset_group
    FROM template_exercises te
    WHERE te.day_id = ANY(p_day_ids)
    ORDER BY te.day_id, te.order_index;
END;
$$;

-- ============================================================
-- VERIFY
-- ============================================================
SELECT 'progress_photos policies' as check_type, count(*) as count
FROM pg_policies WHERE tablename = 'progress_photos'
UNION ALL
SELECT 'template_exercises.superset_group' as check_type, count(*)
FROM information_schema.columns WHERE table_name = 'template_exercises' AND column_name = 'superset_group'
UNION ALL
SELECT 'program_exercises.superset_group' as check_type, count(*)
FROM information_schema.columns WHERE table_name = 'program_exercises' AND column_name = 'superset_group';
