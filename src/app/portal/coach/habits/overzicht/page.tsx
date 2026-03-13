'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { format, subDays } from 'date-fns'
import { nl } from 'date-fns/locale'
import { selectInChunks } from '@/lib/supabase/queryHelpers'

interface HabitRow {
  id: string; client_id: string; name: string; icon: string | null;
  target_value: number | null; target_unit: string | null; active: boolean;
}
interface HabitLogRow {
  id: string; habit_id: string; client_id: string; date: string;
  completed: boolean; value: number | null;
}
interface ClientProfile {
  id: string; full_name: string; email: string; role: string;
}

export default function HabitsOverzicht() {
  const supabase = createClient()
  const router = useRouter()

  const [clients, setClients] = useState<ClientProfile[]>([])
  const [data, setData] = useState<Record<string, { habits: HabitRow[], logs: HabitLogRow[] }>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => { load() }, [selectedDate])

  async function load() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/portal/login'); return }

      const { data: relations, error: relErr } = await supabase
        .from('coach_client')
        .select('client_id')
        .eq('coach_id', user.id)
        .eq('active', true)

      if (relErr) { setError('Kan clients niet laden.'); setLoading(false); return }

      const clientIds = relations?.map(r => r.client_id) ?? []
      if (clientIds.length === 0) { setLoading(false); return }

      // Batch: profiles, habits, logs in 3 parallel queries instead of N+1
      const [profiles, allHabits, allLogs] = await Promise.all([
        selectInChunks<ClientProfile>(supabase, 'profiles', 'id, full_name, email, role', 'id', clientIds),
        selectInChunks<HabitRow>(supabase, 'habits', '*', 'client_id', clientIds, (q) => q.eq('active', true)),
        selectInChunks<HabitLogRow>(supabase, 'habit_logs', '*', 'client_id', clientIds, (q) => q.eq('date', selectedDate)),
      ])

      setClients(profiles)

      // Group by client_id
      const result: Record<string, { habits: HabitRow[], logs: HabitLogRow[] }> = {}
      for (const id of clientIds) {
        result[id] = { habits: [], logs: [] }
      }
      allHabits.forEach(h => { result[h.client_id]?.habits.push(h) })
      allLogs.forEach(l => { result[l.client_id]?.logs.push(l) })

      setData(result)
    } catch (err) {
      console.error('Habits overzicht load error:', err)
      setError('Er ging iets mis bij het laden.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-6">
      <div className="text-center">
        <p className="text-4xl mb-3">⚠️</p>
        <p className="text-red-400 font-bold mb-2">Fout bij laden</p>
        <p className="text-zinc-500 text-sm mb-4">{error}</p>
        <button onClick={() => { setError(null); setLoading(true); load() }}
          className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-6 py-2 rounded-xl text-sm transition">
          Opnieuw proberen
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">

      <div className="bg-zinc-900 px-5 pt-12 pb-5 border-b border-zinc-800">
        <button onClick={() => router.push('/portal/coach/habits')}
          className="text-zinc-500 text-xs mb-2">← Terug</button>
        <h1 className="text-white text-2xl font-black">Habits overzicht</h1>
        <p className="text-zinc-500 text-xs mt-1">Habit compliance per client</p>
      </div>

      <div className="px-4 py-5 space-y-4">

        {/* Datum selector */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[0, 1, 2, 3, 4, 5, 6].map(offset => {
            const d = subDays(new Date(), offset)
            const dateStr = d.toISOString().split('T')[0]
            const isSelected = dateStr === selectedDate
            return (
              <button
                key={offset}
                onClick={() => setSelectedDate(dateStr)}
                className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl transition ${
                  isSelected
                    ? 'bg-orange-500 text-white'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-400'
                }`}
              >
                <span className="text-xs font-bold">
                  {offset === 0 ? 'Vandaag' : format(d, 'EEE', { locale: nl })}
                </span>
                <span className="text-lg font-black">{format(d, 'd')}</span>
              </button>
            )
          })}
        </div>

        {/* Per client */}
        {clients.length === 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
            <p className="text-zinc-500 text-sm">Geen clients gevonden</p>
          </div>
        )}

        {clients.map(client => {
          const clientData = data[client.id]
          const habits = clientData?.habits ?? []
          const logs = clientData?.logs ?? []
          const logMap: Record<string, HabitLogRow> = {}
          logs.forEach(l => { logMap[l.habit_id] = l })

          const completed = habits.filter(h => logMap[h.id]?.completed).length
          const total = habits.length
          const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

          const scoreColor = percentage === 100
            ? 'text-green-400'
            : percentage >= 60
              ? 'text-orange-400'
              : 'text-red-400'

          return (
            <div key={client.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">

              {/* Client header */}
              <div className="flex items-center gap-3 p-4 border-b border-zinc-800">
                <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center
                                justify-center text-white font-black flex-shrink-0">
                  {client.full_name?.[0] ?? '?'}
                </div>
                <div className="flex-1">
                  <p className="text-white font-bold text-sm">{client.full_name}</p>
                  <p className="text-zinc-500 text-xs">{total} habits ingesteld</p>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-black ${scoreColor}`}>{percentage}%</p>
                  <p className="text-zinc-600 text-xs">{completed}/{total}</p>
                </div>
              </div>

              {/* Voortgang balk */}
              <div className="h-1 bg-zinc-800">
                <div
                  className={`h-full transition-all duration-500 ${
                    percentage === 100 ? 'bg-green-500' : 'bg-orange-500'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>

              {/* Habits grid */}
              {total > 0 && (
                <div className="p-4 grid grid-cols-2 gap-2">
                  {habits.map(habit => {
                    const log = logMap[habit.id]
                    const done = log?.completed ?? false
                    return (
                      <div
                        key={habit.id}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl ${
                          done ? 'bg-green-500/10' : 'bg-zinc-800'
                        }`}
                      >
                        <span className="text-base">{habit.icon ?? '✅'}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold truncate ${
                            done ? 'text-green-400' : 'text-zinc-300'
                          }`}>
                            {habit.name}
                          </p>
                          {log?.value && habit.target_value && (
                            <p className="text-zinc-600 text-xs">
                              {log.value}/{habit.target_value} {habit.target_unit}
                            </p>
                          )}
                        </div>
                        <span className={`text-sm flex-shrink-0 ${done ? 'text-green-400' : 'text-zinc-600'}`}>
                          {done ? '✓' : '○'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}

              {total === 0 && (
                <p className="text-zinc-600 text-xs text-center py-4">
                  Geen habits ingesteld voor deze client
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}