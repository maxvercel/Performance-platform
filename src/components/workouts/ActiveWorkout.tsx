'use client'

import { useState, useEffect, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import { nl } from 'date-fns/locale'
import { TempoDisplay } from './TempoDisplay'
import { ProgressBar } from './ProgressBar'
import { FeelingSelector } from './FeelingSelector'
import { RestTimerOverlay } from './RestTimerOverlay'
import { MUSCLE_GROUP_COLORS } from '@/utils/constants'

type SetLog = { weight: string; reps: string; done: boolean }

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
  onSetChange: (peId: string, setIndex: number, field: 'weight' | 'reps', value: string) => void
  onToggleSet: (peId: string, setIndex: number) => void
  onFeelingChange: (value: number) => void
  onFinish: () => void
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
}: ActiveWorkoutProps) {
  const [showWarmup, setShowWarmup] = useState<Record<string, boolean>>({})

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

  return (
    <div className="px-4 py-4 space-y-3">
      <ProgressBar completed={completedSets} total={totalSets} />

      {/* Rest Timer Overlay */}
      <RestTimerOverlay
        timeRemaining={restTimeRemaining}
        isActive={restIsActive}
        totalSeconds={restTotalSeconds}
        onSkip={skipTimer}
        onAddTime={addTime}
      />

      {day.program_exercises?.map((pe: any, idx: number) => {
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

        return (
          <div
            key={pe.id}
            className={`rounded-2xl border transition-all ${
              allDone ? 'bg-green-500/5 border-green-500/30' : 'bg-zinc-900 border-zinc-800'
            }`}
          >
            <div className="p-4">
              {/* Exercise header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-zinc-600 text-xs font-bold">{idx + 1}</span>
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

              {/* Rest time */}
              {pe.rest_seconds && (
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

              {/* Warm-up calculator */}
              {warmupSets.length > 0 && (
                <div className="mb-3">
                  <button
                    onClick={() => setShowWarmup(prev => ({ ...prev, [pe.id]: !prev[pe.id] }))}
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
                    <div
                      key={si}
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
                        className={`ml-auto w-8 h-8 rounded-xl flex items-center justify-center
                                    transition font-bold text-sm ${
                          set.done
                            ? 'bg-green-500 text-white'
                            : 'bg-zinc-700 text-zinc-500 hover:bg-orange-500 hover:text-white'
                        }`}
                      >
                        ✓
                      </button>
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
