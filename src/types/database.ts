/**
 * Database types for the 9toFit Performance Platform.
 * These mirror the Supabase schema and replace all `any` types throughout the app.
 *
 * NOTE: For production, generate these automatically with:
 *   npx supabase gen types typescript --project-id feistonroxbcymscjobh > src/types/supabase.ts
 */

// ─── Core Entities ───────────────────────────────────────────────────────────

export type UserRole = 'client' | 'coach' | 'admin'

export interface Profile {
  id: string
  email?: string
  full_name: string | null
  role: UserRole
  phone: string | null
  birthdate: string | null
  created_at: string
}

export interface Exercise {
  id: string
  name: string
  muscle_group: MuscleGroup
  category: string
  is_global: boolean
  description?: string | null
  illustration_url?: string | null
}

export type MuscleGroup =
  | 'Borst'
  | 'Rug'
  | 'Benen'
  | 'Schouders'
  | 'Armen'
  | 'Core'
  | 'Billen'
  | 'general'
  | 'Overig'

// ─── Programs ────────────────────────────────────────────────────────────────

export interface Program {
  id: string
  client_id: string
  coach_id?: string
  name: string
  goal?: string
  start_date: string
  end_date?: string | null
  is_active: boolean
  created_at?: string
  program_weeks?: ProgramWeek[]
}

export interface ProgramWeek {
  id: string
  program_id: string
  week_number: number
  label?: string
  program_days?: ProgramDay[]
}

export interface ProgramDay {
  id: string
  week_id: string
  day_number: number
  label: string
  rest_day: boolean
  program_exercises?: ProgramExercise[]
}

export interface ProgramExercise {
  id: string
  day_id: string
  exercise_id: string
  sets: number
  reps: string
  weight_kg: number | null
  rest_seconds: number | null
  tempo: string | null
  notes: string | null
  order_index: number
  exercises?: Exercise
}

// ─── Workout Logging ─────────────────────────────────────────────────────────

export interface WorkoutLog {
  id: string
  client_id: string
  program_id: string
  day_id: string | null
  logged_at: string
  completed_at: string | null
  feeling: number | null
  program_days?: Pick<ProgramDay, 'label'>
  programs?: Pick<Program, 'name'>
}

export interface ExerciseLog {
  id: string
  workout_log_id: string
  exercise_id: string
  program_exercise_id: string | null
  set_number: number
  weight_kg: number | null
  reps_completed: number | null
  reps?: number | null
  logged_at?: string
  exercises?: Exercise
  workout_logs?: Pick<WorkoutLog, 'logged_at' | 'client_id' | 'completed_at'>
}

// ─── Progress & Metrics ──────────────────────────────────────────────────────

export interface ProgressMetric {
  id: string
  client_id: string
  weight_kg: number
  logged_at: string
}

// ─── Habits ──────────────────────────────────────────────────────────────────

export type HabitCategory =
  | 'water'
  | 'steps'
  | 'sleep'
  | 'mobility'
  | 'supplements'
  | 'nutrition'

export interface Habit {
  id: string
  client_id: string
  name: string
  category: HabitCategory
  description: string | null
  target_value: number | null
  target_unit: string | null
  active: boolean
  created_at: string
}

export interface HabitLog {
  id: string
  habit_id: string
  client_id: string
  date: string
  completed: boolean
  value: number | null
}

// ─── Coach ───────────────────────────────────────────────────────────────────

export interface CoachClient {
  coach_id: string
  client_id: string
  active: boolean
}

export interface Message {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  read_at: string | null
  created_at: string
}

// ─── Derived / View Types ────────────────────────────────────────────────────

/** Used in the workout page for tracking sets in-progress */
export interface SetLog {
  weight: string
  reps: string
  done: boolean
}

/** Used in the workout page for previous session comparison */
export interface PreviousLog {
  exercise_id: string
  weight_kg: number | null
  reps_completed: number | null
  workout_logs?: {
    logged_at: string
  }
}

/** Enriched client data for coach dashboard */
export interface EnrichedClient extends Profile {
  lastWorkout: string | null
  activeProgram: Pick<Program, 'id' | 'name' | 'start_date'> | null
  daysLeft: number | null
  unread: number
  sparkline: number[]
  compliance: number
}

/** Completed workout recap structure */
export interface WorkoutRecap {
  log: WorkoutLog
  exerciseGroups: ExerciseGroup[]
  totalVolume: number
  totalSets: number
}

export interface ExerciseGroup {
  exercise: Exercise | null
  sets: ExerciseLog[]
  maxWeight: number
}

/** Personal record entry for the records page */
export interface PersonalRecord {
  id: string
  name: string
  muscleGroup: string
  prs: PREntry[]
  currentMax: number
  currentMaxReps: number
  firstWeight: number | null
  rank: RankInfo
  estMax1RM: number
  improvementPct: number
}

export interface PREntry {
  weight: number
  reps: number
  date: string
  improvement: number
}

export interface RankInfo {
  id: string
  name: string
  minPRs: number
  minPct: number
  g1: string
  g2: string
  outline: string
  textColor: string
}
