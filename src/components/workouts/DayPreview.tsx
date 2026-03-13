'use client'

import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { nl } from 'date-fns/locale'
import { TempoDisplay } from './TempoDisplay'
import { Button } from '@/components/ui/Button'
import { BodyMap } from '@/components/ui/BodyMap'
import { MUSCLE_GROUP_COLORS } from '@/utils/constants'

interface PreviousLog {
  weight_kg: number | null
  reps_completed: number | null
  workout_logs?: { logged_at: string }
}

interface DayPreviewProps {
  day: any
  previousLogs: Record<string, PreviousLog>
  personalRecords: Record<string, number>
  saving: boolean
  onStartWorkout: () => void
}

// Map superset group letters to border colors
const SUPERSET_COLORS: Record<string, string> = {
  'A': 'border-l-orange-500',
  'B': 'border-l-blue-500',
  'C': 'border-l-green-500',
  'D': 'border-l-purple-500',
}

export function DayPreview({
  day,
  previousLogs,
  personalRecords,
  saving,
  onStartWorkout,
}: DayPreviewProps) {
  // Collect muscle groups for body map (excluding 'general')
  const muscleGroups = useMemo(() => {
    const groups = new Set<string>()
    day.program_exercises?.forEach((pe: any) => {
      const mg = pe.exercises?.muscle_group
      if (mg && mg !== 'general') groups.add(mg)
    })
    return Array.from(groups)
  }, [day.program_exercises])

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

  return (
    <>
      {/* Body Map - shows which muscles this workout targets */}
      {muscleGroups.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <p className="text-white font-bold text-sm mb-1">Spiergroepen vandaag</p>
          <p className="text-zinc-500 text-xs mb-3">
            {muscleGroups.join(' • ')}
          </p>
          <div className="flex items-center gap-4">
            <BodyMap highlightedMuscles={muscleGroups} size="sm" />
            <div className="flex-1 space-y-1.5">
              {muscleGroups.map(mg => (
                <div key={mg} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    mg === 'Borst' ? 'bg-blue-500' :
                    mg === 'Rug' ? 'bg-purple-500' :
                    mg === 'Benen' ? 'bg-red-500' :
                    mg === 'Schouders' ? 'bg-yellow-500' :
                    mg === 'Armen' ? 'bg-orange-500' :
                    mg === 'Core' ? 'bg-green-500' :
                    mg === 'Billen' ? 'bg-pink-500' : 'bg-zinc-500'
                  }`} />
                  <span className="text-zinc-300 text-xs font-medium">{mg}</span>
                  <span className="text-zinc-600 text-xs ml-auto">
                    {day.program_exercises?.filter((pe: any) => pe.exercises?.muscle_group === mg).length} oef.
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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

            {group.exercises.map((pe: any, idx: number) => {
              const prev = previousLogs[pe.exercise_id]
              const isPR = prev && personalRecords[pe.exercise_id] === prev.weight_kg
              const globalIdx = (day.program_exercises ?? []).indexOf(pe) + 1

              return (
                <div key={pe.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-2">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-zinc-600 text-xs font-bold">{globalIdx}</span>
                    <p className="text-white font-bold text-sm">{pe.exercises?.name}</p>
                    {pe.exercises?.muscle_group && pe.exercises.muscle_group !== 'general' && (
                      <span
                        className={`text-xs font-medium ${
                          MUSCLE_GROUP_COLORS[pe.exercises.muscle_group] ?? 'text-zinc-500'
                        }`}
                      >
                        {pe.exercises.muscle_group}
                      </span>
                    )}
                    {isPR && (
                      <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full font-bold ml-auto">
                        PR
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2 flex-wrap mb-3">
                    <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-1 rounded-lg font-bold">
                      {pe.sets} sets
                    </span>
                    <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-1 rounded-lg">
                      {pe.reps} reps
                    </span>
                    {pe.weight_kg && (
                      <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-1 rounded-lg">
                        {pe.weight_kg} kg
                      </span>
                    )}
                    {!isSupersetGroup && pe.rest_seconds && (
                      <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded-lg">
                        ⏱ {pe.rest_seconds}s rust
                      </span>
                    )}
                  </div>

                  <TempoDisplay tempo={pe.tempo} />

                  {prev && (
                    <div className="mt-3 bg-zinc-800/60 rounded-xl px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500 text-xs font-semibold">Vorige sessie</span>
                        {prev.workout_logs?.logged_at && (
                          <span className="text-zinc-600 text-xs">
                            {format(parseISO(prev.workout_logs.logged_at), 'd MMM', { locale: nl })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-zinc-300 text-xs font-semibold">
                          {prev.weight_kg ? `${prev.weight_kg} kg` : '–'} × {prev.reps_completed ?? '–'} reps
                        </span>
                        {prev.weight_kg && (
                          <span className="text-orange-400 text-xs font-bold bg-orange-500/15 px-1.5 py-0.5 rounded-full">
                            → {Math.round((parseFloat(String(prev.weight_kg)) + 2.5) * 2) / 2} kg
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {pe.notes && (
                    <p className="text-orange-400/70 text-xs mt-2 italic">💬 {pe.notes}</p>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}

      <Button onClick={onStartWorkout} loading={saving} fullWidth size="lg">
        💪 Start workout
      </Button>
    </>
  )
}
