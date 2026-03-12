-- ============================================
-- ADMIN RLS POLICIES
-- Geeft admin (jij) volledige leestoegang tot alle tabellen
-- Voer uit in Supabase SQL Editor
-- ============================================

-- 1. Admin kan ALLE profielen zien
CREATE POLICY "Admin can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 2. Admin kan ALLE workout_logs zien
CREATE POLICY "Admin can view all workout_logs" ON workout_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 3. Admin kan ALLE exercise_logs zien
CREATE POLICY "Admin can view all exercise_logs" ON exercise_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 4. Admin kan ALLE programma's zien
CREATE POLICY "Admin can view all programs" ON programs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 5. Admin kan ALLE coach_client relaties zien
CREATE POLICY "Admin can view all coach_client" ON coach_client
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 6. Stel jouw account in als admin (vervang EMAIL door je echte e-mailadres)
-- UPDATE profiles SET role = 'admin' WHERE email = 'maxtrentelmanarc@gmail.com';


-- ============================================
-- BACKUP STRATEGIE
-- ============================================

-- OPTIE 1: Automatische dagelijkse backups (AANBEVOLEN)
-- ─────────────────────────────────────────────
-- Supabase Pro plan ($25/maand) heeft automatische dagelijkse backups
-- met Point-in-Time Recovery (PITR) — je kunt terugdraaien naar elk moment.
-- Dit is veruit de beste optie voor productie.
--
-- Ga naar: Dashboard → Settings → Database → Backups
-- Daar kun je ook handmatige backups maken.

-- OPTIE 2: Handmatige export via pg_dump (gratis)
-- ─────────────────────────────────────────────
-- Draai dit commando lokaal (niet in SQL Editor):
--
--   pg_dump "postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres" \
--     --no-owner --no-privileges --clean --if-exists \
--     -f backup_$(date +%Y%m%d).sql
--
-- Je vindt je connection string in:
-- Dashboard → Settings → Database → Connection string → URI

-- OPTIE 3: Scheduled export via Supabase CLI
-- ─────────────────────────────────────────────
-- npx supabase db dump --project-ref feistonroxbcymscjobh -f backup.sql
-- (vereist supabase login)


-- ============================================
-- DATA VEILIGHEID CHECKLIST
-- ============================================

-- [x] RLS is ingeschakeld op alle tabellen
-- [x] Admin policies geven jou volledige leestoegang
-- [x] Coaches zien alleen hun eigen cliënten
-- [x] Cliënten zien alleen hun eigen data
-- [ ] Zet Supabase Pro aan voor automatische dagelijkse backups
-- [ ] Stel een wekelijkse pg_dump cron job in als extra beveiliging
-- [ ] Activeer Database Webhooks voor kritieke DELETE operaties (optioneel)


-- ============================================
-- VERIFY: Check alle RLS policies op alle tabellen
-- ============================================
SELECT schemaname, tablename, policyname, cmd, permissive, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
