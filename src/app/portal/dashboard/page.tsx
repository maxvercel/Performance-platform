'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'

const CATEGORY_CONFIG: Record<string, { icon: string, color: string, unit: string }> = {
  water:       { icon: '💧', color: 'blue',   unit: 'ml' },
  steps:       { icon: '👣', color: 'green',  unit: 'stappen' },
  sleep:       { icon: '😴', color: 'purple', unit: 'uur' },
  mobility:    { icon: '🧘', color: 'orange', unit: 'min' },
  supplements: { icon: '💊', color: 'red',    unit: 'x' },
  nutrition:   { icon: '🥗', color: 'teal',   unit: 'x' },
}

export default function HabitsPage() {
  const supabase = createClient()
  const router = useRouter()

  const [habits, setHabits] = useState<any[]>([])
  const [logs, setLogs] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [selectedDate])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/portal/login'); return }
    setUserId(user.id)

    const { data: habits } = await supabase
      .from('habits')
      .select('*')
      .eq('client_id', user.id)
      .eq('active', true)
      .order('created_at')

    const { data: logs } = await supabase
      .from('habit_logs')
      .select('*')
      .eq('client_id', user.id)
      .eq('date', selectedDate)

    setHabits(habits ?? [])
    const logMap: Record<string, any> = {}
    logs?.forEach(l => { logMap[l.habit_id] = l })
    setLogs(logMap)
    setLoading(false)
  }

  async function toggleHabit(habit: any) {
    if (!userId) return
    setSaving(habit.id)

    const existing = logs[habit.id]

    if (existing) {
      const newCompleted = !existing.completed
      await supabase
        .from('habit_logs')
        .update({ completed: newCompleted, value: newCompleted ? habit.target_value : 0 })
        .eq('id', existing.id)

      setLogs(prev => ({
        ...prev,
        [habit.id]: { ...existing, completed: newCompleted }
      }))
    } else {
      const { data } = await supabase
        .from('habit_logs')
        .insert({
          habit_id: habit.id,
          client_id: userId,
          date: selectedDate,
          completed: true,
          value: habit.target_value,
        })
        .select().single()

      if (data) setLogs(prev => ({ ...prev, [habit.id]: data }))
    }

    setSaving(null)
  }

  async function updateValue(habit: any, value: number) {
    if (!userId) return

    const existing = logs[habit.id]
    const completed = habit.target_value ? value >= habit.target_value : value > 0

    if (existing) {
      await supabase
        .from('habit_logs')
        .update({ value, completed })
        .eq('id', existing.id)
      setLogs(prev => ({ ...prev, [habit.id]: { ...existing, value, completed } }))
    } else {
      const { data } = await supabase
        .from('habit_logs')
        .insert({ habit_id: habit.id, client_id: userId, date: selectedDate, value, completed })
        .select().single()
      if (data) setLogs(prev => ({ ...prev, [habit.id]: data }))
    }
  }

  const completedCount = habits.filter(h => logs[h.id]?.completed).length
  const totalCount = habits.length
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">

      {/* Header */}
      <div className="bg-zinc-900 px-5 pt-12 pb-5 border-b border-zinc-800">
        <p className="text-orange-500 text-xs font-bold tracking-widest uppercase mb-1">
          Dagelijkse habits
        </p>
        <h1 className="text-white text-2xl font-black">Habits</h1>
        <p className="text-zinc-500 text-xs mt-1">
          {format(new Date(selectedDate + 'T12:00:00'), 'EEEE d MMMM', { locale: nl })}
        </p>
      </div>

      <div className="px-4 py-5 space-y-4">

        {/* Datum selector */}
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
              >
                <span className="text-xs font-bold">
                  {isToday ? 'Vandaag' : format(d, 'EEE', { locale: nl })}
                </span>
                <span className="text-lg font-black">{format(d, 'd')}</span>
              </button>
            )
          })}
        </div>

        {/* Voortgang ring */}
        {totalCount > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 flex-shrink-0">
                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
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
          </div>
        )}

        {/* Geen habits */}
        {habits.length === 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
            <div className="text-4xl mb-3">🎯</div>
            <h2 className="text-white font-bold mb-2">Nog geen habits</h2>
            <p className="text-zinc-500 text-sm">Je coach stelt binnenkort habits in voor jou.</p>
          </div>
        )}

        {/* Habits lijst */}
        <div className="space-y-3">
          {habits.map(habit => {
            const log = logs[habit.id]
            const completed = log?.completed ?? false
            const config = CATEGORY_CONFIG[habit.category] ?? { icon: '✅', color: 'orange', unit: '' }
            const isNumeric = ['water', 'steps', 'sleep', 'mobility'].includes(habit.category)

            return (
              <div
                key={habit.id}
                className={`bg-zinc-900 rounded-2xl border transition-all ${
                  completed
                    ? 'border-green-500/40 bg-green-500/5'
                    : 'border-zinc-800'
                }`}
              >
                <div className="p-4">
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
                    >
                      {saving === habit.id ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : completed ? '✓' : '○'}
                    </button>
                  </div>

                  {/* Numerieke invoer */}
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
                        />
                        <span className="text-zinc-500 text-xs">{habit.target_unit ?? config.unit}</span>
                        <span className="text-zinc-600 text-xs">/ {habit.target_value}</span>
                      </div>

                      {/* Voortgang balk */}
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
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}