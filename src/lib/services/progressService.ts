/**
 * Progress service — encapsulates weight tracking and workout history operations.
 */
import { createClient } from '@/lib/supabase/client'
import type { ProgressMetric, WorkoutLog } from '@/types'

const supabase = createClient()

export const progressService = {
  /**
   * Get recent weight measurements.
   */
  async getWeightHistory(clientId: string, limit = 30): Promise<ProgressMetric[]> {
    const { data, error } = await supabase
      .from('progress_metrics')
      .select('logged_at, weight_kg')
      .eq('client_id', clientId)
      .order('logged_at', { ascending: true })
      .limit(limit)

    if (error) {
      console.error('progressService.getWeightHistory error:', error.message)
      return []
    }
    return (data ?? []) as ProgressMetric[]
  },

  /**
   * Log a new weight measurement.
   */
  async logWeight(clientId: string, weightKg: number): Promise<boolean> {
    const { error } = await supabase
      .from('progress_metrics')
      .insert({
        client_id: clientId,
        weight_kg: weightKg,
        logged_at: new Date().toISOString().split('T')[0],
      })

    if (error) {
      console.error('progressService.logWeight error:', error.message)
      return false
    }
    return true
  },

  /**
   * Get completed workout logs ordered by date (newest first).
   */
  async getCompletedWorkouts(clientId: string): Promise<WorkoutLog[]> {
    const { data, error } = await supabase
      .from('workout_logs')
      .select('logged_at')
      .eq('client_id', clientId)
      .not('completed_at', 'is', null)
      .order('logged_at', { ascending: false })

    if (error) {
      console.error('progressService.getCompletedWorkouts error:', error.message)
      return []
    }
    return (data ?? []) as WorkoutLog[]
  },
}
