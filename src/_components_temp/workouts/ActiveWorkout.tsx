'use client'

import { format, parseISO } from 'date-fns'
import { nl } from 'date-fns/locale'
import { TempoDisplay } from './TempoDisplay'
import { ProgressBar } from './ProgressBar'
import { FeelingSelector } from './FeelingSelector'
import { MUSCLE_GROUP_COLORS } from '@/utils/constants'

type SetLog = { weight: string; reps: string; done: boolean }

interface PreviousLog {
  weight_kg: number | null
  reps_completed: number | null
  workout_logs?: { logged_at: string }
}

interface ActiveWorkoutProps {
  day: any
  setLogs: Record<string, SetLog[]>
  previousLogs: Record<string, PreviousLog>
  personalRecords: Record<string, number>
  completedSets: number
  totalSets: number
  feeling: number
  saving: boolean
  onSetChange: (peId: string, setIndex: number, field: 'weight' | 'reps', value: string) => void
  onToggleSet: (peId: string, setIndex: number) => void
  onFeelingChange: (value: number) => void
  onFinish: () => void
}

export function ActiveWorkout({
  day,
  setLogs,
  previousLogs,
  personalRecords,
  completedSets,
  totalSets,
  feeling,
  saving,
  onSetChange,
  onToggleSet,
  onFeelingChange,
  onFinish,
}: ActiveWorkoutProps) {
  return (
    <div className="px-4 py-4 space-y-3">
      <ProgressBar completed={completedSets} total={totalSets} />

      {day.program_exercises?.map((pe: any, idx: number) => {
        const prev = previousLogs[pe.exercise_id]
        const sets = setLogs[pe.id] ?? []
        const allDone = sets.length > 0 && sets.every(s => s.done)
        const isPR =
          personalRecords[pe.exercise_id] &&
          sets.some(s => s.done && parseFloat(s.weight) >= personalRecords[pe.exercise_id])

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
                      🏆 PR!
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

              {/* Previous session */}
              {prev && (
                <div className="mb-3 bg-zinc-800/60 rounded-xl px-3 py-2">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-zinc-500 text-xs font-semibold">Vorige sessie</span>
                    {prev.workout_logs?.logged_at && (
                      <span className="text-zinc-600 text-xs">
                        {format(parseISO(prev.workout_logs.logged_at), 'EEEE d MMM', {
                          locale: nl,
                        })}
                      </span>
                    )}
                  </div>
                  <span className="text-zinc-300 text-xs font-bold">
                    {prev.weight_kg ? `${prev.weight_kg} kg` : '–'} ×{' '}
                    {prev.reps_completed ?? '–'} reps
                  </span>
                </div>
              )}

              {/* Set rows */}
              <div className="space-y-2">
                {sets.map((set, si) => (
                  <div
                    key={si}
                    className={`flex items-center gap-2 p-2 rounded-xl transition ${
                      set.done ? 'bg-green-500/10' : 'bg-zinc-800'
                    }`}
                  >
                    <span className="text-zinc-500 text-xs w-6 text-center font-bold">
                      {si + 1}
                    </span>
                    <input
                      type="number"
                      value={set.weight}
                      onChange={e => onSetChange(pe.id, si, 'weight', e.target.value)}
                      placeholder="kg"
                      aria-label={`Set ${si + 1} gewicht`}
                      className="w-16 bg-zinc-700 rounded-lg px-2 py-1.5 text-white text-xs text-center
                                 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
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
                ))}
              </div>

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
