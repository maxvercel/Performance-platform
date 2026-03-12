'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { nl } from 'date-fns/locale'
import { calc1RM, formatVolume } from '@/utils/calculations'
import { FEELING_EMOJIS } from '@/utils/constants'
import { usePagination } from '@/hooks/usePagination'
import { Pagination } from '@/components/ui'

interface WorkoutHistoryProps {
  workoutHistory: any[]
}

export function WorkoutHistory({ workoutHistory }: WorkoutHistoryProps) {
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)
  const { page, currentPage, totalPages, hasNext, hasPrev, next, prev } = usePagination(workoutHistory, 10)

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800">
        <p className="text-white font-bold text-sm">Workout geschiedenis</p>
        <p className="text-zinc-500 text-xs">
          {workoutHistory.length} workouts · tik voor detail
        </p>
      </div>

      {workoutHistory.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-4xl mb-2">🏋️</p>
          <p className="text-zinc-500 text-sm">Nog geen workouts afgerond</p>
          <p className="text-zinc-600 text-xs mt-1">Rond een workout af om hier data te zien</p>
        </div>
      ) : (
        <>
        <div className="divide-y divide-zinc-800">
          {page.map(log => {
            const isExpanded = expandedLogId === log.id
            const setsCount = log.exercise_logs?.length ?? 0
            const volume =
              log.exercise_logs?.reduce(
                (a: number, el: any) => a + (el.weight_kg ?? 0) * (el.reps_completed ?? 0),
                0
              ) ?? 0
            const muscleGroups = [
              ...new Set(
                log.exercise_logs
                  ?.map((el: any) => el.exercises?.muscle_group)
                  .filter(Boolean) as string[]
              ),
            ]
            const feelingEmoji = FEELING_EMOJIS[log.feeling ?? 3] ?? ''

            // Group exercise logs by exercise
            const exerciseGroups: Record<string, any> = {}
            log.exercise_logs?.forEach((el: any) => {
              const exId = el.exercise_id
              if (!exerciseGroups[exId]) {
                exerciseGroups[exId] = {
                  name: el.exercises?.name ?? 'Onbekend',
                  muscleGroup: el.exercises?.muscle_group,
                  sets: [],
                  maxWeight: 0,
                  totalVolume: 0,
                }
              }
              exerciseGroups[exId].sets.push(el)
              if (el.weight_kg && el.weight_kg > exerciseGroups[exId].maxWeight) {
                exerciseGroups[exId].maxWeight = el.weight_kg
              }
              exerciseGroups[exId].totalVolume += (el.weight_kg ?? 0) * (el.reps_completed ?? 0)
            })
            const groupList = Object.values(exerciseGroups)

            return (
              <div key={log.id}>
                <button
                  className="w-full px-4 py-3 text-left hover:bg-zinc-800/40 transition"
                  onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                  aria-expanded={isExpanded}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-white font-bold text-sm">
                          {log.program_days?.label ?? 'Workout'}
                        </p>
                        {log.feeling && <span className="text-base">{feelingEmoji}</span>}
                      </div>
                      <p className="text-zinc-500 text-xs mt-0.5">
                        {format(parseISO(log.logged_at), 'EEEE d MMMM', { locale: nl })}
                      </p>
                      <div className="flex gap-3 mt-1.5 flex-wrap">
                        <span className={`text-xs ${setsCount > 0 ? 'text-zinc-400' : 'text-zinc-600'}`}>
                          {setsCount} sets
                        </span>
                        {volume > 0 && (
                          <span className="text-zinc-400 text-xs">
                            {formatVolume(volume)} kg vol.
                          </span>
                        )}
                        {groupList.length > 0 && (
                          <span className="text-zinc-500 text-xs">{groupList.length} oef.</span>
                        )}
                      </div>
                      {muscleGroups.length > 0 && (
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {muscleGroups.slice(0, 4).map(mg => (
                            <span
                              key={mg}
                              className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full"
                            >
                              {mg}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      <p className="text-zinc-600 text-xs">{log.programs?.name}</p>
                      <span className="text-zinc-600 text-xs">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 bg-zinc-800/30 border-t border-zinc-800">
                    {groupList.length === 0 ? (
                      <p className="text-zinc-600 text-xs py-3 text-center">
                        Geen sets gelogd voor deze workout
                      </p>
                    ) : (
                      <div className="space-y-3 pt-3">
                        {groupList.map((group: any, gi: number) => (
                          <div key={gi} className="bg-zinc-900 rounded-xl p-3">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-white font-bold text-sm">{group.name}</p>
                              <div className="flex items-center gap-2">
                                {group.muscleGroup && (
                                  <span className="text-zinc-500 text-xs">{group.muscleGroup}</span>
                                )}
                                {group.maxWeight > 0 && (
                                  <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-bold">
                                    {group.maxWeight}kg max
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="space-y-1">
                              {group.sets.map((set: any, si: number) => (
                                <div
                                  key={si}
                                  className="flex items-center gap-2 bg-zinc-800/60 rounded-lg px-3 py-1.5"
                                >
                                  <span className="text-zinc-600 text-xs w-4 font-bold">
                                    {set.set_number}
                                  </span>
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
                            {group.totalVolume > 0 && (
                              <p className="text-zinc-600 text-xs mt-2">
                                Volume: {Math.round(group.totalVolume)} kg
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          hasNext={hasNext}
          hasPrev={hasPrev}
          onNext={next}
          onPrev={prev}
        />
        </>
      )}
    </div>
  )
}
