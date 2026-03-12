'use client'

import { format, parseISO } from 'date-fns'
import { nl } from 'date-fns/locale'
import { TempoDisplay } from './TempoDisplay'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { FEELING_EMOJIS } from '@/utils/constants'
import { calc1RM, formatVolume } from '@/utils/calculations'

interface ExerciseGroup {
  exercise: { id: string; name: string; muscle_group?: string }
  sets: Array<{
    set_number: number
    weight_kg: number | null
    reps_completed: number | null
  }>
  maxWeight: number
}

interface RecapData {
  log: {
    feeling?: number
    logged_at: string
  }
  exerciseGroups: ExerciseGroup[]
  totalVolume: number
  totalSets: number
}

interface CompletedRecapProps {
  recap: RecapData | null
  loading: boolean
  selectedDay: any
  saving: boolean
  onStartWorkout: () => void
}

export function CompletedRecap({
  recap,
  loading,
  selectedDay,
  saving,
  onStartWorkout,
}: CompletedRecapProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="sm" />
      </div>
    )
  }

  if (!recap) return null

  return (
    <>
      {/* Recap header */}
      <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-green-400 text-sm font-black">✓ Gedaan</span>
              {recap.log.feeling && (
                <span className="text-lg">{FEELING_EMOJIS[recap.log.feeling] ?? ''}</span>
              )}
            </div>
            <p className="text-zinc-500 text-xs mt-0.5">
              {format(parseISO(recap.log.logged_at), 'EEEE d MMMM yyyy', { locale: nl })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-white font-black text-lg">{recap.totalSets}</p>
            <p className="text-zinc-600 text-xs">sets</p>
          </div>
        </div>

        {recap.totalVolume > 0 && (
          <div className="mt-2 pt-2 border-t border-green-500/20 flex gap-4">
            <div>
              <p className="text-zinc-500 text-xs">Totaal volume</p>
              <p className="text-white font-bold text-sm">{formatVolume(recap.totalVolume)} kg</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs">Oefeningen</p>
              <p className="text-white font-bold text-sm">{recap.exerciseGroups.length}</p>
            </div>
          </div>
        )}
      </div>

      {/* Exercise breakdown */}
      {recap.exerciseGroups.map((group, idx) => (
        <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-white font-bold text-sm">{group.exercise?.name}</p>
            {group.maxWeight > 0 && (
              <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-bold">
                Max: {group.maxWeight}kg
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            {group.sets.map((set, si) => (
              <div key={si} className="flex items-center gap-2 bg-zinc-800/60 rounded-xl px-3 py-2">
                <span className="text-zinc-500 text-xs w-5 text-center font-bold">{set.set_number}</span>
                <span className="text-green-400 text-xs">✓</span>
                <span className="text-white text-sm font-bold">
                  {set.weight_kg ? `${set.weight_kg}kg` : '–'}
                </span>
                <span className="text-zinc-500 text-xs">×</span>
                <span className="text-white text-sm font-bold">
                  {set.reps_completed ? `${set.reps_completed} reps` : '–'}
                </span>
                {set.weight_kg && set.reps_completed && set.reps_completed > 1 && (
                  <span className="text-zinc-600 text-xs ml-auto">
                    ~{calc1RM(set.weight_kg, set.reps_completed)}kg 1RM
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Tempo from program */}
          {(() => {
            const pe = selectedDay?.program_exercises?.find(
              (e: any) => e.exercise_id === group.exercise?.id
            )
            return pe?.tempo ? (
              <div className="mt-2">
                <TempoDisplay tempo={pe.tempo} />
              </div>
            ) : null
          })()}
        </div>
      ))}

      {/* Redo button */}
      <div className="pt-2 pb-1">
        <p className="text-zinc-600 text-xs text-center mb-3">Wil je deze workout opnieuw doen?</p>
        <Button onClick={onStartWorkout} loading={saving} fullWidth size="lg">
          🔄 Opnieuw trainen
        </Button>
      </div>
    </>
  )
}
