'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { nl } from 'date-fns/locale'
import { TempoDisplay } from './TempoDisplay'
import { ProgressBar } from './ProgressBar'
import { FeelingSelector } from './FeelingSelector'
import { RestTimerOverlay } from './RestTimerOverlay'
import { ExerciseIllustration } from './ExerciseIllustration'
import { MUSCLE_GROUP_COLORS } from '@/utils/constants'
import { getTrainingRecommendation } from '@/utils/autoAdjust'

type SetLog = { weight: string; reps: string; rpe: string; done: boolean }

interface PreviousLog {
  weight_kg: number | null
  reps_completed: number | null
  workout_logs?: { logged_at: string }
}

interface WarmupSet {
  weight: number
  reps: number
}

interface ActiveWorkoutProps {
  day: any
  setLogs: Record<string, SetLog[]>
  previousLogs: Record<string, PreviousLog>
  personalRecords: Record<string, number>
  suggestedWeights: Record<string, number>
  completedSets: number
  totalSets: number
  feeling: number
  saving: boolean
  onSetChange: (peId: string, setIndex: number, field: 'weight' | 'reps' | 'rpe', value: string) => void
  onToggleSet: (peId: string, setIndex: number) => void
  onFeelingChange: (value: number) => void
  onFinish: () => void
  readinessScore?: number | null
  adjustmentReasons?: Record<string, string>
}

// Map superset group letters to border colors
const SUPERSET_COLORS: Record<string, string> = {
  'A': 'border-l-orange-500',
  'B': 'border-l-blue-500',
  'C': 'border-l-green-500',
  'D': 'border-l-purple-500',
}

/** Generate warm-up sets based on working weight */
function generateWarmupSets(workingWeight: number): WarmupSet[] {
  if (!workingWeight || workingWeight <= 20) return []

  const roundTo = (n: number, step: number) => Math.round(n / step) * step
  const bar = 20
  const sets: WarmupSet[] = []

  if (workingWeight <= 40) {
    sets.push({ weight: bar, reps: 10 })
  } else if (workingWeight <= 60) {
    sets.push({ weight: bar, reps: 10 })
    sets.push({ weight: roundTo(workingWeight * 0.6, 2.5), reps: 5 })
  } else {
    // 3-4 warmup sets for heavier weights
    sets.push({ weight: bar, reps: 10 })
    sets.push({ weight: roundTo(workingWeight * 0.4, 2.5), reps: 8 })
    sets.push({ weight: roundTo(workingWeight * 0.6, 2.5), reps: 5 })
    if (workingWeight >= 80) {
      sets.push({ weight: roundTo(workingWeight * 0.8, 2.5), reps: 3 })
    }
  }

  return sets
}

