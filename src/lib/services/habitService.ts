/**
 * Habit service — encapsulates all habit-related database operations.
 */
import { createClient } from '@/lib/supabase/client'
import type { Habit, HabitLog } from '@/types'

const supabase = createClient()

export const habitService = {
  /**
   * Get all active habits for a user.
   */
  async getActiveHabits(clientId: string): Promise<Habit[]> {
    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .eq('client_id', clientId)
      .eq('active', true)
      .order('created_at')

    if (error) {
      console.error('habitService.getActiveHabits error:', error.message)
      return []
    }
    return data ?? []
  },

  /**
   * Get habit logs for a specific date.
   */
  async getLogsByDate(clientId: string, date: string): Promise<Record<string, HabitLog>> {
    const { data, error } = await supabase
      .from('habit_logs')
      .select('*')
      .eq('client_id', clientId)
      .eq('date', date)

    if (error) {
      console.error('habitService.getLogsByDate error:', error.message)
      return {}
    }

    const logMap: Record<string, HabitLog> = {}
    data?.forEach(l => { logMap[l.habit_id] = l })
    return logMap
  },

  /**
   * Toggle a habit's completion status.
   */
  async toggleHabit(
    habitId: string,
    clientId: string,
    date: string,
    existing: HabitLog | undefined,
    targetValue: number | null
  ): Promise<HabitLog | null> {
    if (existing) {
      const newCompleted = !existing.completed
      const { error } = await supabase
        .from('habit_logs')
        .update({ completed: newCompleted, value: newCompleted ? targetValue : 0 })
        .eq('id', existing.id)

      if (error) {
        console.error('habitService.toggleHabit error:', error.message)
        return null
      }
      return { ...existing, completed: newCompleted }
    } else {
      const { data, error } = await supabase
        .from('habit_logs')
        .insert({
          habit_id: habitId,
          client_id: clientId,
          date,
          completed: true,
          value: targetValue,
        })
        .select()
        .single()

      if (error) {
        console.error('habitService.toggleHabit error:', error.message)
        return null
      }
      return data
    }
  },

  /**
   * Update a habit log's numeric value.
   */
  async updateValue(
    habitId: string,
    clientId: string,
    date: string,
    value: number,
    targetValue: number | null,
    existing: HabitLog | undefined
  ): Promise<HabitLog | null> {
    const completed = targetValue ? value >= targetValue : value > 0

    if (existing) {
      const { error } = await supabase
        .from('habit_logs')
        .update({ value, completed })
        .eq('id', existing.id)

      if (error) return null
      return { ...existing, value, completed }
    } else {
      const { data, error } = await supabase
        .from('habit_logs')
        .insert({ habit_id: habitId, client_id: clientId, date, value, completed })
        .select()
        .single()

      if (error) return null
      return data
    }
  },

  /**
   * Get today's habit completion stats for the dashboard.
   */
  async getTodayStats(clientId: string): Promise<{ completed: number; total: number }> {
    const today = new Date().toISOString().split('T')[0]

    const [{ data: habits }, { data: logs }] = await Promise.all([
      supabase.from('habits').select('id').eq('client_id', clientId).eq('active', true),
      supabase.from('habit_logs').select('id').eq('client_id', clientId).eq('date', today).eq('completed', true),
    ])

    return {
      completed: logs?.length ?? 0,
      total: habits?.length ?? 0,
    }
  },
}
