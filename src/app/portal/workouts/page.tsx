'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { format, differenceInDays } from 'date-fns'
import { nl } from 'date-fns/locale'

export default function WorkoutsPage() {
  const supabase = createClient()
  const router = useRouter()

  const [profile, setProfile] = useState<any>(null)
  const [program, setProgram] = useState<any>(null)
  const [allWeeks, setAllWeeks] = useState<any[]>([])
  const [selectedDay, setSelectedDay] = useState<any>(null)
  const [previousLogs, setPreviousLogs] = useState<Record<string, any>>({})
  const [personalRecords, setPersonalRecords] = useState<Record<string, number>>({})
  const [workoutLogId, setWorkoutLogId] = useState<string | null>(null)
  const [workoutStarted, setWorkoutStarted] = useState(false)
  const [workoutDone, setWorkoutDone] = useState(false)
  const [feeling, setFeeling] = useState(3)
  const [setLogs, setSetLogs] = useState<Record<string, { weight: string, reps: string, done: boolean }[]>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0)
  const [activeDayId, setActiveDayId] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/portal/login'); return }

    const { data: prof } = await supabase
      .from('profiles').select('*').eq('id', user.id).single()
    setProfile(prof)

    const { data: prog } = await supabase
      .from('programs')
      .select(`*, program_weeks(*, program_days(*, program_exercises(*, exercises(*))))`)
      .eq('client_id', user.id)
      .eq('is_active', true)
      .order('logged_at', { ascending: false })
      .limit(1).single()

    if (prog) {
      setProgram(prog)
      const weeks = prog.program_weeks
        ?.sort((a: any, b: any) => a.week_number - b.week_number)
        .map((w: any) => ({
          ...w,
          program_days: w.program_days
            ?.sort((a: any, b: any) => a.day_number - b.day_number)
            .map((d: any) => ({
              ...d,
              program_exercises: d.program_exercises
                ?.sort((a: any, b: any) => a.order_index - b.order_index)
            }))
        })) ?? []
      setAllWeeks(weeks)

      const daysSinceStart = differenceInDays(new Date(), new Date(prog.start_date))
      const weekIndex = Math.min(Math.floor(daysSinceStart / 7), weeks.length - 1)
      setCurrentWeekIndex(Math.max(0, weekIndex))

      // Check voor actieve (onafgeronde) workout van vandaag
      const today = new Date().toISOString().split('T')[0]
      const { data: activeLog } = await supabase
        .from('workout_logs')
        .select('*')
        .eq('client_id', user.id)
        .eq('program_id', prog.id)
        .gte('logged_at', today)
        .is('completed_at', null)
        .order('logged_at', { ascending: false })
        .limit(1).single()

      if (activeLog) {
        setWorkoutLogId(activeLog.id)
        setActiveDayId(activeLog.day_id)

        const allDays = weeks.flatMap((w: any) => w.program_days ?? [])
        const activeDay = allDays.find((d: any) => d.id === activeLog.day_id)
        if (activeDay) {
          await restoreWorkoutState(activeDay, activeLog.id, user.id)
          setSelectedDay(activeDay)
          setWorkoutStarted(true)
        }
      }

      // Persoonlijke records — via workout_logs join
      const { data: prData } = await supabase
        .from('exercise_logs')
        .select('exercise_id, weight_kg, workout_logs!inner(client_id)')
        .eq('workout_logs.client_id', user.id)
        .not('weight_kg', 'is', null)
        .order('weight_kg', { ascending: false })

      const prMap: Record<string, number> = {}
      prData?.forEach((log: any) => {
        if (!prMap[log.exercise_id] || log.weight_kg > prMap[log.exercise_id]) {
          prMap[log.exercise_id] = log.weight_kg
        }
      })
      setPersonalRecords(prMap)
    }

    setLoading(false)
  }

  async function restoreWorkoutState(day: any, logId: string, userId: string) {
    const exerciseIds = day.program_exercises?.map((pe: any) => pe.exercise_id) ?? []

    // Vorige logs van afgeronde workouts ter referentie
    const { data: completedWorkoutIds } = await supabase
      .from('workout_logs')
      .select('id')
      .eq('client_id', userId)
      .not('completed_at', 'is', null)

    const completedIds = completedWorkoutIds?.map((w: any) => w.id) ?? []

    const prevLogs = completedIds.length > 0 ? (await supabase
      .from('exercise_logs')
      .select('*')
      .in('exercise_id', exerciseIds)
      .in('workout_log_id', completedIds)
      .order('set_number', { ascending: false })).data ?? [] : []

    const lastLog: Record<string, any> = {}
    prevLogs.forEach((log: any) => {
      if (!lastLog[log.exercise_id]) lastLog[log.exercise_id] = log
    })
    setPreviousLogs(lastLog)

    // Al gelogde sets van huidige workout
    const { data: currentLogs } = await supabase
      .from('exercise_logs')
      .select('*')
      .eq('workout_log_id', logId)
      .order('set_number', { ascending: true })

    const loggedSets: Record<string, any[]> = {}
    currentLogs?.forEach((log: any) => {
      if (!loggedSets[log.exercise_id]) loggedSets[log.exercise_id] = []
      loggedSets[log.exercise_id].push(log)
    })

    const restoredSets: Record<string, { weight: string, reps: string, done: boolean }[]> = {}
    day.program_exercises?.forEach((pe: any) => {
      const logged = loggedSets[pe.exercise_id] ?? []
      const prev = lastLog[pe.exercise_id]
      const repsDefault = parseRepsDefault(pe.reps)
      restoredSets[pe.id] = Array.from({ length: pe.sets ?? 3 }, (_, i) => {
        const loggedSet = logged[i]
        return {
          weight: loggedSet?.weight_kg?.toString() ?? prev?.weight_kg?.toString() ?? pe.weight_kg?.toString() ?? '',
          reps: loggedSet?.reps_completed?.toString() ?? prev?.reps_completed?.toString() ?? repsDefault,
          done: !!loggedSet,
        }
      })
    })
    setSetLogs(restoredSets)
  }

  // Parse "8-10" → "8", "12" → "12"
  function parseRepsDefault(reps: any): string {
    if (!reps) return ''
    const str = reps.toString()
    if (str.includes('-')) return str.split('-')[0]
    return str
  }

  async function selectDay(day: any) {
    if (day.id === activeDayId && workoutLogId) {
      setSelectedDay(day)
      setWorkoutStarted(true)
      return
    }

    setSelectedDay(day)
    setWorkoutStarted(false)

    const exerciseIds = day.program_exercises?.map((pe: any) => pe.exercise_id) ?? []
    if (exerciseIds.length === 0) return

    // Alleen logs van afgeronde workouts
    const { data: completedWorkouts } = await supabase
      .from('workout_logs')
      .select('id')
      .eq('client_id', profile.id)
      .not('completed_at', 'is', null)

    const completedIds = completedWorkouts?.map((w: any) => w.id) ?? []

    const logs = completedIds.length > 0 ? (await supabase
      .from('exercise_logs')
      .select('*')
      .in('exercise_id', exerciseIds)
      .in('workout_log_id', completedIds)
      .order('set_number', { ascending: false })).data ?? [] : []

    const lastLog: Record<string, any> = {}
    logs.forEach((log: any) => {
      if (!lastLog[log.exercise_id]) lastLog[log.exercise_id] = log
    })
    setPreviousLogs(lastLog)

    const initSets: Record<string, { weight: string, reps: string, done: boolean }[]> = {}
    day.program_exercises?.forEach((pe: any) => {
      const prev = lastLog[pe.exercise_id]
      const repsDefault = parseRepsDefault(pe.reps)
      initSets[pe.id] = Array.from({ length: pe.sets ?? 3 }, () => ({
        weight: prev?.weight_kg?.toString() ?? pe.weight_kg?.toString() ?? '',
        reps: prev?.reps_completed?.toString() ?? repsDefault,
        done: false,
      }))
    })
    setSetLogs(initSets)
  }

  async function startWorkout() {
    if (!profile || !selectedDay) return
    setSaving(true)
    const { data: log } = await supabase
      .from('workout_logs')
      .insert({ client_id: profile.id, program_id: program.id, day_id: selectedDay.id })
      .select().single()
    if (log) {
      setWorkoutLogId(log.id)
      setActiveDayId(selectedDay.id)
      setWorkoutStarted(true)
    }
    setSaving(false)
  }

  async function toggleSet(peId: string, setIndex: number) {
    const current = setLogs[peId]?.[setIndex]
    if (!current) return
    const newDone = !current.done

    setSetLogs(prev => ({
      ...prev,
      [peId]: prev[peId].map((s, i) => i === setIndex ? { ...s, done: newDone } : s)
    }))

    if (!workoutLogId) return
    const pe = selectedDay.program_exercises?.find((e: any) => e.id === peId)
    if (!pe) return

    if (newDone) {
      const weight = parseFloat(current.weight) || null
      const reps = parseInt(current.reps) || null
      await supabase.from('exercise_logs').insert({
        workout_log_id: workoutLogId,
        exercise_id: pe.exercise_id,
        program_exercise_id: pe.id,
        set_number: setIndex + 1,
        weight_kg: weight,
        reps_completed: reps,
      })
      if (weight && weight > (personalRecords[pe.exercise_id] ?? 0)) {
        setPersonalRecords(prev => ({ ...prev, [pe.exercise_id]: weight }))
      }
    } else {
      await supabase.from('exercise_logs')
        .delete()
        .eq('workout_log_id', workoutLogId)
        .eq('exercise_id', pe.exercise_id)
        .eq('set_number', setIndex + 1)
    }
  }

  async function finishWorkout() {
    if (!workoutLogId) return
    setSaving(true)
    const { error } = await supabase.from('workout_logs')
      .update({ feeling, completed_at: new Date().toISOString() })
      .eq('id', workoutLogId)
    if (error) console.error('finishWorkout error:', error)
    setActiveDayId(null)
    setWorkoutDone(true)
    setSaving(false)
  }

  const completedSets = Object.values(setLogs).flat().filter(s => s.done).length
  const totalSets = Object.values(setLogs).flat().length

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (workoutDone) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 pb-24">
      <div className="text-center">
        <div className="text-7xl mb-4">🏆</div>
        <h1 className="text-white text-3xl font-black mb-2">Workout voltooid!</h1>
        <p className="text-zinc-500 text-sm mb-2">Goed werk, {profile?.full_name?.split(' ')[0]}!</p>
        <p className="text-zinc-600 text-xs mb-8">{completedSets} sets voltooid</p>
        <button onClick={() => {
          setWorkoutDone(false)
          setSelectedDay(null)
          setWorkoutStarted(false)
          setWorkoutLogId(null)
        }} className="bg-orange-500 text-white font-bold py-3 px-8 rounded-xl">
          Terug naar overzicht
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">

      {/* Header */}
      <div className="bg-zinc-900 px-5 pt-12 pb-4 border-b border-zinc-800">
        {selectedDay ? (
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setSelectedDay(null); setWorkoutStarted(false) }}
              className="flex items-center gap-1.5 bg-orange-500/15 text-orange-400
                         font-bold text-sm px-3 py-1.5 rounded-xl border border-orange-500/30
                         hover:bg-orange-500/25 transition flex-shrink-0"
            >
              ← Terug
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-orange-500 text-xs font-bold tracking-widest uppercase truncate">
                {program?.name}
              </p>
              <h1 className="text-white text-xl font-black">{selectedDay.label}</h1>
            </div>
            {workoutStarted && (
              <div className="text-right flex-shrink-0">
                <p className="text-zinc-500 text-xs">Voortgang</p>
                <p className="text-white font-bold text-sm">{completedSets}/{totalSets}</p>
              </div>
            )}
          </div>
        ) : (
          <>
            <p className="text-orange-500 text-xs font-bold tracking-widest uppercase mb-1">Workouts</p>
            <h1 className="text-white text-2xl font-black">{program?.name ?? 'Geen programma'}</h1>
            <p className="text-zinc-500 text-xs mt-1">
              {format(new Date(), 'EEEE d MMMM', { locale: nl })}
            </p>
          </>
        )}
      </div>

      {/* Geen programma */}
      {!program && (
        <div className="px-4 py-8 text-center">
          <div className="text-4xl mb-3">🏋️</div>
          <h2 className="text-white font-bold mb-2">Nog geen programma</h2>
          <p className="text-zinc-500 text-sm">Je coach wijst binnenkort een programma toe.</p>
        </div>
      )}

      {/* DAGOVERZICHT */}
      {program && !selectedDay && (
        <div className="px-4 py-4 space-y-4">

          {activeDayId && (
            <button
              onClick={() => {
                const allDays = allWeeks.flatMap(w => w.program_days ?? [])
                const day = allDays.find(d => d.id === activeDayId)
                if (day) selectDay(day)
              }}
              className="w-full bg-orange-500/10 border border-orange-500/40 rounded-2xl p-4
                         flex items-center gap-3 text-left"
            >
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse flex-shrink-0" />
              <div className="flex-1">
                <p className="text-orange-400 font-bold text-sm">Workout bezig</p>
                <p className="text-zinc-500 text-xs">{completedSets}/{totalSets} sets — tik om verder te gaan</p>
              </div>
              <span className="text-orange-400 font-bold">→</span>
            </button>
          )}

          {/* Week tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {allWeeks.map((week, wi) => (
              <button key={week.id} onClick={() => setCurrentWeekIndex(wi)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition ${
                  currentWeekIndex === wi
                    ? 'bg-orange-500 text-white'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-400'
                }`}>
                Week {week.week_number}
              </button>
            ))}
          </div>

          {/* Dagen lijst */}
          <div className="space-y-2">
            {allWeeks[currentWeekIndex]?.program_days?.map((day: any) => {
              const exerciseCount = day.program_exercises?.length ?? 0
              const isActive = day.id === activeDayId
              const muscleGroups = [...new Set(
                day.program_exercises?.map((pe: any) => pe.exercises?.muscle_group).filter(Boolean)
              )] as string[]

              return (
                <button key={day.id} onClick={() => selectDay(day)}
                  className={`w-full rounded-2xl p-4 flex items-center gap-4 transition text-left border ${
                    isActive
                      ? 'bg-orange-500/5 border-orange-500/40'
                      : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'
                  }`}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isActive ? 'bg-orange-500/20' : 'bg-zinc-800'
                  }`}>
                    {isActive
                      ? <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse" />
                      : <span className="text-orange-500 font-black text-lg">{day.day_number}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-bold">{day.label}</p>
                      {isActive && (
                        <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-bold">
                          Bezig
                        </span>
                      )}
                    </div>
                    {day.rest_day ? (
                      <p className="text-zinc-500 text-xs mt-0.5">😴 Rustdag</p>
                    ) : (
                      <>
                        <p className="text-zinc-500 text-xs mt-0.5">
                          {isActive ? `${completedSets}/${totalSets} sets` : `${exerciseCount} oefeningen`}
                        </p>
                        {muscleGroups.length > 0 && (
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {muscleGroups.slice(0, 3).map((mg: string) => (
                              <span key={mg} className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
                                {mg}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <span className={isActive ? 'text-orange-400' : 'text-zinc-600'}>→</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* DAG DETAIL — preview voor start */}
      {program && selectedDay && !workoutStarted && (
        <div className="px-4 py-4 space-y-3">
          {selectedDay.program_exercises?.map((pe: any, idx: number) => {
            const prev = previousLogs[pe.exercise_id]
            const isPR = prev && personalRecords[pe.exercise_id] === prev.weight_kg
            return (
              <div key={pe.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-zinc-600 text-xs font-bold">{idx + 1}</span>
                  <p className="text-white font-bold text-sm">{pe.exercises?.name}</p>
                  {isPR && (
                    <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full font-bold">
                      🏆 PR
                    </span>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-1 rounded-lg">{pe.sets} sets</span>
                  <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-1 rounded-lg">{pe.reps} reps</span>
                  {pe.weight_kg && (
                    <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-1 rounded-lg">{pe.weight_kg} kg</span>
                  )}
                </div>
                {prev && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-zinc-600 text-xs">Vorige keer:</span>
                    <span className="text-zinc-400 text-xs font-semibold">
                      {prev.weight_kg ? `${prev.weight_kg} kg` : ''} × {prev.reps_completed} reps
                    </span>
                  </div>
                )}
                {pe.notes && (
                  <p className="text-orange-400/70 text-xs mt-2 italic">💬 {pe.notes}</p>
                )}
              </div>
            )
          })}
          <button onClick={startWorkout} disabled={saving}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black
                       py-4 rounded-2xl text-lg transition mt-2 disabled:opacity-50">
            {saving ? 'Even wachten...' : '💪 Start workout'}
          </button>
        </div>
      )}

      {/* ACTIEVE WORKOUT */}
      {program && selectedDay && workoutStarted && workoutLogId && (
        <div className="px-4 py-4 space-y-3">

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Voortgang</p>
              <p className="text-white font-bold text-sm">{completedSets}/{totalSets} sets</p>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 rounded-full transition-all duration-500"
                style={{ width: totalSets > 0 ? `${(completedSets / totalSets) * 100}%` : '0%' }}
              />
            </div>
          </div>

          {selectedDay.program_exercises?.map((pe: any, idx: number) => {
            const prev = previousLogs[pe.exercise_id]
            const sets = setLogs[pe.id] ?? []
            const allDone = sets.length > 0 && sets.every(s => s.done)
            const isPR = personalRecords[pe.exercise_id] &&
              sets.some(s => s.done && parseFloat(s.weight) >= personalRecords[pe.exercise_id])

            return (
              <div key={pe.id} className={`rounded-2xl border transition-all ${
                allDone ? 'bg-green-500/5 border-green-500/30' : 'bg-zinc-900 border-zinc-800'
              }`}>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-600 text-xs font-bold">{idx + 1}</span>
                      <p className="text-white font-bold text-sm">{pe.exercises?.name}</p>
                      {isPR && (
                        <span className="text-xs bg-yellow-500/20 text-yellow-400
                                         px-1.5 py-0.5 rounded-full font-bold animate-pulse">
                          🏆 PR!
                        </span>
                      )}
                    </div>
                    {allDone && <span className="text-green-400 text-sm font-bold">✓ Klaar</span>}
                  </div>

                  {prev && (
                    <div className="mb-3 flex items-center gap-1.5 bg-zinc-800/50 rounded-lg px-3 py-1.5">
                      <span className="text-zinc-500 text-xs">Vorige keer:</span>
                      <span className="text-zinc-300 text-xs font-semibold">
                        {prev.weight_kg ? `${prev.weight_kg} kg` : ''} × {prev.reps_completed} reps
                      </span>
                    </div>
                  )}

                  <div className="space-y-2">
                    {sets.map((set, si) => (
                      <div key={si} className={`flex items-center gap-2 p-2 rounded-xl transition ${
                        set.done ? 'bg-green-500/10' : 'bg-zinc-800'
                      }`}>
                        <span className="text-zinc-500 text-xs w-6 text-center font-bold">{si + 1}</span>
                        <input type="number" value={set.weight}
                          onChange={e => setSetLogs(prev => ({
                            ...prev,
                            [pe.id]: prev[pe.id].map((s, i) => i === si ? { ...s, weight: e.target.value } : s)
                          }))}
                          placeholder="kg"
                          className="w-16 bg-zinc-700 rounded-lg px-2 py-1.5 text-white
                                     text-xs text-center focus:outline-none focus:ring-1 focus:ring-orange-500"
                        />
                        <span className="text-zinc-600 text-xs">kg</span>
                        <input type="number" value={set.reps}
                          onChange={e => setSetLogs(prev => ({
                            ...prev,
                            [pe.id]: prev[pe.id].map((s, i) => i === si ? { ...s, reps: e.target.value } : s)
                          }))}
                          placeholder="reps"
                          className="w-16 bg-zinc-700 rounded-lg px-2 py-1.5 text-white
                                     text-xs text-center focus:outline-none focus:ring-1 focus:ring-orange-500"
                        />
                        <span className="text-zinc-600 text-xs">reps</span>
                        <button onClick={() => toggleSet(pe.id, si)}
                          className={`ml-auto w-8 h-8 rounded-xl flex items-center justify-center
                                      transition font-bold text-sm ${
                            set.done
                              ? 'bg-green-500 text-white'
                              : 'bg-zinc-700 text-zinc-500 hover:bg-orange-500 hover:text-white'
                          }`}>
                          ✓
                        </button>
                      </div>
                    ))}
                  </div>

                  {pe.notes && (
                    <p className="text-orange-400/70 text-xs mt-3 italic">💬 {pe.notes}</p>
                  )}
                </div>
              </div>
            )
          })}

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <h2 className="text-white font-bold mb-3">Hoe voelde de workout?</h2>
            <div className="flex justify-between mb-4">
              {[
                { val: 1, emoji: '😫', label: 'Zwaar' },
                { val: 2, emoji: '😕', label: 'Meh' },
                { val: 3, emoji: '😊', label: 'Goed' },
                { val: 4, emoji: '💪', label: 'Sterk' },
                { val: 5, emoji: '🔥', label: 'Top!' },
              ].map(({ val, emoji, label }) => (
                <button key={val} onClick={() => setFeeling(val)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl transition ${
                    feeling === val
                      ? 'bg-orange-500/20 border border-orange-500'
                      : 'border border-transparent'
                  }`}>
                  <span className="text-2xl">{emoji}</span>
                  <span className="text-zinc-500 text-xs">{label}</span>
                </button>
              ))}
            </div>
            <button onClick={finishWorkout} disabled={saving}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-black
                         py-4 rounded-2xl text-lg transition disabled:opacity-50">
              {saving ? 'Opslaan...' : '✓ Workout afronden'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}