'use client'

import { MUSCLE_GROUP_COLORS } from '@/utils/constants'

interface ProgramWeek {
  id: string
  week_number: number
  program_days: ProgramDay[]
}

interface ProgramDay {
  id: string
  label: string
  rest_day?: boolean
  program_exercises?: Array<{
    id: string
    exercise_id: string
    exercises?: { muscle_group?: string }
  }>
}

interface ProgramGridProps {
  weeks: ProgramWeek[]
  completedDayIds: Set<string>
  activeDayId: string | null
  completedSets: number
  totalSets: number
  onSelectDay: (day: ProgramDay) => void
  onResumeActive: () => void
}

export function ProgramGrid({
  weeks,
  completedDayIds,
  activeDayId,
  completedSets,
  totalSets,
  onSelectDay,
  onResumeActive,
}: ProgramGridProps) {
  const totalDays = weeks.reduce(
    (acc, w) => acc + (w.program_days?.filter(d => !d.rest_day).length ?? 0),
    0
  )
  const doneDays = completedDayIds.size
  const pct = totalDays > 0 ? Math.round((doneDays / totalDays) * 100) : 0

  return (
    <div className="px-4 py-4 space-y-5">
      {/* Active workout banner */}
      {activeDayId && (
        <button
          onClick={onResumeActive}
          className="w-full bg-orange-500/10 border border-orange-500/40 rounded-2xl p-4
                     flex items-center gap-3 text-left"
        >
          <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse flex-shrink-0" />
          <div className="flex-1">
            <p className="text-orange-400 font-bold text-sm">Workout bezig</p>
            <p className="text-zinc-500 text-xs">
              {completedSets}/{totalSets} sets — tik om verder te gaan
            </p>
          </div>
          <span className="text-orange-400 font-bold">→</span>
        </button>
      )}

      {/* Program progress */}
      {weeks.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-zinc-400 text-xs font-bold">Programma voortgang</p>
            <p className="text-white font-black text-sm">{pct}%</p>
          </div>
          <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 rounded-full transition-all duration-700"
              style={{ width: `${pct}%` }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <p className="text-zinc-600 text-xs mt-2">
            {doneDays} van {totalDays} trainingsdagen gedaan
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs" aria-label="Legenda">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 bg-green-500 rounded-full" />
          <span className="text-zinc-500">Gedaan</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 bg-orange-500 rounded-full" />
          <span className="text-zinc-500">Bezig</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 bg-zinc-700 rounded-full" />
          <span className="text-zinc-500">Gepland</span>
        </div>
      </div>

      {/* Week grids */}
      {weeks.map(week => {
        const days = week.program_days ?? []
        const cols = Math.min(days.length, 4)

        return (
          <div key={week.id}>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-2">
              Week {week.week_number}
            </p>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
              {days.map(day => (
                <DayTile
                  key={day.id}
                  day={day}
                  isCompleted={completedDayIds.has(day.id)}
                  isActive={day.id === activeDayId}
                  onClick={() => onSelectDay(day)}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ─── Individual day tile ─── */
function DayTile({
  day,
  isCompleted,
  isActive,
  onClick,
}: {
  day: ProgramDay
  isCompleted: boolean
  isActive: boolean
  onClick: () => void
}) {
  const muscleGroups = [
    ...new Set(
      day.program_exercises
        ?.map(pe => pe.exercises?.muscle_group)
        .filter(Boolean) as string[]
    ),
  ]
  const exCount = day.program_exercises?.filter(() => !day.rest_day).length ?? 0

  return (
    <button
      onClick={onClick}
      className={`rounded-2xl p-3 text-left border transition-all ${
        isActive
          ? 'bg-orange-500/10 border-orange-500/50'
          : isCompleted
          ? 'bg-green-500/5 border-green-500/30'
          : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className={`text-xs font-black ${
            isActive ? 'text-orange-400' : isCompleted ? 'text-green-400' : 'text-white'
          }`}
        >
          {day.label}
        </span>
        <div
          className={`w-2 h-2 rounded-full flex-shrink-0 ${
            isActive
              ? 'bg-orange-500 animate-pulse'
              : isCompleted
              ? 'bg-green-500'
              : 'bg-zinc-700'
          }`}
        />
      </div>

      {day.rest_day ? (
        <p className="text-zinc-600 text-xs">😴 Rust</p>
      ) : (
        <>
          {muscleGroups.slice(0, 2).map(mg => (
            <p
              key={mg}
              className={`text-xs font-medium truncate ${MUSCLE_GROUP_COLORS[mg] ?? 'text-zinc-400'}`}
            >
              {mg}
            </p>
          ))}
          {muscleGroups.length > 2 && (
            <p className="text-zinc-600 text-xs">+{muscleGroups.length - 2}</p>
          )}
          <p className="text-zinc-600 text-xs mt-1.5">{exCount} oef.</p>
        </>
      )}
    </button>
  )
}
