'use client'
import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import { useAuth } from '@/hooks/useAuth'
import { habitService } from '@/lib/services/habitService'
import { HabitsSkeleton } from '@/components/ui/Skeleton'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { calcPercentage } from '@/utils/calculations'
import { HABIT_CATEGORY_CONFIG, NUMERIC_HABIT_CATEGORIES } from '@/utils/constants'
import type { Habit, HabitLog, HabitCategory } from '@/types'

export default function HabitsPage() {
  const { userId, loading: authLoading } = useAuth()

  const [habits, setHabits] = useState<Habit[]>([])
  const [logs, setLogs] = useState<Record<string, HabitLog>>({})
  const [dataLoading, setDataLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  const loadData = useCallback(async () => {
    if (!userId) return
    try {
      const [habitsData, logsData] = await Promise.all([
        habitService.getActiveHabits(userId),
        habitService.getLogsByDate(userId, selectedDate),
      ])
      setHabits(habitsData)
      setLogs(logsData)
    } catch (error) {
      console.error('Habits loading error:', error)
    } finally {
      setDataLoading(false)
    }
  }, [userId, selectedDate])

  useEffect(() => {
    if (!authLoading && userId) {
      setDataLoading(true)
      loadData()
    }
  }, [authLoading, userId, loadData])

  /** Toggle habit — with optimistic update */
  async function toggleHabit(habit: Habit) {
    if (!userId) return
    setSaving(habit.id)

    const existing = logs[habit.id]
    const optimisticCompleted = existing ? !existing.completed : true

    // Optimistic UI update
    setLogs(prev => ({
      ...prev,
      [habit.id]: existing
        ? { ...existing, completed: optimisticCompleted }
        : { id: 'temp', habit_id: habit.id, client_id: userId, date: selectedDate, completed: true, value: habit.target_value },
    }))

    const result = await habitService.toggleHabit(
      habit.id, userId, selectedDate, existing, habit.target_value
    )

    if (result) {
      setLogs(prev => ({ ...prev, [habit.id]: result }))
    } else {
      // Rollback on error
      if (existing) {
        setLogs(prev => ({ ...prev, [habit.id]: existing }))
      } else {
        setLogs(prev => {
          const copy = { ...prev }
          delete copy[habit.id]
          return copy
        })
      }
    }

    setSaving(null)
  }

  async function updateValue(habit: Habit, value: number) {
    if (!userId) return
    const existing = logs[habit.id]
    const result = await habitService.updateValue(
      habit.id, userId, selectedDate, value, habit.target_value, existing
    )
    if (result) {
      setLogs(prev => ({ ...prev, [habit.id]: result }))
    }
  }

  const completedCount = habits.filter(h => logs[h.id]?.completed).length
  const totalCount = habits.length
  const percentage = calcPercentage(completedCount, totalCount)

  if (authLoading || dataLoading) return <HabitsSkeleton />

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">

      <PageHeader
        label="Dagelijkse habits"
        title="Habits"
        subtitle={format(new Date(selectedDate + 'T12:00:00'), 'EEEE d MMMM', { locale: nl })}
      />

      <div className="px-4 py-5 space-y-4">

        {/* Date selector */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[-3, -2, -1, 0].map(offset => {
            const d = new Date()
            d.setDate(d.getDate() + offset)
            const dateStr = d.toISOString().split('T')[0]
            const isSelected = dateStr === selectedDate
            const isToday = offset === 0
            return (
              <button
                key={offset}
                onClick={() => setSelectedDate(dateStr)}
                className={`flex-shrink-0 flex flex-col items-center px-4 py-2 rounded-xl transition ${
                  isSelected
                    ? 'bg-orange-500 text-white'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-400'
                }`}
                aria-label={isToday ? 'Vandaag' : format(d, 'EEEE d MMMM', { locale: nl })}
                aria-pressed={isSelected}
              >
                <span className="text-xs font-bold">
                  {isToday ? 'Vandaag' : format(d, 'EEE', { locale: nl })}
                </span>
                <span className="text-lg font-black">{format(d, 'd')}</span>
              </button>
            )
          })}
        </div>

        {/* Progress ring */}
        {totalCount > 0 && (
          <Card className="p-5">
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 flex-shrink-0">
                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64" aria-hidden="true">
                  <circle cx="32" cy="32" r="28" fill="none" stroke="#27272a" strokeWidth="6" />
                  <circle
                    cx="32" cy="32" r="28" fill="none"
                    stroke={percentage === 100 ? '#22c55e' : '#f97316'}
                    strokeWidth="6"
                    strokeDasharray={`${2 * Math.PI * 28}`}
                    strokeDashoffset={`${2 * Math.PI * 28 * (1 - percentage / 100)}`}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white font-black text-sm">{percentage}%</span>
                </div>
              </div>
              <div>
                <p className="text-white font-bold">
                  {completedCount}/{totalCount} habits voltooid
                </p>
                <p className="text-zinc-500 text-xs mt-0.5">
                  {percentage === 100
                    ? '🔥 Perfect dag! Alle habits gedaan!'
                    : `Nog ${totalCount - completedCount} te gaan`}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Empty state */}
        {habits.length === 0 && (
          <EmptyState
            icon="🎯"
            title="Nog geen habits"
            description="Je coach stelt binnenkort habits in voor jou."
          />
        )}

        {/* Habits list */}
        <div className="space-y-3">
          {habits.map(habit => {
            const log = logs[habit.id]
            const completed = log?.completed ?? false
            const config = HABIT_CATEGORY_CONFIG[habit.category as HabitCategory] ?? { icon: '✅', color: 'orange', unit: '' }
            const isNumeric = NUMERIC_HABIT_CATEGORIES.includes(habit.category as HabitCategory)

            return (
              <Card key={habit.id} variant={completed ? 'success' : 'default'}>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${
                    completed ? 'bg-green-500/20' : 'bg-zinc-800'
                  }`}>
                    {config.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm ${completed ? 'text-zinc-400' : 'text-white'}`}>
                      {habit.name}
                    </p>
                    {habit.target_value && (
                      <p className="text-zinc-500 text-xs">
                        Doel: {habit.target_value} {habit.target_unit ?? config.unit}
                      </p>
                    )}
                    {habit.description && (
                      <p className="text-zinc-600 text-xs mt-0.5">{habit.description}</p>
                    )}
                  </div>

                  <button
                    onClick={() => toggleHabit(habit)}
                    disabled={saving === habit.id}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition flex-shrink-0 ${
                      completed
                        ? 'bg-green-500 text-white'
                        : 'bg-zinc-800 text-zinc-500 hover:bg-orange-500 hover:text-white'
                    }`}
                    aria-label={completed ? `${habit.name} als onvoltooid markeren` : `${habit.name} voltooien`}
                  >
                    {saving === habit.id ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : completed ? '✓' : '○'}
                  </button>
                </div>

                {/* Numeric input */}
                {isNumeric && habit.target_value && (
                  <div className="mt-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        value={log?.value ?? ''}
                        onChange={e => updateValue(habit, parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2
                                   text-white text-sm text-center focus:outline-none focus:border-orange-500"
                        aria-label={`${habit.name} waarde`}
                      />
                      <span className="text-zinc-500 text-xs">{habit.target_unit ?? config.unit}</span>
                      <span className="text-zinc-600 text-xs">/ {habit.target_value}</span>
                    </div>
                    <div className="mt-2 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          completed ? 'bg-green-500' : 'bg-orange-500'
                        }`}
                        style={{
                          width: `${Math.min(100, ((log?.value ?? 0) / habit.target_value) * 100)}%`
                        }}
                      />
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