export function ActiveWorkout({
  day,
  setLogs,
  previousLogs,
  personalRecords,
  suggestedWeights,
  completedSets,
  totalSets,
  feeling,
  saving,
  onSetChange,
  onToggleSet,
  onFeelingChange,
  onFinish,
  readinessScore,
  adjustmentReasons = {},
}: ActiveWorkoutProps) {
  const [showWarmup, setShowWarmup] = useState<Record<string, boolean>>({})

  // Group exercises by superset
  const groupedExercises = useMemo(() => {
    const exercises = day.program_exercises ?? []
    const groups: Array<{ superset_group: string | null; exercises: any[] }> = []
    let currentGroup: { superset_group: string | null; exercises: any[] } | null = null

    exercises.forEach((pe: any) => {
      const supersetGroup = pe.superset_group || null

      // Start new group if superset changes
      if (!currentGroup || currentGroup.superset_group !== supersetGroup) {
        if (currentGroup) groups.push(currentGroup)
        currentGroup = { superset_group: supersetGroup, exercises: [] }
      }
      currentGroup.exercises.push(pe)
    })

    if (currentGroup) groups.push(currentGroup)
    return groups
  }, [day.program_exercises])

  // Rest timer state
  const [restTimeRemaining, setRestTimeRemaining] = useState<number | null>(null)
  const [restIsActive, setRestIsActive] = useState(false)
  const [restTotalSeconds, setRestTotalSeconds] = useState(90)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevCompletedRef = useRef(completedSets)

  // Auto-start rest timer when a set is completed
  useEffect(() => {
    if (completedSets > prevCompletedRef.current && completedSets < totalSets) {
      // Find the rest seconds for the current exercise
      const allPes = day.program_exercises ?? []
      let restSec = 90
      for (const pe of allPes) {
        const sets = setLogs[pe.id] ?? []
        if (sets.some(s => s.done) && !sets.every(s => s.done)) {
          restSec = pe.rest_seconds ?? 90
          break
        }
      }
      setRestTotalSeconds(restSec)
      setRestTimeRemaining(restSec)
      setRestIsActive(true)
    }
    prevCompletedRef.current = completedSets
  }, [completedSets, totalSets, day.program_exercises, setLogs])

  // Timer countdown
  useEffect(() => {
    if (restIsActive && restTimeRemaining !== null) {
      if (restTimeRemaining <= 0) {
        setRestIsActive(false)
        setRestTimeRemaining(null)
        return
      }
      timerRef.current = setTimeout(() => setRestTimeRemaining(prev => (prev ?? 1) - 1), 1000)
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [restIsActive, restTimeRemaining])

  const skipTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setRestIsActive(false)
    setRestTimeRemaining(null)
  }

  const addTime = (seconds: number) => {
    setRestTimeRemaining(prev => (prev ?? 0) + seconds)
    setRestTotalSeconds(prev => prev + seconds)
  }

  const recommendation = readinessScore ? getTrainingRecommendation(readinessScore) : null

  return (
    <div className="px-4 py-4 space-y-3">
      <ProgressBar completed={completedSets} total={totalSets} />

      {/* Readiness-based training recommendation */}
      {recommendation && readinessScore && (
        <div className={`rounded-xl px-3 py-2.5 flex items-center gap-2.5 border ${
          recommendation.type === 'full' ? 'bg-green-500/10 border-green-500/30' :
          recommendation.type === 'moderate' ? 'bg-yellow-500/10 border-yellow-500/30' :
          recommendation.type === 'light' ? 'bg-orange-500/10 border-orange-500/30' :
          'bg-red-500/10 border-red-500/30'
        }`}>
          <span className="text-lg flex-shrink-0">
            {recommendation.type === 'full' ? '🟢' :
             recommendation.type === 'moderate' ? '🟡' :
             recommendation.type === 'light' ? '🟠' : '🔴'}
          </span>
          <div>
            <p className={`text-xs font-bold ${
              recommendation.type === 'full' ? 'text-green-400' :
              recommendation.type === 'moderate' ? 'text-yellow-400' :
              recommendation.type === 'light' ? 'text-orange-400' :
              'text-red-400'
            }`}>
              Readiness {readinessScore.toFixed(1)}/5 — {recommendation.label}
            </p>
            <p className="text-zinc-500 text-[10px] mt-0.5">{recommendation.description}</p>
          </div>
        </div>
      )}

      {/* Rest Timer Overlay */}
      <RestTimerOverlay
        timeRemaining={restTimeRemaining}
        isActive={restIsActive}
        totalSeconds={restTotalSeconds}
        onSkip={skipTimer}
        onAddTime={addTime}
      />

      {groupedExercises.map((group, groupIdx) => {
        const isSupersetGroup = group.superset_group !== null
        const borderColorClass = isSupersetGroup && group.superset_group ? (SUPERSET_COLORS[group.superset_group] ?? '') : ''

        return (
          <div
            key={`group-${groupIdx}`}
            className={isSupersetGroup ? `border-l-4 ${borderColorClass} pl-4` : ''}
          >
            {isSupersetGroup && (
              <div className="mb-2 ml-0">
                <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                  group.superset_group === 'A' ? 'bg-orange-500/20 text-orange-400' :
                  group.superset_group === 'B' ? 'bg-blue-500/20 text-blue-400' :
                  group.superset_group === 'C' ? 'bg-green-500/20 text-green-400' :
                  'bg-purple-500/20 text-purple-400'
                }`}>
                  Superset {group.superset_group}
                </span>
              </div>
            )}

            {group.exercises.map((pe: any, exIdx: number) => {
              const prev = previousLogs[pe.exercise_id]
              const sets = setLogs[pe.id] ?? []
              const allDone = sets.length > 0 && sets.every(s => s.done)
              const isPR =
                personalRecords[pe.exercise_id] &&
                sets.some(s => s.done && parseFloat(s.weight) >= personalRecords[pe.exercise_id])

              const suggestion = suggestedWeights[pe.exercise_id]
              const prevWeight = prev?.weight_kg ? parseFloat(String(prev.weight_kg)) : null
              const hasSuggestion = suggestion && prevWeight && suggestion !== prevWeight

              // Determine working weight for warmup calculation
              const workingWeight = parseFloat(sets[0]?.weight) || suggestion || prevWeight || 0
              const warmupSets = generateWarmupSets(workingWeight)
              const isWarmupOpen = showWarmup[pe.id] ?? false
              const globalIdx = (day.program_exercises ?? []).indexOf(pe) + 1
              const isNextInSuperset = exIdx < group.exercises.length - 1

              return (
                <div
                  key={pe.id}
                  className={`rounded-2xl border transition-all ${
                    allDone ? 'bg-green-500/5 border-green-500/30' : 'bg-zinc-900 border-zinc-800'
                  } ${exIdx > 0 ? 'mt-2' : ''}`}
                >
                  <div className="p-4">
              {/* Exercise header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-zinc-600 text-xs font-bold">{globalIdx}</span>
                  <p className="text-white font-bold text-sm">{pe.exercises?.name}</p>
                  {pe.exercises?.muscle_group && (
                    <span
                      className={`text-xs ${
                        MUSCLE_GROUP_COLORS[pe.exercises.muscle_group] ?? 'text-zinc-500'
                      }`}
                    >
                      {pe.exercises.muscle_group}
                    </span>
                  )}
                  {isPR && (
                    <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full font-bold animate-pulse">
                      PR!
                    </span>
                  )}
                </div>
                {allDone && (
                  <span className="text-green-400 text-sm font-bold flex-shrink-0">✓ Klaar</span>
                )}
              </div>

              {/* Tempo */}
              <div className="mb-3">
                <TempoDisplay tempo={pe.tempo} />
              </div>

              {/* Exercise illustration & form cues */}
              <ExerciseIllustration
                exerciseName={pe.exercises?.name ?? ''}
                muscleGroup={pe.exercises?.muscle_group ?? ''}
              />

              {/* Rest time or direct door label */}
              {isNextInSuperset ? (
                <div className="mb-3 flex items-center gap-1.5">
                  <span className="text-zinc-600 text-xs">↔</span>
                  <span className="text-zinc-400 text-xs font-bold">Direct door</span>
                </div>
              ) : pe.rest_seconds && (
                <div className="mb-3 flex items-center gap-1.5">
                  <span className="text-zinc-600 text-xs">Rust:</span>
                  <span className="text-zinc-400 text-xs font-bold">{pe.rest_seconds}s</span>
                </div>
              )}

              {/* Previous session + Smart suggestion */}
              {prev && (
                <div className="mb-3 bg-zinc-800/60 rounded-xl px-3 py-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-zinc-500 text-xs font-semibold">Vorige sessie</span>
                    {prev.workout_logs?.logged_at && (
                      <span className="text-zinc-600 text-xs">
                        {format(parseISO(prev.workout_logs.logged_at), 'EEEE d MMM', {
                          locale: nl,
                        })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-300 text-sm font-bold">
                      {prev.weight_kg ? `${prev.weight_kg} kg` : '–'} ×{' '}
                      {prev.reps_completed ?? '–'} reps
                    </span>
                    {hasSuggestion && (
                      <span className="text-orange-400 text-xs font-bold bg-orange-500/15 px-2 py-0.5 rounded-full border border-orange-500/30">
                        → {suggestion} kg (+2.5)
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Auto-adjustment reason */}
              {adjustmentReasons[pe.exercise_id] && (
                <div className="mb-3 flex items-center gap-1.5 bg-blue-500/5 border border-blue-500/10 rounded-lg px-3 py-1.5">
                  <span className="text-blue-400 text-xs">🤖</span>
                  <span className="text-blue-300 text-xs">{adjustmentReasons[pe.exercise_id]}</span>
                </div>
              )}

              {/* Warm-up calculator */}
              {warmupSets.length > 0 && (
                <div className="mb-3">
                  <button
                    onClick={() => setShowWarmup(prev => ({ ...prev, [pe.id]: !prev[pe.id] }))}
                    aria-expanded={isWarmupOpen}
                    aria-label={`Warm-up schema ${isWarmupOpen ? 'verbergen' : 'tonen'}`}
                    className="flex items-center gap-1.5 text-xs text-blue-400 font-bold mb-1.5 hover:text-blue-300 transition"
                  >
                    <span>{isWarmupOpen ? '▼' : '▶'}</span>
                    <span>Warm-up schema</span>
                    <span className="text-blue-500/60 font-normal">({warmupSets.length} sets)</span>
                  </button>

                  {isWarmupOpen && (
                    <div className="space-y-1 mb-2">
                      {warmupSets.map((ws, wi) => (
                        <div
                          key={wi}
                          className="flex items-center gap-2 bg-blue-500/5 border border-blue-500/10 rounded-lg px-3 py-1.5"
                        >
                          <span className="text-blue-400/50 text-xs w-4 font-bold">W{wi + 1}</span>
                          <span className="text-blue-300 text-xs font-bold">{ws.weight} kg</span>
                          <span className="text-blue-500/40 text-xs">×</span>
                          <span className="text-blue-300 text-xs font-bold">{ws.reps} reps</span>
                          <span className="text-blue-500/40 text-xs ml-auto">
                            {Math.round((ws.weight / workingWeight) * 100)}%
                          </span>
                        </div>
                      ))}
                      <p className="text-blue-500/40 text-[10px] mt-1 pl-1">
                        Warm-up sets worden niet gelogd
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Working sets header */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                  Werksets
                </span>
                <div className="flex-1 border-t border-zinc-800" />
                <span className="text-zinc-600 text-[10px]">
                  {sets.filter(s => s.done).length}/{sets.length}
                </span>
              </div>

              {/* Set rows */}
              <div className="space-y-2">
                {sets.map((set, si) => {
                  const currentWeight = parseFloat(set.weight)
                  const isSuggested = hasSuggestion && currentWeight === suggestion

                  return (
                    <div key={si} className="space-y-1">
                      <div
                        className={`flex items-center gap-2 p-2 rounded-xl transition ${
                          set.done ? 'bg-green-500/10' : 'bg-zinc-800'
                        }`}
                      >
                        <span className="text-zinc-500 text-xs w-6 text-center font-bold">
                          {si + 1}
                        </span>
                        <div className="relative">
                          <input
                            type="number"
                            inputMode="decimal"
                            value={set.weight}
                            onChange={e => onSetChange(pe.id, si, 'weight', e.target.value)}
                            placeholder="kg"
                            aria-label={`Set ${si + 1} gewicht`}
                            className={`w-16 rounded-lg px-2 py-1.5 text-white text-xs text-center
                                       focus:outline-none focus:ring-1 focus:ring-orange-500 ${
                                         isSuggested
                                           ? 'bg-orange-500/10 ring-1 ring-orange-500/30'
                                           : 'bg-zinc-700'
                                       }`}
                          />
                          {isSuggested && !set.done && (
                            <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-orange-500 rounded-full border border-zinc-900" />
                          )}
                        </div>
                        <span className="text-zinc-600 text-xs">kg</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={set.reps}
                          onChange={e => onSetChange(pe.id, si, 'reps', e.target.value)}
                          placeholder="reps"
                          aria-label={`Set ${si + 1} herhalingen`}
                          className="w-16 bg-zinc-700 rounded-lg px-2 py-1.5 text-white text-xs text-center
                                     focus:outline-none focus:ring-1 focus:ring-orange-500"
                        />
                        <span className="text-zinc-600 text-xs">reps</span>
                        <button
                          onClick={() => onToggleSet(pe.id, si)}
                          aria-label={set.done ? `Set ${si + 1} ongedaan maken` : `Set ${si + 1} voltooien`}
                          className={`ml-auto w-11 h-11 rounded-xl flex items-center justify-center
                                      transition font-bold text-sm ${
                            set.done
                              ? 'bg-green-500 text-white'
                              : 'bg-zinc-700 text-zinc-500 hover:bg-orange-500 hover:text-white'
                          }`}
                        >
                          ✓
                        </button>
                      </div>
                      {/* RPE selector — shown after set is completed */}
                      {set.done && (
                        <div className="flex items-center gap-1.5 ml-8">
                          <span className="text-zinc-600 text-[10px] font-bold w-8">RPE</span>
                          <div className="flex gap-0.5">
                            {[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map(rpeVal => {
                              const selected = parseFloat(set.rpe) === rpeVal
                              return (
                                <button
                                  key={rpeVal}
                                  onClick={() => onSetChange(pe.id, si, 'rpe', rpeVal.toString())}
                                  aria-label={`RPE ${rpeVal}`}
                                  className={`h-6 rounded text-[10px] font-bold transition px-1.5 ${
                                    selected
                                      ? rpeVal >= 9.5 ? 'bg-red-500/30 text-red-300 border border-red-500/50'
                                      : rpeVal >= 8 ? 'bg-orange-500/30 text-orange-300 border border-orange-500/50'
                                      : 'bg-green-500/30 text-green-300 border border-green-500/50'
                                      : 'bg-zinc-800 text-zinc-600 hover:bg-zinc-700'
                                  }`}
                                >
                                  {rpeVal % 1 === 0 ? rpeVal : rpeVal.toFixed(1)}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Quick-fill suggestion button */}
              {hasSuggestion && sets.some(s => parseFloat(s.weight) !== suggestion) && !allDone && (
                <button
                  onClick={() => {
                    sets.forEach((_, si) => {
                      if (!sets[si].done) {
                        onSetChange(pe.id, si, 'weight', suggestion.toString())
                      }
                    })
                  }}
                  className="mt-2 w-full text-center text-xs text-orange-400 font-bold
                             bg-orange-500/10 border border-orange-500/20 rounded-xl py-2
                             hover:bg-orange-500/20 transition"
                >
                  Vul alle sets met {suggestion} kg (+2.5)
                </button>
              )}

              {pe.notes && (
                <p className="text-orange-400/70 text-xs mt-3 italic">💬 {pe.notes}</p>
              )}
            </div>
          </div>
              )
            })}
          </div>
        )
      })}

      {/* Feeling + finish */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <h2 className="text-white font-bold mb-3">Hoe voelde de workout?</h2>
        <div className="mb-4">
          <FeelingSelector value={feeling} onChange={onFeelingChange} />
        </div>
        <button
          onClick={onFinish}
          disabled={saving}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-black
                     py-4 rounded-2xl text-lg transition disabled:opacity-50"
        >
          {saving ? 'Opslaan...' : '✓ Workout afronden'}
        </button>
      </div>
    </div>
  )
}
