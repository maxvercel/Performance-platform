'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRestTimer } from '@/hooks/useRestTimer'

type Set = {
  setNumber: number
  weight: string
  reps: string
  done: boolean
}

type Props = {
  programExercise: any
  workoutLogId: string
}

export default function ExerciseLogger({ programExercise, workoutLogId }: Props) {
  const supabase = createClient()
  const targetSets = programExercise.sets ?? 3

  const [sets, setSets] = useState<Set[]>(
    Array.from({ length: targetSets }, (_, i) => ({
      setNumber: i + 1,
      weight: programExercise.weight_kg?.toString() ?? '',
      reps: '',
      done: false
    }))
  )
  const [expanded, setExpanded] = useState(true)
  const restSeconds = programExercise.rest_seconds ?? 90
  const { timeRemaining, isActive: restActive, start: startRest, skip: skipRest } = useRestTimer()

  async function completeSet(index: number) {
    const s = sets[index]
    if (!s.reps) return

    const { error } = await supabase.from('exercise_logs').insert({
      workout_log_id: workoutLogId,
      program_exercise_id: programExercise.id,
      exercise_id: programExercise.exercise_id,
      set_number: s.setNumber,
      weight_kg: parseFloat(s.weight) || null,
      reps_completed: parseInt(s.reps),
    })

    if (error) {
      console.error('exercise_logs INSERT error:', error)
      return
    }

    setSets(prev => prev.map((set, i) =>
      i === index ? { ...set, done: true } : set
    ))

    startRest(restSeconds)
  }

  function addSet() {
    setSets(prev => [...prev, {
      setNumber: prev.length + 1,
      weight: sets[0]?.weight ?? '',
      reps: '',
      done: false
    }])
  }

  const completedSets = sets.filter(s => s.done).length
  const allDone = completedSets === sets.length
  const progressPct = (completedSets / sets.length) * 100

  return (
    <div className={`rounded-2xl overflow-hidden border transition-all duration-300 ${
      allDone
        ? 'border-green-500/40 bg-green-500/5'
        : expanded
        ? 'border-orange-500/30 bg-zinc-900'
        : 'border-zinc-800 bg-zinc-900'
    }`}>

      {/* Rusttimer */}
      {restActive && timeRemaining !== null && (
        <div className="bg-zinc-800 border-b border-orange-500/30 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-orange-500 flex items-center justify-center">
              <span className="text-orange-400 font-black text-sm">{timeRemaining}</span>
            </div>
            <div>
              <p className="text-white text-xs font-bold">Rust</p>
              <p className="text-zinc-500 text-xs">Volgende set over {timeRemaining}s</p>
            </div>
          </div>
          <button onClick={skipRest}
            className="bg-zinc-700 text-zinc-300 text-xs font-bold px-3 py-2 rounded-xl hover:bg-zinc-600 transition">
            Overslaan →
          </button>
        </div>
      )}

      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 ${
          allDone ? 'bg-green-500 text-white' : 'bg-zinc-800 text-zinc-300'
        }`}>
          {allDone ? '✓' : programExercise.order_index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-bold text-sm truncate ${allDone ? 'text-zinc-400 line-through' : 'text-white'}`}>
            {programExercise.exercises?.name}
          </p>
          <p className="text-zinc-500 text-xs mt-0.5">
            {programExercise.sets} sets · {programExercise.reps} reps
            {programExercise.rest_seconds ? ` · ${programExercise.rest_seconds}s rust` : ''}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-zinc-600 text-xs flex-shrink-0">{completedSets}/{sets.length}</span>
          </div>
        </div>
        <span className="text-zinc-600 text-xs">{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Uitklapbare inhoud */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-zinc-800 pt-3">

          {programExercise.notes && (
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl px-3 py-2">
              <p className="text-orange-300 text-xs">💬 {programExercise.notes}</p>
            </div>
          )}

          {programExercise.exercises?.description && (
            <div className="bg-zinc-800 rounded-xl px-3 py-2">
              <p className="text-zinc-400 text-xs leading-relaxed">
                📋 {programExercise.exercises.description}
              </p>
            </div>
          )}

          <div className="grid grid-cols-[32px_1fr_1fr_44px] gap-2 px-1">
            <span className="text-zinc-600 text-xs text-center">SET</span>
            <span className="text-zinc-600 text-xs text-center">KG</span>
            <span className="text-zinc-600 text-xs text-center">REPS</span>
            <span />
          </div>

          {sets.map((s, i) => (
            <div key={i} className={`grid grid-cols-[32px_1fr_1fr_44px] gap-2 items-center ${
              s.done ? 'opacity-40' : ''
            }`}>
              <span className="text-zinc-500 text-sm text-center font-mono font-bold">{s.setNumber}</span>
              <input
                type="number"
                step="0.5"
                value={s.weight}
                onChange={e => setSets(prev => prev.map((set, idx) =>
                  idx === i ? { ...set, weight: e.target.value } : set
                ))}
                disabled={s.done}
                placeholder="0"
                className="bg-zinc-800 border border-zinc-700 rounded-xl px-2 py-2.5
                           text-white text-sm text-center focus:outline-none
                           focus:border-orange-500 disabled:opacity-40 transition"
              />
              <input
                type="number"
                value={s.reps}
                onChange={e => setSets(prev => prev.map((set, idx) =>
                  idx === i ? { ...set, reps: e.target.value } : set
                ))}
                disabled={s.done}
                placeholder="0"
                className="bg-zinc-800 border border-zinc-700 rounded-xl px-2 py-2.5
                           text-white text-sm text-center focus:outline-none
                           focus:border-orange-500 disabled:opacity-40 transition"
              />
              <button
                onClick={() => completeSet(i)}
                disabled={s.done || !s.reps}
                className={`w-11 h-11 rounded-xl flex items-center justify-center transition text-lg ${
                  s.done
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-orange-500 hover:text-white disabled:opacity-30'
                }`}
              >
                {s.done ? '✓' : '→'}
              </button>
            </div>
          ))}

          <button onClick={addSet}
            className="w-full py-2 text-zinc-600 text-xs flex items-center justify-center gap-1 hover:text-zinc-400 transition">
            + Extra set toevoegen
          </button>
        </div>
      )}
    </div>
  )
}