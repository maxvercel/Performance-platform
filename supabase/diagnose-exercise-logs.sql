-- ============================================
-- DIAGNOSE: Waarom worden exercise_logs niet opgeslagen?
-- Voer elk blok apart uit in Supabase SQL Editor
-- ============================================

-- 1. Is RLS ingeschakeld op exercise_logs?
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'exercise_logs';
-- Als rowsecurity = false → RLS staat UIT en alles zou moeten werken
-- Als rowsecurity = true → check policies hieronder

-- 2. Welke RLS policies bestaan er op exercise_logs?
SELECT policyname, cmd, permissive, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'exercise_logs';

-- 3. Welke kolommen heeft exercise_logs?
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'exercise_logs'
ORDER BY ordinal_position;

-- 4. Hoeveel exercise_logs staan er al in de database?
SELECT count(*) as total_exercise_logs FROM exercise_logs;

-- 5. Hoeveel workout_logs staan er?
SELECT count(*) as total_workout_logs FROM workout_logs;

-- 6. Check of er workout_logs zonder exercise_logs zijn
SELECT wl.id, wl.client_id, wl.logged_at, wl.completed_at,
       (SELECT count(*) FROM exercise_logs el WHERE el.workout_log_id = wl.id) as exercise_count
FROM workout_logs wl
ORDER BY wl.logged_at DESC
LIMIT 10;
