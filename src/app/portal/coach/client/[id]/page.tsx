'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { formatDistanceToNow, parseISO, format, differenceInDays } from 'date-fns'
import { nl } from 'date-fns/locale'

export default function ClientDetail() {
  const supabase = createClient()
  const router = useRouter()
  const { id: clientId } = useParams<{ id: string }>()

  const [coach, setCoach] = useState<any>(null)
  const [client, setClient] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'berichten' | 'trainingen' | 'programmas' | 'readiness'>('berichten')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Trainingen
  const [workoutHistory, setWorkoutHistory] = useState<any[]>([])
  // Programma's
  const [programs, setPrograms] = useState<any[]>([])
  // Readiness
  const [readinessHistory, setReadinessHistory] = useState<any[]>([])
  // Workout detail expansion
  const [expandedWorkout, setExpandedWorkout] = useState<string | null>(null)
  const [workoutDetails, setWorkoutDetails] = useState<Record<string, any[]>>({})

  useEffect(() => { load() }, [clientId])
  useEffect(() => {
    if (activeTab === 'berichten') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, activeTab])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/portal/login'); return }
    setCoach({ id: user.id })

    const { data: clientProfile } = await supabase
      .from('profiles').select('*').eq('id', clientId).single()
    setClient(clientProfile)

    // Berichten
    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${clientId}),and(sender_id.eq.${clientId},receiver_id.eq.${user.id})`)
      .order('sent_at', { ascending: true })
    setMessages(msgs ?? [])

    // Markeer als gelezen
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('sender_id', clientId)
      .eq('receiver_id', user.id)
      .is('read_at', null)

    // Workout geschiedenis
    const { data: workoutLogs } = await supabase
      .from('workout_logs')
      .select(`
        id, logged_at, completed_at, feeling,
        program_days(label),
        programs(name, goal)
      `)
      .eq('client_id', clientId)
      .not('completed_at', 'is', null)
      .order('logged_at', { ascending: false })
      .limit(50)

    if (workoutLogs && workoutLogs.length > 0) {
      const logIds = workoutLogs.map(l => l.id)
      const { data: exLogs } = await supabase
        .from('exercise_logs')
        .select('workout_log_id, weight_kg, reps_completed')
        .in('workout_log_id', logIds)

      const volumeMap: Record<string, number> = {}
      const setsMap: Record<string, number> = {}
      exLogs?.forEach((el: any) => {
        volumeMap[el.workout_log_id] = (volumeMap[el.workout_log_id] ?? 0) + ((el.weight_kg ?? 0) * (el.reps_completed ?? 0))
        setsMap[el.workout_log_id] = (setsMap[el.workout_log_id] ?? 0) + 1
      })

      setWorkoutHistory(workoutLogs.map(log => ({
        ...log,
        volume: volumeMap[log.id] ?? 0,
        setsCount: setsMap[log.id] ?? 0,
      })))
    }

    // Programma's
    const { data: progs } = await supabase
      .from('programs')
      .select(`id, name, goal, start_date, is_active, program_weeks(id)`)
      .eq('client_id', clientId)
      .order('start_date', { ascending: false })

    if (progs) {
      const progIds = progs.map(p => p.id)
      const { data: wLogs } = await supabase
        .from('workout_logs')
        .select('program_id, completed_at')
        .in('program_id', progIds)
        .not('completed_at', 'is', null)

      const countMap: Record<string, number> = {}
      wLogs?.forEach((l: any) => {
        countMap[l.program_id] = (countMap[l.program_id] ?? 0) + 1
      })

      setPrograms(progs.map(p => ({
        ...p,
        numWeeks: p.program_weeks?.length ?? 0,
        completedWorkouts: countMap[p.id] ?? 0,
      })))
    }

    // Readiness history (last 14 days)
    const { data: readiness } = await supabase
      .from('daily_readiness')
      .select('*')
      .eq('client_id', clientId)
      .order('date', { ascending: false })
      .limit(14)
    setReadinessHistory(readiness ?? [])

    setLoading(false)
  }

  async function loadWorkoutDetail(workoutLogId: string) {
    if (expandedWorkout === workoutLogId) {
      setExpandedWorkout(null)
      return
    }
    if (workoutDetails[workoutLogId]) {
      setExpandedWorkout(workoutLogId)
      return
    }
    const { data: exLogs } = await supabase
      .from('exercise_logs')
      .select('*, exercises(name, muscle_group)')
      .eq('workout_log_id', workoutLogId)
      .order('exercise_id')
      .order('set_number', { ascending: true })

    // Group by exercise
    const grouped: Record<string, { exercise: any; sets: any[] }> = {}
    exLogs?.forEach((el: any) => {
      const exId = el.exercise_id
      if (!grouped[exId]) grouped[exId] = { exercise: el.exercises, sets: [] }
      grouped[exId].sets.push(el)
    })
    setWorkoutDetails(prev => ({ ...prev, [workoutLogId]: Object.values(grouped) }))
    setExpandedWorkout(workoutLogId)
  }

  async function deleteProgram(programId: string) {
    if (!confirm('Weet je zeker dat je dit programma wilt verwijderen? Dit kan niet ongedaan worden.')) return
    // Delete program_exercises, program_days, program_weeks first (cascade should handle this)
    await supabase.from('programs').delete().eq('id', programId)
    setPrograms(prev => prev.filter(p => p.id !== programId))
  }

  async function sendMessage() {
    if (!newMessage.trim() || !coach) return
    setSending(true)
    const { data } = await supabase
      .from('messages')
      .insert({ sender_id: coach.id, receiver_id: clientId, content: newMessage.trim() })
      .select().single()
    if (data) setMessages(prev => [...prev, data])
    setNewMessage('')
    setSending(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const goalEmoji: Record<string, string> = { strength: '💪', hypertrophy: '🏋️', fat_loss: '🔥', athletic: '⚡' }
  const goalLabel: Record<string, string> = { strength: 'Kracht', hypertrophy: 'Spiermassa', fat_loss: 'Vetverlies', athletic: 'Atletisch' }
  const feelingEmoji = ['', '😫', '😕', '😊', '💪', '🔥']

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col pb-24">

      {/* Header */}
      <div className="bg-zinc-900 px-5 pt-12 pb-4 border-b border-zinc-800 flex-shrink-0">
        <button onClick={() => router.push('/portal/coach')}
          className="text-zinc-500 text-xs mb-2 flex items-center gap-1">
          ← Terug
        </button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center
                          justify-center text-white font-black text-lg">
            {client?.full_name?.[0] ?? '?'}
          </div>
          <div>
            <h1 className="text-white font-black text-lg">{client?.full_name}</h1>
            <p className="text-zinc-500 text-xs">{client?.email}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-zinc-900 border-b border-zinc-800 flex-shrink-0">
        {[
          { key: 'berichten', label: '💬 Chat' },
          { key: 'trainingen', label: `🏋️ Log${workoutHistory.length > 0 ? ` (${workoutHistory.length})` : ''}` },
          { key: 'readiness', label: '📊 Readiness' },
          { key: 'programmas', label: `📋 Prog.${programs.length > 0 ? ` (${programs.length})` : ''}` },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`flex-1 py-3 text-xs font-semibold border-b-2 transition ${
              activeTab === tab.key ? 'text-orange-500 border-orange-500' : 'text-zinc-500 border-transparent'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* BERICHTEN TAB */}
      {activeTab === 'berichten' && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <p className="text-4xl mb-3">💬</p>
                <p className="text-zinc-500 text-sm">Nog geen berichten</p>
              </div>
            )}
            {messages.map(msg => {
              const isCoach = msg.sender_id === coach?.id
              const timestamp = msg.sent_at || msg.created_at
              return (
                <div key={msg.id} className={`flex ${isCoach ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                    isCoach ? 'bg-orange-500 text-white rounded-br-sm' : 'bg-zinc-800 text-white rounded-bl-sm'
                  }`}>
                    <p className="text-sm">{msg.content}</p>
                    {timestamp && (
                      <p className={`text-xs mt-1 ${isCoach ? 'text-orange-200' : 'text-zinc-500'}`}>
                        {formatDistanceToNow(parseISO(timestamp), { addSuffix: true, locale: nl })}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
          <div className="bg-zinc-900 border-t border-zinc-800 px-4 py-3 flex-shrink-0">
            <div className="flex gap-2">
              <input type="text" value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder={`Bericht aan ${client?.full_name?.split(' ')[0]}...`}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3
                           text-white text-sm placeholdex�zinc-500 focus:outline-none focus:border-orange-500" />
              <button onClick={sendMessage} disabled={sending || !newMessage.trim()}
                className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white
                           font-bold px-4 rounded-xl text-sm transition">
                {sending ? '...' : '→'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* TRAININGEN TAB */}
      {activeTab === 'trainingen' && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-center">
              <p className="text-zinc-500 text-xs mb-1">Workouts</p>
              <p className="text-white text-2xl font-black">{workoutHistory.length}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-center">
              <p className="text-zinc-500 text-xs mb-1">Totaal volume</p>
              <p className="text-white text-xl font-black">
                {(() => {
                  const total = workoutHistory.reduce((a, l) => a + l.volume, 0)
                  return total >= 1000 ? `${Math.round(total / 1000)}k` : Math.round(total)
                })()}
                <span className="text-zinc-500 text-xs font-normal"> kg</span>
              </p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-center">
              <p className="text-zinc-500 text-xs mb-1">Laatste</p>
              <p className="text-white text-sm font-black">
                {workoutHistory[0]?.logged_at
                  ? `${differenceInDays(new Date(), parseISO(workoutHistory[0].logged_at))}d geleden`
                  : '–'
                }
              </p>
            </div>
          </div>

          {workoutHistory.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
              <div className="text-4xl mb-3">🏋️</div>
              <p className="text-zinc-500 text-sm">Nog geen workouts afgerond</p>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="divide-y divide-zinc-800">
                {workoutHistory.map(log => (
                  <div key={log.id}>
                    <button
                      onClick={() => loadWorkoutDetail(log.id)}
                      className="w-full px-4 py-3 text-left hover:bg-zinc-800/50 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-white font-bold text-sm">
                              {log.program_days?.label ?? 'Workout'}
                            </p>
                            {log.feeling && (
                              <span className="text-base">{feelingEmoji[log.feeling]}</span>
                            )}
                          </div>
                          <p className="text-zinc-500 text-xs mt-0.5">
                            {format(parseISO(log.logged_at), 'EEEE d MMMM yyyy', { locale: nl })}
                          </p>
                          <div className="flex gap-3 mt-1">
                            <span className="text-zinc-400 text-xs">{log.setsCount} sets</span>
                            {log.volume > 0 && (
                              <span className="text-zinc-400 text-xs">
                                {log.volume >= 1000 ? `${Math.round(log.volume / 1000)}k` : Math.round(log.volume)} kg volume
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <p className="text-zinc-600 text-xs text-right">{log.programs?.name}</p>
                          <span className="text-zinc-600 text-xs">{expandedWorkout === log.id ? '▼' : '▶'}</span>
                        </div>
                      </div>
                    </button>

                    {/* Expanded: per-exercise detail with weights */}
                    {expandedWorkout === log.id && workoutDetails[log.id] && (
                      <div className="px-4 pb-3 space-y-2">
                        {workoutDetails[log.id].map((group: any, gi: number) => (
                          <div key={gi} className="bg-zinc-800/50 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-zinc-600 text-xs font-bold">{gi + 1}</span>
                              <span className="text-white text-xs font-bold">{group.exercise?.name}</span>
                              {group.exercise?.muscle_group && (
                                <span className="text-zinc-500 text-[10px]">{group.exercise.muscle_group}</span>
                              )}
                            </div>
                            <div className="space-y-1">
                              {group.sets.map((set: any, si: number) => (
                                <div key={si} className="flex items-center gap-3 text-xs">
                                  <span className="text-zinc-600 w-6">S{set.set_number}</span>
                                  <span className="text-white font-bold w-14">{set.weight_kg ?? '–'} kg</span>
                                  <span className="text-zinc-400 w-12">× {set.reps_completed ?? '–'}</span>
                                  {set.rpe && (
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      set.rpe >= 9.5 ? 'bg-red-500/20 text-red-400' :
                                      set.rpe >= 8 ? 'bg-orange-500/20 text-orange-400' :
                                      'bg-green-500/20 text-green-400'
                                    }`}>
                                      RPE {set.rpe}
                                    </span>
                                  )}
                                  <span className="text-zinc-700 text-[10px] ml-auto">
                                    {((set.weight_kg ?? 0) * (set.reps_completed ?? 0))} kg vol.
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* READINESS TAB */}
      {activeTab === 'readiness' && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {readinessHistory.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
              <div className="text-4xl mb-3">📊</div>
              <p className="text-zinc-500 text-sm">Nog geen readiness data</p>
              <p className="text-zinc-600 text-xs mt-1">Client moet dagelijks check-in invullen</p>
            </div>
          ) : (
            <>
              {/* Score trend */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                <p className="text-white font-bold text-sm mb-3">Readiness trend (14 dagen)</p>
                <div className="flex items-end gap-1 h-20">
                  {readinessHistory.slice().reverse().map((r: any, i: number) => {
                    const score = r.readiness_score ?? 0
                    const h = (score / 5) * 100
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className={`w-full rounded-t ${
                            score >= 4 ? 'bg-green-500' : score >= 3 ? 'bg-yellow-500' : score >= 2 ? 'bg-orange-500' : 'bg-red-500'
                          }`}
                          style={{ height: `${h}%`, minHeight: score > 0 ? '4px' : '0' }}
                        />
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-zinc-700 text-[10px]">
                    {readinessHistory.length > 0 ? readinessHistory[readinessHistory.length - 1].date?.slice(5) : ''}
                  </span>
                  <span className="text-zinc-700 text-[10px]">
                    {readinessHistory.length > 0 ? readinessHistory[0].date?.slice(5) : ''}
                  </span>
                </div>
              </div>

              {/* Daily entries */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="divide-y divide-zinc-800">
                  {readinessHistory.map((r: any) => (
                    <div key={r.id} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-zinc-400 text-xs font-semibold">
                          {r.date ? format(parseISO(r.date), 'EEE d MMM', { locale: nl }) : ''}
                        </p>
                        <span className={`font-black text-sm ${
                          (r.readiness_score ?? 0) >= 4 ? 'text-green-400' :
                          (r.readiness_score ?? 0) >= 3 ? 'text-yellow-400' :
                          (r.readiness_score ?? 0) >= 2 ? 'text-orange-400' : 'text-red-400'
                        }`}>
                          {r.readiness_score?.toFixed(1) ?? '–'}/5
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[10px]">
                        {r.sleep_hours && (
                          <span className="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                            💤 {r.sleep_hours}u
                          </span>
                        )}
                        {r.sleep_quality && (
                          <span className="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                            Slaap: {r.sleep_quality}/5
                          </span>
                        )}
                        {r.energy_level && (
                          <span className="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                            Energie: {r.energy_level}/5
                          </span>
                        )}
                        {r.muscle_soreness && (
                          <span className="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                            Spierpijn: {r.muscle_soreness}/5
                          </span>
                        )}
                        {r.stress_level && (
                          <span className="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                            Stress: {r.stress_level}/5
                          </span>
                        )}
                      </div>
                      {r.notes && (
                        <p className="text-zinc-600 text-xs mt-1 italic">{r.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* PROGRAMMA'S TAB */}
      {activeTab === 'programmas' && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">

          {programs.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-zinc-500 text-sm">Nog geen programma&apos;s toegewezen</p>
            </div>
          ) : (
            programs.map(prog => (
              <div key={prog.id} className={`bg-zinc-900 border rounded-2xl p-4 ${
                prog.is_active ? 'border-orange-500/40' : 'border-zinc-800'
              }`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-bold">{prog.name}</p>
                      {prog.is_active && (
                        <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-bold">
                          Actief
                        </span>
                      )}
                    </div>
                    <p className="text-zinc-500 text-xs mt-0.5">
                      Gestart: {prog.start_date
                        ? format(parseISO(prog.start_date), 'd MMMM yyyy', { locale: nl })
                        : '–'
                      }
                    </p>
                  </div>
                  <span className="text-2xl ml-2">{goalEmoji[prog.goal] ?? '📋'}</span>
                </div>
                <div className="flex gap-2 flex-wrap mt-2">
                  <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded-lg">
                    {goalLabel[prog.goal] ?? prog.goal}
                  </span>
                  <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded-lg">
                    {prog.numWeeks} {prog.numWeeks === 1 ? 'week' : 'weken'}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-lg ${
                    prog.completedWorkouts > 0 ? 'bg-green-500/15 text-green-400' : 'bg-zinc-800 text-zinc-500'
                  }`}>
                    ✓ {prog.completedWorkouts} workouts
                  </span>
                </div>
                {/* Delete program button */}
                <button
                  onClick={() => deleteProgram(prog.id)}
                  className="mt-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5
                             hover:bg-red-500/20 transition"
                >
                  Programma verwijderen
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}