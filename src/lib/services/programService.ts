/**
 * Program service — encapsulates all workout program database operations.
 */
import { createClient } from '@/lib/supabase/client'
import type { Program, ProgramWeek, WorkoutLog, ExerciseLog } from '@/types'

const supabase = createClient()

export const programService = {
  /**
   * Get the active program for a user with full nested structure.
   */
  async getActiveProgram(clientId: string): Promise<Program | null> {
    const { data, error } = await supabase
      .from('programs')
      .select(`*, program_weeks(*, program_days(*, program_exercises(*, exercises(*))))`)
      .eq('client_id', clientId)
      .eq('is_active', true)
      .order('start_date', { ascending: false })
      .limit(1)
      .single()

    if (error) return null
    return data
  },

  /**
   * Sort weeks, days, and exercises by their respective order fields.
   */
  sortProgramStructure(weeks: ProgramWeek[]): ProgramWeek[] {
    return weeks
      .sort((a, b) => a.week_number - b.week_number)
      .map(w => ({
        ...w,
        program_days: (w.program_days ?? [])
          .sort((a, b) => a.day_number - b.day_number)
          .map(d => ({
            ...d,
            program_exercises: (d.program_exercises ?? [])
              .sort((a, b) => a.order_index - b.order_index),
          })),
      }))
  },

  /**
   * Get completed workout log day IDs for a user+program.
   */
  async getCompletedDayIds(clientId: string, programId: string): Promise<Set<string>> {
    const { data } = await supabase
      .from('workout_logs')
      .select('day_id')
      .eq('client_id', clientId)
      .eq('program_id', programId)
      .not('completed_at', 'is', null)

    return new Set(
      data?.map(l => l.day_id).filter(Boolean) as string[] ?? []
    )
  },

  /**
   * Get today's active (unfinished) workout log.
   */
  async getActiveWorkoutLog(
    clientId: string,
    programId: string
  ): Promise<WorkoutLog | null> {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('workout_logs')
      .select('*')
      .eq('client_id', clientId)
      .eq('program_id', programId)
      .gte('logged_at', today)
      .is('completed_at', null)
      .order('logged_at', { ascending: false })
      .limit(1)
      .single()

    return data
  },

  /**
   * Create a new workout log entry.
   */
  async startWorkout(
    clientId: string,
    programId: string,
    dayId: string
  ): Promise<WorkoutLog | null> {
    const { data, error } = await supabase
      .from('workout_logs')
      .insert({ client_id: clientId, program_id: programId, day_id: dayId })
      .select()
      .single()

    if (error) {
      console.error('programService.startWorkout error:', error.message)
      return null
    }
    return data
  },

  /**
   * Complete a workout with a feeling rating.
   */
  async finishWorkout(logId: string, feeling: number): Promise<boolean> {
    const { error } = await supabase
      .from('workout_logs')
      .update({ feeling, completed_at: new Date().toISOString() })
      .eq('id', logId)

    if (error) {
      console.error('programService.finishWorkout error:', error.message)
      return false
    }
    return true
  },

  /**
   * Log a completed exercise set.
   */
  async logExerciseSet(params: {
    workoutLogId: string
    exerciseId: string
    programExerciseId: string
    setNumber: number
    weightKg: number | null
    repsCompleted: number | null
  }): Promise<boolean> {
    const { error } = await supabase
      .from('exercise_logs')
      .insert({
        workout_log_id: params.workoutLogId,
        exercise_id: params.exerciseId,
        program_exercise_id: params.programExerciseId,
        set_number: params.setNumber,
        weight_kg: params.weightKg,
        reps_completed: params.repsCompleted,
      })

    if (error) {
      console.error('programService.logExerciseSet error:', error.message)
      return false
    }
    return true
  },

  /**
   * Delete an exercise set log (for un-doing a set).
   */
  async deleteExerciseSet(
    workoutLogId: string,
    exerciseId: string,
    setNumber: number
  ): Promise<boolean> {
    const { error } = await supabase
      .from('exercise_logs')
      .delete()
      .eq('workout_log_id', workoutLogId)
      .eq('exercise_id', exerciseId)
      .eq('set_number', setNumber)

    if (error) {
      console.error('programService.deleteExerciseSet error:', error.message)
      return false
    }
    return true
  },

  /**
   * Get personal records (max weight per exercise) for a user.
   */
  async getPersonalRecords(clientId: string): Promise<Record<string, number>> {
    // Step 1: Get completed workout IDs for this client
    const { data: wlData } = await supabase
      .from('workout_logs')
      .select('id')
      .eq('client_id', clientId)
      .not('completed_at', 'is', null)

    const wlIds = wlData?.map(wl => wl.id) ?? []
    if (wlIds.length === 0) return {}

    // Step 2: Get exercise logs for those workouts
    const { data } = await supabase
      .from('exercise_logs')
      .select('exercise_id, weight_kg')
      .in('workout_log_id', wlIds)
      .not('weight_kg', 'is', null)
      .order('weight_kg', { ascending: false })

    const prMap: Record<string, number> = {}
    data?.forEach((log: any) => {
      const exerciseId = log.exercise_id
      const weight = log.weight_kg ?? 0
      if (!prMap[exerciseId] || weight > prMap[exerciseId]) {
        prMap[exerciseId] = weight
      }
    })
    return prMap
  },
}
