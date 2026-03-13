'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { parseISO, format, differenceInDays } from 'date-fns'
import { nl } from 'date-fns/locale'
import { selectInChunks } from '@/lib/supabase/queryHelpers'

export default function ClientDetail() {
  const supabase = createClient()
  const router = useRouter()
  const { id: clientId } = useParams<{ id: string }>()

  const [coach, setCoach] = useState<any>(null)
  const [client, setClient] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'trainingen' | 'programmas' | 'readiness'>('trainingen')

  // Trainingen
  const [workoutHistory, setWorkoutHistory] = useState<any[]>([])
  // Programma's
  const [programs, setPrograms] = useState<any[]>([])
  // Readiness
  const [readinessHistory, setReadinessHistory] = useState<any[]>([])
  // Workout detail expansion
  const [expandedWorkout, setExpandedWorkout] = useState<string | null>(null)
  const [workoutDetails, setWorkoutDetails] = useState<Record<string, any[]>>({})
  // Program detail expansion
  const [expandedProgram, setExpandedProgram] = useState<string | null>(null)
  // Program performed data (actual weights per day)
  const [programPerformedData, setProgramPerformedData] = useState<Record<string, Record<string, any[]>>>({})
  // Exercise history view (Google Sheets style)
  const [exerciseHistoryView, setExerciseHistoryView] = useState<string | null>(null)
  const [exerciseHistory, setExerciseHistory] = useState<any[]>([])
  const [exerciseHistoryName, setExerciseHistoryName] = useState('')
  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null)
  // Toggling active
  const [togglingId, setTogglingId] = useState<string | null>(null)
  // Exercise editing
  const [editingExercise, setEditingExercise] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<{ sets?: number; reps?: number; weight_kg?: number | null; rest_seconds?: number | null; notes?: string }>({})
  const [savingExercise, setSavingExercise] = useState<string | null>(null)

  useEffect(() => { load() }, [clientId])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/portal/login'); return }
    setCoach({ id: user.id })

    const { data: clientProfile } = await supabase
      .from('profiles').select('*').eq('id', clientId).single()
    setClient(clientProfile)

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
      const exLogs = await selectInChunks<{ workout_log_id: string; weight_kg: number | null; reps_completed: number | null }>(
        supabase, 'exercise_logs', 'workout_log_id, weight_kg, reps_completed', 'workout_log_id', logIds
      )

      const volumeMap: Record<string, number> = {}
      const setsMap: Record<string, number> = {}
      exLogs.forEach((el) => {
        volumeMap[el.workout_log_id] = (volumeMap[el.workout_log_id] ?? 0) + ((el.weight_kg ?? 0) * (el.reps_completed ?? 0))
        setsMap[el.workout_log_id] = (setsMap[el.workout_log_id] ?? 0) + 1
      })

      setWorkoutHistory(workoutLogs.map(log => ({
        ...log,
        volume: volumeMap[log.id] ?? 0,
        setsCount: setsMap[log.id] ?? 0,
      })))
    }

    // Programma's — volledig met structuur
    const { data: progs } = await supabase
      .from('programs')
      .select(`id, name, goal, start_date, is_active, created_at,
        program_weeks(id, week_number, label,
          program_days(id, day_number, label, rest_day,
            program_exercises(id, exercise_id, sets, reps, weight_kg, rest_seconds, notes, superset_group, order_index,
              exercises(id, name, muscle_group)
            )
          )
        )
      `)
      .eq('client_id', clientId)
      .order('start_date', { ascending: false })

    if (progs) {
      const progIds = progs.map(p => p.id)
      const wLogs = await selectInChunks<{ program_id: string; completed_at: string | null; day_id: string | null }>(
        supabase, 'workout_logs', 'program_id, completed_at, day_id', 'program_id', progIds,
        (q) => q.not('completed_at', 'is', null)
      )

      const countMap: Record<string, number> = {}
      const completedDaysMap: Record<string, Set<string>> = {}
      wLogs.forEach((l) => {
        countMap[l.program_id] = (countMap[l.program_id] ?? 0) + 1
        if (!completedDaysMap[l.program_id]) completedDaysMap[l.program_id] = new Set()
        if (l.day_id) completedDaysMap[l.program_id].add(l.day_id)
      })

      setPrograms(progs.map(p => {
        const weeks = p.program_weeks?.sort((a: any, b: any) => a.week_number - b.week_number) ?? []
        const totalDays = weeks.reduce((acc: number, w: any) =>
          acc + (w.program_days?.filter((d: any) => !d.rest_day).length ?? 0), 0)
        return {
          ...p,
          program_weeks: weeks,
          numWeeks: weeks.length,
          totalDays,
          completedWorkouts: countMap[p.id] ?? 0,
          completedDays: completedDaysMap[p.id] ?? new Set(),
        }
      }))
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
    if (expandedWorkout === workoutLogId) { setExpandedWorkout(null); return }
    if (workoutDetails[workoutLogId]) { setExpandedWorkout(workoutLogId); return }
    const { data: exLogs } = await supabase
      .from('exercise_logs')
      .select('*, exercises(id, name, muscle_group)')
      .eq('workout_log_id', workoutLogId)
      .order('exercise_id')
      .order('set_number', { ascending: true })

    const grouped: Record<string, { exercise: any; sets: any[] }> = {}
    exLogs?.forEach((el: any) => {
      const exId = el.exercise_id
      if (!grouped[exId]) grouped[exId] = { exercise: el.exercises, sets: [] }
      grouped[exId].sets.push(el)
    })
    setWorkoutDetails(prev => ({ ...prev, [workoutLogId]: Object.values(grouped) }))
    setExpandedWorkout(workoutLogId)
  }

  // Load performed data for all days in a program (actual weights)
  async function loadProgramPerformedData(programId: string) {
    if (programPerformedData[programId]) return // already loaded

    // Get all workout_logs for this program
    const { data: wLogs } = await supabase
      .from('workout_logs')
      .select('id, day_id, logged_at')
      .eq('program_id', programId)
      .eq('client_id', clientId)
      .not('completed_at', 'is', null)
      .order('logged_at', { ascending: false })

    if (!wLogs || wLogs.length === 0) {
      setProgramPerformedData(prev => ({ ...prev, [programId]: {} }))
      return
    }

    const wLogIds = wLogs.map(w => w.id)
    const dayLogMap: Record<string, string> = {} // day_id -> latest workout_log_id
    const logDateMap: Record<string, string> = {} // workout_log_id -> logged_at
    wLogs.forEach(w => {
      if (w.day_id && !dayLogMap[w.day_id]) dayLogMap[w.day_id] = w.id // latest first
      logDateMap[w.id] = w.logged_at
    })

    // Get all exercise_logs for these workouts (safe chunking for large programs)
    const eLogs = await selectInChunks<{
      workout_log_id: string; exercise_id: string; set_number: number;
      weight_kg: number | null; reps_completed: number | null; rpe: number | null;
    }>(
      supabase, 'exercise_logs', 'workout_log_id, exercise_id, set_number, weight_kg, reps_completed, rpe',
      'workout_log_id', wLogIds, (q) => q.order('set_number', { ascending: true })
    )

    // Group by day_id -> exercise_id -> sets
    const byDay: Record<string, Array<{ workout_log_id: string; exercise_id: string; set_number: number; weight_kg: number | null; reps_completed: number | null; rpe: number | null; logged_at: string }>> = {}
    const logToDayMap: Record<string, string> = {}
    wLogs.forEach(w => { if (w.day_id) logToDayMap[w.id] = w.day_id })

    eLogs.forEach((el) => {
      const dayId = logToDayMap[el.workout_log_id]
      if (!dayId) return
      if (!byDay[dayId]) byDay[dayId] = []
      byDay[dayId].push({
        ...el,
        logged_at: logDateMap[el.workout_log_id],
      })
    })

    setProgramPerformedData(prev => ({ ...prev, [programId]: byDay }))
  }

  // Load exercise history across all sessions (Google Sheets style)
  async function loadExerciseHistory(exerciseId: string, exerciseName: string) {
    if (exerciseHistoryView === exerciseId) { setExerciseHistoryView(null); return }
    setExerciseHistoryName(exerciseName)
    setExerciseHistoryView(exerciseId)

    const { data: wLogs } = await supabase
      .from('workout_logs')
      .select('id, logged_at')
      .eq('client_id', clientId)
      .not('completed_at', 'is', null)
      .order('logged_at', { ascending: true })

    if (!wLogs || wLogs.length === 0) { setExerciseHistory([]); return }

    const wLogIds = wLogs.map(w => w.id)
    const dateMap: Record<string, string> = {}
    wLogs.forEach(w => { dateMap[w.id] = w.logged_at })

    const eLogs = await selectInChunks<{
      workout_log_id: string; set_number: number; weight_kg: number | null;
      reps_completed: number | null; rpe: number | null;
    }>(
      supabase, 'exercise_logs', 'workout_log_id, set_number, weight_kg, reps_completed, rpe',
      'workout_log_id', wLogIds, (q) => q.eq('exercise_id', exerciseId).order('set_number', { ascending: true })
    )

    const byDate: Record<string, { date: string; sets: Array<{ workout_log_id: string; set_number: number; weight_kg: number | null; reps_completed: number | null; rpe: number | null }> }> = {}
    eLogs.forEach((el) => {
      const date = dateMap[el.workout_log_id]?.split('T')[0] ?? 'unknown'
      if (!byDate[date]) byDate[date] = { date, sets: [] }
      byDate[date].sets.push(el)
    })

    setExerciseHistory(Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date)))
  }

  async function deleteProgram(programId: string) {
    const prog = programs.find(p => p.id === programId)
    const hasWorkouts = (prog?.completedWorkouts ?? 0) > 0
    const msg = hasWorkouts
      ? `Dit programma heeft ${prog.completedWorkouts} afgeronde workouts. Trainingsdata wordt losgekoppeld. Weet je het zeker?`
      : 'Weet je zeker dat je dit programma wilt verwijderen?'
    if (!confirm(msg)) return

    setDeletingId(programId)

    // Collect all day_ids from this program's weeks/days
    const prog2 = programs.find(p => p.id === programId)
    const allDayIds: string[] = []
    prog2?.program_weeks?.forEach((w: any) => {
      w.program_days?.forEach((d: any) => { allDayIds.push(d.id) })
    })

    // Unlink workout_logs: set both program_id AND day_id to null
    const { error: unlinkError } = await supabase
      .from('workout_logs')
      .update({ program_id: null, day_id: null })
      .eq('program_id', programId)

    if (unlinkError) {
      alert(`Kon workout logs niet loskoppelen: ${unlinkError.message}`)
      setDeletingId(null)
      return
    }

    // Also unlink any workout_logs that reference day_ids from this program
    // Use chunking for safety with large programs
    if (allDayIds.length > 0) {
      const CHUNK = 80
      for (let i = 0; i < allDayIds.length; i += CHUNK) {
        await supabase
          .from('workout_logs')
          .update({ day_id: null })
          .in('day_id', allDayIds.slice(i, i + CHUNK))
      }
    }

    // Now delete the program (cascades to weeks -> days -> exercises)
    const { error } = await supabase.from('programs').delete().eq('id', programId)
    if (error) {
      alert(`Kon programma niet verwijderen: ${error.message}`)
      setDeletingId(null)
      return
    }
    setPrograms(prev => prev.filter(p => p.id !== programId))
    setDeletingId(null)
  }

  async function toggleProgramActive(programId: string, currentlyActive: boolean) {
    setTogglingId(programId)

    if (!currentlyActive) {
      await supabase
        .from('programs')
        .update({ is_active: false })
        .eq('client_id', clientId)
        .eq('is_active', true)
    }

    const { error } = await supabase
      .from('programs')
      .update({ is_active: !currentlyActive })
      .eq('id', programId)

    if (error) {
      alert(`Kon status niet wijzigen: ${error.message}`)
      setTogglingId(null)
      return
    }

    setPrograms(prev => prev.map(p => {
      if (p.id === programId) return { ...p, is_active: !currentlyActive }
      if (!currentlyActive) return { ...p, is_active: false }
      return p
    }))
    setTogglingId(null)
  }

  function startEditing(pe: any) {
    setEditingExercise(pe.id)
    setEditValues({
      sets: pe.sets,
      reps: pe.reps,
      weight_kg: pe.weight_kg,
      rest_seconds: pe.rest_seconds,
      notes: pe.notes,
    })
  }

  function cancelEdit() {
    setEditingExercise(null)
    setEditValues({})
  }

  async function saveExerciseEdit(peId: string) {
    setSavingExercise(peId)

    const { error } = await supabase
      .from('program_exercises')
      .update({
        sets: editValues.sets,
        reps: editValues.reps,
        weight_kg: editValues.weight_kg,
        rest_seconds: editValues.rest_seconds,
        notes: editValues.notes,
      })
      .eq('id', peId)

    if (error) {
      alert(`Kon oefening niet opslaan: ${error.message}`)
      setSavingExercise(null)
      return
    }

    // Update local state
    setPrograms(prev => prev.map(prog => ({
      ...prog,
      program_weeks: prog.program_weeks?.map((week: any) => ({
        ...week,
        program_days: week.program_days?.map((day: any) => ({
          ...day,
          program_exercises: day.program_exercises?.map((pe: any) =>
            pe.id === peId ? { ...pe, ...editValues } : pe
          ),
        })),
      })),
    })))

    setEditingExercise(null)
    setEditValues({})
    setSavingExercise(null)
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

      {/* Tabs — 3 tabs without chat */}
      <div className="flex bg-zinc-900 border-b border-zinc-800 flex-shrink-0">
        {[
          { key: 'trainingen', label: `🏋️ Trainingen` },
          { key: 'programmas', label: `📋 Programma's` },
          { key: 'readiness', label: '📊 Readiness' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`flex-1 py-3 text-xs font-semibold border-b-2 transition ${
              activeTab === tab.key ? 'text-orange-500 border-orange-500' : 'text-zinc-500 border-transparent'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* TRAININGEN TAB */}
      {activeTab === 'trainingen' && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

          {/* Exercise History Panel (Google Sheets style) */}
          {exerciseHistoryView && (
            <div className="bg-zinc-900 border-2 border-orange-500/40 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-black text-sm">📊 {exerciseHistoryName}</h3>
                <button onClick={() => setExerciseHistoryView(null)}
                  className="text-zinc-500 text-xs bg-zinc-800 px-2 py-1 rounded-lg hover:text-white transition">
                  ✕ Sluiten
                </button>
              </div>
              <p className="text-zinc-500 text-xs">Gewicht & reps per datum — alle sessies</p>

              {exerciseHistory.length === 0 ? (
                <p className="text-zinc-600 text-xs py-4 text-center">Geen data gevonden</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800">
                        <th className="text-left text-zinc-500 font-semibold py-2 pr-3 sticky left-0 bg-zinc-900">Datum</th>
                        <th className="text-center text-zinc-500 font-semibold py-2 px-2">Set</th>
                        <th className="text-right text-zinc-500 font-semibold py-2 px-2">Gewicht</th>
                        <th className="text-right text-zinc-500 font-semibold py-2 px-2">Reps</th>
                        <th className="text-right text-zinc-500 font-semibold py-2 px-2">RPE</th>
                        <th className="text-right text-zinc-500 font-semibold py-2 pl-2">Volume</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exerciseHistory.map((day) => (
                        day.sets.map((set: any, si: number) => (
                          <tr key={`${day.date}-${si}`} className={si === 0 ? 'border-t border-zinc-800/50' : ''}>
                            <td className="text-zinc-400 font-semibold py-1.5 pr-3 sticky left-0 bg-zinc-900">
                              {si === 0 ? format(parseISO(day.date), 'd MMM', { locale: nl }) : ''}
                            </td>
                            <td className="text-center text-zinc-600 py-1.5 px-2">S{set.set_number}</td>
                            <td className="text-right text-white font-bold py-1.5 px-2">{set.weight_kg ?? '–'} kg</td>
                            <td className="text-right text-zinc-300 py-1.5 px-2">× {set.reps_completed ?? '–'}</td>
                            <td className="text-right py-1.5 px-2">
                              {set.rpe ? (
                                <span className={`px-1.5 py-0.5 rounded font-bold ${
                                  set.rpe >= 9.5 ? 'bg-red-500/20 text-red-400' :
                                  set.rpe >= 8 ? 'bg-orange-500/20 text-orange-400' :
                                  'bg-green-500/20 text-green-400'
                                }`}>{set.rpe}</span>
                              ) : <span className="text-zinc-700">–</span>}
                            </td>
                            <td className="text-right text-zinc-600 py-1.5 pl-2">
                              {((set.weight_kg ?? 0) * (set.reps_completed ?? 0))} kg
                            </td>
                          </tr>
                        ))
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {exerciseHistory.length > 0 && (() => {
                const allSets = exerciseHistory.flatMap(d => d.sets)
                const maxWeight = Math.max(...allSets.map((s: any) => s.weight_kg ?? 0))
                const firstWeight = exerciseHistory[0].sets[0]?.weight_kg ?? 0
                const lastWeight = exerciseHistory[exerciseHistory.length - 1].sets[0]?.weight_kg ?? 0
                const progression = firstWeight > 0 ? lastWeight - firstWeight : 0
                return (
                  <div className="flex gap-3 pt-2 border-t border-zinc-800">
                    <div className="bg-zinc-800 rounded-lg px-3 py-2 flex-1 text-center">
                      <p className="text-zinc-500 text-[10px]">PR</p>
                      <p className="text-orange-400 font-black text-sm">{maxWeight} kg</p>
                    </div>
                    <div className="bg-zinc-800 rounded-lg px-3 py-2 flex-1 text-center">
                      <p className="text-zinc-500 text-[10px]">Sessies</p>
                      <p className="text-white font-black text-sm">{exerciseHistory.length}</p>
                    </div>
                    <div className="bg-zinc-800 rounded-lg px-3 py-2 flex-1 text-center">
                      <p className="text-zinc-500 text-[10px]">Progressie</p>
                      <p className={`font-black text-sm ${progression > 0 ? 'text-green-400' : progression < 0 ? 'text-red-400' : 'text-zinc-400'}`}>
                        {progression > 0 ? '+' : ''}{progression} kg
                      </p>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

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
                  : '–'}
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
                    <button onClick={() => loadWorkoutDetail(log.id)}
                      className="w-full px-4 py-3 text-left hover:bg-zinc-800/50 transition">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-white font-bold text-sm">{log.program_days?.label ?? 'Workout'}</p>
                            {log.feeling && <span className="text-base">{feelingEmoji[log.feeling]}</span>}
                          </div>
                          <p className="text-zinc-500 text-xs mt-0.5">
                            {format(parseISO(log.logged_at), 'EEE d MMM yyyy', { locale: nl })}
                          </p>
                          <div className="flex gap-3 mt-1">
                            <span className="text-zinc-400 text-xs">{log.setsCount} sets</span>
                            {log.volume > 0 && (
                              <span className="text-zinc-400 text-xs">
                                {log.volume >= 1000 ? `${Math.round(log.volume / 1000)}k` : Math.round(log.volume)} kg vol.
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

                    {expandedWorkout === log.id && workoutDetails[log.id] && (
                      <div className="px-4 pb-3 space-y-2">
                        {workoutDetails[log.id].map((group: any, gi: number) => (
                          <div key={gi} className="bg-zinc-800/50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-zinc-600 text-xs font-bold">{gi + 1}</span>
                                <span className="text-white text-xs font-bold">{group.exercise?.name}</span>
                                {group.exercise?.muscle_group && (
                                  <span className="text-zinc-500 text-[10px]">{group.exercise.muscle_group}</span>
                                )}
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); loadExerciseHistory(group.exercise?.id, group.exercise?.name ?? 'Oefening') }}
                                className="text-[10px] text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded hover:bg-orange-500/20 transition">
                                📊 Historie
                              </button>
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
                                    }`}>RPE {set.rpe}</span>
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
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                <p className="text-white font-bold text-sm mb-3">Readiness trend (14 dagen)</p>
                <div className="flex items-end gap-1 h-20">
                  {readinessHistory.slice().reverse().map((r: any, i: number) => {
                    const score = r.readiness_score ?? 0
                    const h = (score / 5) * 100
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className={`w-full rounded-t ${
                          score >= 4 ? 'bg-green-500' : score >= 3 ? 'bg-yellow-500' : score >= 2 ? 'bg-orange-500' : 'bg-red-500'
                        }`} style={{ height: `${h}%`, minHeight: score > 0 ? '4px' : '0' }} />
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
                        }`}>{r.readiness_score?.toFixed(1) ?? '–'}/5</span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[10px]">
                        {r.sleep_hours && <span className="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">💤 {r.sleep_hours}u</span>}
                        {r.sleep_quality && <span className="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">Slaap: {r.sleep_quality}/5</span>}
                        {r.energy_level && <span className="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">Energie: {r.energy_level}/5</span>}
                        {r.muscle_soreness && <span className="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">Spierpijn: {r.muscle_soreness}/5</span>}
                        {r.stress_level && <span className="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">Stress: {r.stress_level}/5</span>}
                      </div>
                      {r.notes && <p className="text-zinc-600 text-xs mt-1 italic">{r.notes}</p>}
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
            programs.map(prog => {
              const isExpanded = expandedProgram === prog.id
              const progressPct = prog.totalDays > 0
                ? Math.round((prog.completedWorkouts / prog.totalDays) * 100) : 0
              const performedData = programPerformedData[prog.id] ?? {}

              return (
                <div key={prog.id} className={`bg-zinc-900 border rounded-2xl overflow-hidden ${
                  prog.is_active ? 'border-orange-500/40' : 'border-zinc-800'
                }`}>
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xl">{goalEmoji[prog.goal] ?? '📋'}</span>
                          <p className="text-white font-bold">{prog.name}</p>
                          {prog.is_active ? (
                            <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-bold">Actief</span>
                          ) : (
                            <span className="text-[10px] bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full font-bold">Inactief</span>
                          )}
                        </div>
                        <p className="text-zinc-500 text-xs mt-0.5">
                          {prog.start_date ? format(parseISO(prog.start_date), 'd MMMM yyyy', { locale: nl }) : '–'}
                          {' · '}{goalLabel[prog.goal] ?? prog.goal}
                        </p>
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-zinc-500 text-[10px]">{prog.completedWorkouts}/{prog.totalDays} trainingen</span>
                        <span className="text-zinc-500 text-[10px] font-bold">{progressPct}%</span>
                      </div>
                      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${prog.is_active ? 'bg-orange-500' : 'bg-zinc-600'}`}
                          style={{ width: `${Math.min(progressPct, 100)}%` }} />
                      </div>
                    </div>

                    <div className="flex gap-2 flex-wrap mb-3">
                      <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded-lg">
                        {prog.numWeeks} {prog.numWeeks === 1 ? 'week' : 'weken'}
                      </span>
                      <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded-lg">
                        {prog.totalDays} trainingsdagen
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const newId = isExpanded ? null : prog.id
                          setExpandedProgram(newId)
                          if (newId) loadProgramPerformedData(prog.id)
                        }}
                        className="flex-1 text-xs text-white bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2
                                   hover:bg-zinc-700 transition font-semibold">
                        {isExpanded ? '▲ Inklappen' : '▼ Bekijk details'}
                      </button>
                      <button
                        onClick={() => toggleProgramActive(prog.id, prog.is_active)}
                        disabled={togglingId === prog.id}
                        className={`text-xs rounded-lg px-3 py-2 transition font-semibold ${
                          prog.is_active
                            ? 'text-zinc-400 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700'
                            : 'text-orange-400 bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20'
                        }`}>
                        {togglingId === prog.id ? '...' : prog.is_active ? 'Deactiveer' : 'Activeer'}
                      </button>
                      <button
                        onClick={() => deleteProgram(prog.id)}
                        disabled={deletingId === prog.id}
                        className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2
                                   hover:bg-red-500/20 transition font-semibold">
                        {deletingId === prog.id ? '...' : '🗑'}
                      </button>
                    </div>
                  </div>

                  {/* Expanded: program structure with performed weights */}
                  {isExpanded && prog.program_weeks && (
                    <div className="border-t border-zinc-800 px-4 pb-4 pt-3 space-y-3">
                      <button className="text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 px-3 py-1.5 rounded-lg hover:bg-orange-500/20 transition font-semibold flex items-center gap-1.5">
                        ✏️ Programma aanpassen
                      </button>
                      {prog.program_weeks.map((week: any) => {
                        const days = week.program_days?.sort((a: any, b: any) => a.day_number - b.day_number) ?? []
                        return (
                          <div key={week.id}>
                            <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-2">
                              {week.label || `Week ${week.week_number}`}
                            </p>
                            <div className="space-y-2">
                              {days.map((day: any) => {
                                const exercises = day.program_exercises
                                  ?.sort((a: any, b: any) => a.order_index - b.order_index) ?? []
                                const isDone = prog.completedDays?.has(day.id)
                                const dayPerformed = performedData[day.id] ?? []

                                // Group performed data by exercise_id
                                const performedByExercise: Record<string, any[]> = {}
                                dayPerformed.forEach((el: any) => {
                                  if (!performedByExercise[el.exercise_id]) performedByExercise[el.exercise_id] = []
                                  performedByExercise[el.exercise_id].push(el)
                                })

                                return (
                                  <div key={day.id}
                                    className={`rounded-lg p-3 ${
                                      isDone ? 'bg-green-500/5 border border-green-500/20' : 'bg-zinc-800/50'
                                    }`}>
                                    <div className="flex items-center gap-2 mb-2">
                                      {isDone && <span className="text-green-400 text-xs">✓</span>}
                                      <span className="text-white text-xs font-bold">{day.label}</span>
                                      {day.rest_day && <span className="text-zinc-600 text-xs">😴 Rust</span>}
                                    </div>

                                    {!day.rest_day && exercises.length > 0 && (
                                      <div className="space-y-2">
                                        {exercises.map((pe: any, ei: number) => {
                                          const performed = performedByExercise[pe.exercise_id]
                                          const isEditing = editingExercise === pe.id

                                          return (
                                            <div key={pe.id} className={`rounded-lg p-2 ${isEditing ? 'bg-zinc-800/80 border border-orange-500/30' : 'bg-zinc-900/50'}`}>
                                              {isEditing ? (
                                                // Edit form
                                                <div className="space-y-2">
                                                  <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                      <span className="text-zinc-600 text-[10px] font-bold">{ei + 1}.</span>
                                                      <span className="text-zinc-300 text-xs font-semibold">
                                                        {pe.exercises?.name ?? 'Oefening'}
                                                      </span>
                                                    </div>
                                                  </div>

                                                  <div className="grid grid-cols-5 gap-1.5">
                                                    <div className="flex flex-col gap-1">
                                                      <label className="text-[9px] text-zinc-500 font-bold">Sets</label>
                                                      <input
                                                        type="number"
                                                        min="1"
                                                        value={editValues.sets ?? pe.sets}
                                                        onChange={(e) => setEditValues({ ...editValues, sets: parseInt(e.target.value) || 1 })}
                                                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-white text-xs text-center"
                                                      />
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                      <label className="text-[9px] text-zinc-500 font-bold">Reps</label>
                                                      <input
                                                        type="number"
                                                        min="1"
                                                        value={editValues.reps ?? pe.reps}
                                                        onChange={(e) => setEditValues({ ...editValues, reps: parseInt(e.target.value) || 1 })}
                                                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-white text-xs text-center"
                                                      />
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                      <label className="text-[9px] text-zinc-500 font-bold">Kg</label>
                                                      <input
                                                        type="number"
                                                        step="0.5"
                                                        min="0"
                                                        value={editValues.weight_kg ?? pe.weight_kg ?? ''}
                                                        onChange={(e) => setEditValues({ ...editValues, weight_kg: e.target.value ? parseFloat(e.target.value) : null })}
                                                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-white text-xs text-center"
                                                      />
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                      <label className="text-[9px] text-zinc-500 font-bold">Rest</label>
                                                      <input
                                                        type="number"
                                                        min="0"
                                                        step="15"
                                                        value={editValues.rest_seconds ?? pe.rest_seconds ?? ''}
                                                        onChange={(e) => setEditValues({ ...editValues, rest_seconds: e.target.value ? parseInt(e.target.value) : null })}
                                                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-white text-xs text-center"
                                                      />
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                      <label className="text-[9px] text-zinc-500 font-bold">Notes</label>
                                                      <input
                                                        type="text"
                                                        value={editValues.notes ?? pe.notes ?? ''}
                                                        onChange={(e) => setEditValues({ ...editValues, notes: e.target.value })}
                                                        placeholder="..."
                                                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-white text-xs text-center placeholder-zinc-600"
                                                      />
                                                    </div>
                                                  </div>

                                                  <div className="flex gap-1.5 mt-2">
                                                    <button
                                                      onClick={() => saveExerciseEdit(pe.id)}
                                                      disabled={savingExercise === pe.id}
                                                      className="flex-1 text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded hover:bg-green-500/20 transition font-semibold disabled:opacity-50">
                                                      {savingExercise === pe.id ? 'Opslaan...' : '✓ Opslaan'}
                                                    </button>
                                                    <button
                                                      onClick={cancelEdit}
                                                      className="flex-1 text-[10px] text-zinc-500 bg-zinc-800 border border-zinc-700 px-2 py-1 rounded hover:bg-zinc-700 transition font-semibold">
                                                      ✕ Annuleren
                                                    </button>
                                                  </div>
                                                </div>
                                              ) : (
                                                // Read-only view
                                                <>
                                                  <div className="flex items-center justify-between mb-1">
                                                    <div className="flex items-center gap-2">
                                                      <span className="text-zinc-600 text-[10px] font-bold">{ei + 1}.</span>
                                                      <button
                                                        onClick={() => loadExerciseHistory(pe.exercise_id, pe.exercises?.name ?? 'Oefening')}
                                                        className="text-zinc-300 hover:text-orange-400 transition text-xs font-semibold text-left">
                                                        {pe.exercises?.name ?? 'Oefening'}
                                                      </button>
                                                      {pe.exercises?.muscle_group && pe.exercises.muscle_group !== 'general' && (
                                                        <span className="text-zinc-700 text-[10px]">{pe.exercises.muscle_group}</span>
                                                      )}
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                      <span className="text-zinc-600 text-[10px]">
                                                        Plan: {pe.sets}×{pe.reps}{pe.weight_kg ? ` · ${pe.weight_kg}kg` : ''}
                                                      </span>
                                                      <button
                                                        onClick={() => startEditing(pe)}
                                                        className="text-zinc-500 hover:text-orange-400 transition text-xs"
                                                        title="Edit exercise">
                                                        ✏️
                                                      </button>
                                                    </div>
                                                  </div>

                                                  {/* Performed sets */}
                                                  {performed && performed.length > 0 ? (
                                                    <div className="mt-1 space-y-0.5">
                                                      {performed
                                                        .sort((a: any, b: any) => a.set_number - b.set_number)
                                                        .map((set: any, si: number) => (
                                                        <div key={si} className="flex items-center gap-2 text-[11px]">
                                                          <span className="text-zinc-700 w-5">S{set.set_number}</span>
                                                          <span className="text-white font-bold">{set.weight_kg ?? '–'} kg</span>
                                                          <span className="text-zinc-400">× {set.reps_completed ?? '–'}</span>
                                                          {set.rpe && (
                                                            <span className={`px-1 py-0.5 rounded text-[10px] font-bold ${
                                                              set.rpe >= 9.5 ? 'bg-red-500/20 text-red-400' :
                                                              set.rpe >= 8 ? 'bg-orange-500/20 text-orange-400' :
                                                              'bg-green-500/20 text-green-400'
                                                            }`}>RPE {set.rpe}</span>
                                                          )}
                                                        </div>
                                                      ))}
                                                    </div>
                                                  ) : isDone ? (
                                                    <p className="text-zinc-700 text-[10px] mt-1 italic">Geen sets gelogd</p>
                                                  ) : null}
                                                </>
                                              )}
                                            </div>
                                          )
                                        })}
                                      </div>
                                    )}
                                    {!day.rest_day && exercises.length === 0 && (
                                      <p className="text-zinc-600 text-[11px]">Geen oefeningen toegevoegd</p>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
