'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import { useAuth } from '@/hooks/useAuth'
import { PageSpinner } from '@/components/ui/Spinner'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  WorkoutDoneScreen,
  ProgramGrid,
  CompletedRecap,
  DayPreview,
  ActiveWorkout,
} from '@/components/workouts'
import { parseRepsDefault } from '@/utils/calculations'
import { calculateAdjustedWeight, averageRpe, getTrainingRecommendation } from '@/utils/autoAdjust'

type SetLog = { weight: string; reps: string; rpe: string; done: boolean }

export default function WorkoutsPage() {
  const supabase = createClient()
  const { profile, loading: authLoading } = useAuth()

  const [program, setProgram] = useState<any>(null)
  const [allWeeks, setAllWeeks] = useState<any[]>([])
  const [selectedDay, setSelectedDay] = useState<any>(null)
  const [previousLogs, setPreviousLogs] = useState<Record<string, any>>({})
  const [personalRecords, setPersonalRecords] = useState<Record<string, number>>({})
  const [workoutLogId, setWorkoutLogId] = useState<string | null>(null)
  const [workoutStarted, setWorkoutStarted] = useState(false)
  const [workoutDone, setWorkoutDone] = useState(false)
  const [feeling, setFeeling] = useState(3)
  const [setLogs, setSetLogs] = useState<Record<string, SetLog[]>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeDayId, setActiveDayId] = useState<string | null>(null)
  const [completedDayIds, setCompletedDayIds] = useState<Set<string>>(new Set())
  const [completedRecap, setCompletedRecap] = useState<any>(null)
  const [loadingRecap, setLoadingRecap] = useState(false)
  const [suggestedWeights, setSuggestedWeights] = useState<Record<string, number>>({})
  const [readinessScore, setReadinessScore] = useState<number | null>(null)
  const [adjustmentReasons, setAdjustmentReasons] = useState<Record<string, string>>({})

  /* ─── Helpers ─── */

  const fetchPreviousLogs = useCallback(
    async (exerciseIds: string[], userId: string) => {
      if (exerciseIds.length === 0) return {}

      const { data: completedWorkouts } = await supabase
        .from('workout_logs')
        .select('id')
        .eq('client_id', userId)
        .not('completed_at', 'is', null)

      const completedIds = completedWorkouts?.map((w: any) => w.id) ?? []
      if (completedIds.length === 0) return {}

      const { data: logs } = await supabase
        .from('exercise_logs')
        .select('*, workout_logs(logged_at)')
        .in('exercise_id', exerciseIds)
        .in('workout_log_id', completedIds)
        .order('workout_log_id', { ascending: false })

      const lastLog: Record<string, any> = {}
      logs?.forEach((log: any) => {
        const existing = lastLog[log.exercise_id]
        const logDate = log.workout_logs?.logged_at ?? ''
        const existingDate = existing?.workout_logs?.logged_at ?? ''
        if (!existing || logDate > existingDate) lastLog[log.exercise_id] = log
      })
      return lastLog
    },
    [supabase]
  )

  const initSetLogs = useCallback(
    (day: any, prevLogs: Record<string, any>, todayReadiness: number | null = null) => {
      const initSets: Record<string, SetLog[]> = {}
      const suggestions: Record<string, number> = {}
      const reasons: Record<string, string> = {}

      day.program_exercises?.forEach((pe: any) => {
        const prev = prevLogs[pe.exercise_id]
        const repsDefault = parseRepsDefault(pe.reps)

        // Smart weight suggestion with auto-adjustment
        if (prev?.weight_kg) {
          const prevWeight = parseFloat(prev.weight_kg)
          if (prevWeight > 0) {
            const lastRpe = prev?.rpe ? parseFloat(prev.rpe) : null
            const adjustment = calculateAdjustedWeight({
              previousWeight: prevWeight,
              lastSessionAvgRpe: lastRpe,
              readinessScore: todayReadiness,
            })
            suggestions[pe.exercise_id] = adjustment.suggestedWeight
            if (adjustment.adjustmentPercent !== 0) {
              reasons[pe.exercise_id] = adjustment.reason
            }
          }
        }

        // Pre-fill sets with suggested weight (or fall back to previous)
        const suggestedWeight = suggestions[pe.exercise_id]
        const fillWeight = suggestedWeight?.toString() ?? prev?.weight_kg?.toString() ?? pe.weight_kg?.toString() ?? ''

        initSets[pe.id] = Array.from({ length: pe.sets ?? 3 }, () => ({
          weight: fillWeight,
          reps: prev?.reps_completed?.toString() ?? repsDefault,
          rpe: '',
          done: false,
        }))
      })

      setSuggestedWeights(suggestions)
      setAdjustmentReasons(reasons)
      return initSets
    },
    []
  )

  /* ─── Load program data ─── */

  useEffect(() => {
    if (authLoading || !profile) return
    loadProgram()
  }, [authLoading, profile?.id])

  async function loadProgram() {
    if (!profile) return

    const { data: prog } = await supabase
      .from('programs')
      .select(`*, program_weeks(*, program_days(*, program_exercises(*, exercises(*))))`)
      .eq('client_id', profile.id)
      .eq('is_active', true)
      .order('start_date', { ascending: false })
      .limit(1)
      .single()

    if (!prog) {
      setLoading(false)
      return
    }

    setProgram(prog)

    const weeks =
      prog.program_weeks
        ?.sort((a: any, b: any) => a.week_number - b.week_number)
        .map((w: any) => ({
          ...w,
          program_days: w.program_days
            ?.sort((a: any, b: any) => a.day_number - b.day_number)
            .map((d: any) => ({
              ...d,
              program_exercises: d.program_exercises?.sort(
                (a: any, b: any) => a.order_index - b.order_index
              ),
            })),
        })) ?? []
    setAllWeeks(weeks)

    // Fetch today's readiness score
    const todayStr = (() => {
      const now = new Date()
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    })()

    // Parallel data fetching
    const [completedLogsRes, activeLogRes, allUserWlRes, readinessRes] = await Promise.all([
      supabase
        .from('workout_logs')
        .select('day_id')
        .eq('client_id', profile.id)
        .eq('program_id', prog.id)
        .not('completed_at', 'is', null),
      supabase
        .from('workout_logs')
        .select('*')
        .eq('client_id', profile.id)
        .eq('program_id', prog.id)
        .gte('logged_at', new Date().toISOString().split('T')[0])
        .is('completed_at', null)
        .order('logged_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('workout_logs')
        .select('id')
        .eq('client_id', profile.id)
        .not('completed_at', 'is', null),
      supabase
        .from('daily_readiness')
        .select('readiness_score')
        .eq('client_id', profile.id)
        .eq('date', todayStr)
        .maybeSingle(),
    ])

    // Readiness score
    if (readinessRes.data?.readiness_score) {
      setReadinessScore(readinessRes.data.readiness_score)
    }

    // Completed days
    const doneIds = new Set<string>(
      completedLogsRes.data?.map((l: any) => l.day_id).filter(Boolean) ?? []
    )
    setCompletedDayIds(doneIds)

    // Personal records — 2-step: get exercise_logs for user's completed workouts
    const prMap: Record<string, number> = {}
    const userWlIds = allUserWlRes.data?.map((wl: any) => wl.id) ?? []
    if (userWlIds.length > 0) {
      const { data: prLogs } = await supabase
        .from('exercise_logs')
        .select('exercise_id, weight_kg')
        .in('workout_log_id', userWlIds)
        .not('weight_kg', 'is', null)
        .order('weight_kg', { ascending: false })

      prLogs?.forEach((log: any) => {
        if (!prMap[log.exercise_id] || log.weight_kg > prMap[log.exercise_id]) {
          prMap[log.exercise_id] = log.weight_kg
        }
      })
    }
    setPersonalRecords(prMap)

    // Restore active workout if present
    const activeLog = activeLogRes.data
    if (activeLog) {
      setWorkoutLogId(activeLog.id)
      setActiveDayId(activeLog.day_id)

      const allDays = weeks.flatMap((w: any) => w.program_days ?? [])
      const activeDay = allDays.find((d: any) => d.id === activeLog.day_id)
      if (activeDay) {
        await restoreWorkoutState(activeDay, activeLog.id, profile.id)
        setSelectedDay(activeDay)
        setWorkoutStarted(true)
      }
    }

    setLoading(false)
  }

  async function restoreWorkoutState(day: any, logId: string, userId: string) {
    const exerciseIds = day.program_exercises?.map((pe: any) => pe.exercise_id) ?? []
    const prevLogs = await fetchPreviousLogs(exerciseIds, userId)
    setPreviousLogs(prevLogs)

    // Calculate suggested weights for restored workout
    const suggestions: Record<string, number> = {}
    day.program_exercises?.forEach((pe: any) => {
      const prev = prevLogs[pe.exercise_id]
      if (prev?.weight_kg) {
        const prevWeight = parseFloat(prev.weight_kg)
        if (prevWeight > 0) {
          suggestions[pe.exercise_id] = Math.round((prevWeight + 2.5) * 2) / 2
        }
      }
    })
    setSuggestedWeights(suggestions)

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

    const restoredSets: Record<string, SetLog[]> = {}
    day.program_exercises?.forEach((pe: any) => {
      const logged = loggedSets[pe.exercise_id] ?? []
      const prev = prevLogs[pe.exercise_id]
      const repsDefault = parseRepsDefault(pe.reps)
      restoredSets[pe.id] = Array.from({ length: pe.sets ?? 3 }, (_, i) => {
        const loggedSet = logged[i]
        return {
          weight:
            loggedSet?.weight_kg?.toString() ??
            prev?.weight_kg?.toString() ??
            pe.weight_kg?.toString() ??
            '',
          reps:
            loggedSet?.reps_completed?.toString() ??
            prev?.reps_completed?.toString() ??
            repsDefault,
          rpe: loggedSet?.rpe?.toString() ?? '',
          done: !!loggedSet,
        }
      })
    })
    setSetLogs(restoredSets)
  }

  /* ─── Day selection ─── */

  async function selectDay(day: any) {
    setCompletedRecap(null)

    if (day.id === activeDayId && workoutLogId) {
      setSelectedDay(day)
      setWorkoutStarted(true)
      return
    }

    setSelectedDay(day)
    setWorkoutStarted(false)

    if (completedDayIds.has(day.id)) {
      setLoadingRecap(true)
      await loadCompletedRecap(day)
      setLoadingRecap(false)
    }

    const exerciseIds = day.program_exercises?.map((pe: any) => pe.exercise_id) ?? []
    const prevLogs = await fetchPreviousLogs(exerciseIds, profile!.id)
    setPreviousLogs(prevLogs)
    setSetLogs(initSetLogs(day, prevLogs, readinessScore))
  }

  async function loadCompletedRecap(day: any) {
    const { data: latestLog } = await supabase
      .from('workout_logs')
      .select('*, program_days(label), programs(name)')
      .eq('client_id', profile!.id)
      .eq('day_id', day.id)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(1)
      .single()

    if (!latestLog) return

    const { data: exerciseLogs } = await supabase
      .from('exercise_logs')
      .select('*, exercises(id, name, muscle_group)')
      .eq('workout_log_id', latestLog.id)
      .order('set_number', { ascending: true })

    const exerciseGroups: Record<string, any> = {}
    exerciseLogs?.forEach((el: any) => {
      const exId = el.exercise_id
      if (!exerciseGroups[exId]) {
        exerciseGroups[exId] = { exercise: el.exercises, sets: [], maxWeight: 0 }
      }
      exerciseGroups[exId].sets.push(el)
      if (el.weight_kg && el.weight_kg > exerciseGroups[exId].maxWeight) {
        exerciseGroups[exId].maxWeight = el.weight_kg
      }
    })

    const totalVolume =
      exerciseLogs?.reduce(
        (acc: number, el: any) => acc + (el.weight_kg ?? 0) * (el.reps_completed ?? 0),
        0
      ) ?? 0

    setCompletedRecap({
      log: latestLog,
      exerciseGroups: Object.values(exerciseGroups),
      totalVolume,
      totalSets: exerciseLogs?.length ?? 0,
    })
  }

  /* ─── Workout actions ─── */

  async function startWorkout() {
    if (!profile || !selectedDay) return
    setSaving(true)
    const { data: log } = await supabase
      .from('workout_logs')
      .insert({ client_id: profile.id, program_id: program.id, day_id: selectedDay.id })
      .select()
      .single()
    if (log) {
      setWorkoutLogId(log.id)
      setActiveDayId(selectedDay.id)
      setWorkoutStarted(true)
      setCompletedRecap(null)
    }
    setSaving(false)
  }

  function handleSetChange(peId: string, setIndex: number, field: 'weight' | 'reps' | 'rpe', value: string) {
    setSetLogs(prev => ({
      ...prev,
      [peId]: prev[peId].map((s, i) => (i === setIndex ? { ...s, [field]: value } : s)),
    }))

    // If changing RPE on a completed set, update the DB directly
    if (field === 'rpe' && setLogs[peId]?.[setIndex]?.done && workoutLogId) {
      const pe = selectedDay?.program_exercises?.find((e: any) => e.id === peId)
      if (pe) {
        supabase.from('exercise_logs')
          .update({ rpe: parseFloat(value) || null })
          .eq('workout_log_id', workoutLogId)
          .eq('exercise_id', pe.exercise_id)
          .eq('set_number', setIndex + 1)
          .then(({ error }) => { if (error) console.error('RPE update error:', error) })
      }
    }
  }

  async function toggleSet(peId: string, setIndex: number) {
    const current = setLogs[peId]?.[setIndex]
    if (!current) return
    const newDone = !current.done

    setSetLogs(prev => ({
      ...prev,
      [peId]: prev[peId].map((s, i) => (i === setIndex ? { ...s, done: newDone } : s)),
    }))

    if (!workoutLogId) return
    const pe = selectedDay.program_exercises?.find((e: any) => e.id === peId)
    if (!pe) return

    if (newDone) {
      const weight = parseFloat(current.weight) || null
      const reps = parseInt(current.reps) || null
      const rpe = parseFloat(current.rpe) || null
      const { error: insertErr } = await supabase.from('exercise_logs').insert({
        workout_log_id: workoutLogId,
        exercise_id: pe.exercise_id,
        program_exercise_id: pe.id,
        set_number: setIndex + 1,
        weight_kg: weight,
        reps_completed: reps,
        rpe,
      })
      if (insertErr) {
        console.error('exercise_logs INSERT error:', insertErr)
        // Revert the UI toggle
        setSetLogs(prev => ({
          ...prev,
          [peId]: prev[peId].map((s, i) => (i === setIndex ? { ...s, done: false } : s)),
        }))
        return
      }
      if (weight && weight > (personalRecords[pe.exercise_id] ?? 0)) {
        setPersonalRecords(prev => ({ ...prev, [pe.exercise_id]: weight }))
      }
    } else {
      const { error: delErr } = await supabase
        .from('exercise_logs')
        .delete()
        .eq('workout_log_id', workoutLogId)
        .eq('exercise_id', pe.exercise_id)
        .eq('set_number', setIndex + 1)
      if (delErr) {
        console.error('exercise_logs DELETE error:', delErr)
        // Revert the UI toggle on delete failure
        setSetLogs(prev => ({
          ...prev,
          [peId]: prev[peId].map((s, i) => (i === setIndex ? { ...s, done: true } : s)),
        }))
      }
    }
  }

  async function finishWorkout() {
    if (!workoutLogId) return
    setSaving(true)
    await supabase
      .from('workout_logs')
      .update({ feeling, completed_at: new Date().toISOString() })
      .eq('id', workoutLogId)
    if (selectedDay?.id) {
      setCompletedDayIds(prev => new Set([...prev, selectedDay.id]))
    }
    setActiveDayId(null)
    setWorkoutDone(true)
    setSaving(false)
  }

  /* ─── Computed values ─── */

  const completedSets = Object.values(setLogs).flat().filter(s => s.done).length
  const totalSets = Object.values(setLogs).flat().length
  const firstName = profile?.full_name?.split(' ')[0] ?? ''

  /* ─── Render ─── */

  if (authLoading || loading) return <PageSpinner />

  if (workoutDone) {
    return (
      <WorkoutDoneScreen
        firstName={firstName}
        completedSets={completedSets}
        onReset={() => {
          setWorkoutDone(false)
          setSelectedDay(null)
          setWorkoutStarted(false)
          setWorkoutLogId(null)
          setCompletedRecap(null)
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      {/* Header */}
      <div className="bg-zinc-900 px-5 pt-12 pb-4 border-b border-zinc-800">
        {selectedDay ? (
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setSelectedDay(null)
                setWorkoutStarted(false)
                setCompletedRecap(null)
              }}
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
                <p className="text-white font-bold text-sm">
                  {completedSets}/{totalSets}
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            <p className="text-orange-500 text-xs font-bold tracking-widest uppercase mb-1">
              Trainingen
            </p>
            <h1 className="text-white text-2xl font-black">
              {program?.name ?? 'Geen programma'}
            </h1>
            <p className="text-zinc-500 text-xs mt-1">
              {format(new Date(), 'EEEE d MMMM', { locale: nl })}
            </p>
          </>
        )}
      </div>

      {/* No program */}
      {!program && (
        <EmptyState
          icon="🏋️"
          title="Nog geen programma"
          description="Je coach wijst binnenkort een programma toe."
        />
      )}

      {/* Program grid */}
      {program && !selectedDay && (
        <ProgramGrid
          weeks={allWeeks}
          completedDayIds={completedDayIds}
          activeDayId={activeDayId}
          completedSets={completedSets}
          totalSets={totalSets}
          onSelectDay={selectDay}
          onResumeActive={() => {
            const allDays = allWeeks.flatMap(w => w.program_days ?? [])
            const day = allDays.find(d => d.id === activeDayId)
            if (day) selectDay(day)
          }}
        />
      )}

      {/* Day detail — preview or recap */}
      {program && selectedDay && !workoutStarted && (
        <div className="px-4 py-4 space-y-3">
          {completedDayIds.has(selectedDay.id) ? (
            <CompletedRecap
              recap={completedRecap}
              loading={loadingRecap}
              selectedDay={selectedDay}
              saving={saving}
              onStartWorkout={startWorkout}
            />
          ) : (
            <DayPreview
              day={selectedDay}
              previousLogs={previousLogs}
              personalRecords={personalRecords}
              saving={saving}
              onStartWorkout={startWorkout}
            />
          )}
        </div>
      )}

      {/* Active workout */}
      {program && selectedDay && workoutStarted && workoutLogId && (
        <ActiveWorkout
          day={selectedDay}
          setLogs={setLogs}
          previousLogs={previousLogs}
          personalRecords={personalRecords}
          suggestedWeights={suggestedWeights}
          completedSets={completedSets}
          totalSets={totalSets}
          feeling={feeling}
          saving={saving}
          onSetChange={handleSetChange}
          onToggleSet={toggleSet}
          onFeelingChange={setFeeling}
          onFinish={finishWorkout}
          readinessScore={readinessScore}
          adjustmentReasons={adjustmentReasons}
        />
      )}
    </div>
  )
}
