'use client'

import { useState } from 'react'
import {
  format, parseISO, startOfWeek, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameMonth, endOfWeek,
} from 'date-fns'
import { nl } from 'date-fns/locale'
import { FEELING_EMOJIS } from '@/utils/constants'
import { formatVolume } from '@/utils/calculations'

interface WorkoutCalendarProps {
  workoutHistory: any[]
  month: Date
  onPrevMonth: () => void
  onNextMonth: () => void
}

export function WorkoutCalendar({
  workoutHistory,
  month,
  onPrevMonth,
  onNextMonth,
}: WorkoutCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const workoutByDate: Record<string, any> = {}
  workoutHistory.forEach((log: any) => {
    if (log.logged_at) {
      const d = format(parseISO(log.logged_at), 'yyyy-MM-dd')
      workoutByDate[d] = log
    }
  })

  const monthStart = startOfMonth(month)
  const monthEnd = endOfMonth(month)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const monthWorkouts = Object.keys(workoutByDate).filter(d =>
    d.startsWith(format(month, 'yyyy-MM'))
  ).length

  const selectedLog = selectedDate ? workoutByDate[selectedDate] : null

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
      {/* Month header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <button
          onClick={onPrevMonth}
          aria-label="Vorige maand"
          className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white
                     bg-zinc-800 rounded-lg transition text-lg leading-none"
        >
          ‹
        </button>
        <div className="text-center">
          <p className="text-white font-bold text-sm capitalize">
            {format(month, 'MMMM yyyy', { locale: nl })}
          </p>
          <p className="text-zinc-600 text-xs">
            {monthWorkouts} workout{monthWorkouts !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={onNextMonth}
          aria-label="Volgende maand"
          className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white
                     bg-zinc-800 rounded-lg transition text-lg leading-none"
        >
          ›
        </button>
      </div>

      <div className="px-3 pt-3 pb-1">
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map(d => (
            <div key={d} className="text-center text-zinc-600 text-xs font-bold py-1">{d}</div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const inMonth = isSameMonth(day, month)
            const hasWorkout = !!workoutByDate[dateStr]
            const isToday = dateStr === todayStr
            const isSelected = dateStr === selectedDate
            const log = workoutByDate[dateStr]

            return (
              <button
                key={dateStr}
                onClick={() => {
                  if (!inMonth || !hasWorkout) return
                  setSelectedDate(isSelected ? null : dateStr)
                }}
                className={`rounded-xl flex flex-col items-center justify-center py-1.5 min-h-[40px] transition ${
                  !inMonth ? 'opacity-0 pointer-events-none'
                  : isSelected ? 'bg-orange-500 ring-2 ring-orange-300'
                  : hasWorkout ? 'bg-orange-500/20 hover:bg-orange-500/30 cursor-pointer'
                  : isToday ? 'bg-zinc-800 ring-1 ring-zinc-600'
                  : 'hover:bg-zinc-800/50'
                }`}
              >
                <span className={`text-xs font-bold leading-none ${
                  isSelected ? 'text-white'
                  : isToday && !hasWorkout ? 'text-orange-400'
                  : hasWorkout ? 'text-white'
                  : inMonth ? 'text-zinc-500'
                  : 'text-transparent'
                }`}>
                  {format(day, 'd')}
                </span>
                {hasWorkout && log?.feeling && (
                  <span className="text-xs leading-none mt-0.5">
                    {FEELING_EMOJIS[log.feeling] ?? ''}
                  </span>
                )}
                {hasWorkout && !log?.feeling && (
                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full mt-0.5" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected day detail */}
      {selectedLog && (
        <div className="mx-3 mb-3 mt-2 bg-zinc-800 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-white font-bold text-sm">
              {selectedLog.program_days?.label ?? 'Workout'}
            </p>
            {selectedLog.feeling && (
              <span className="text-lg">{FEELING_EMOJIS[selectedLog.feeling]}</span>
            )}
          </div>
          <p className="text-zinc-500 text-xs">
            {selectedDate ? format(parseISO(selectedDate), 'EEEE d MMMM', { locale: nl }) : ''}
          </p>
          {selectedLog.exercise_logs && selectedLog.exercise_logs.length > 0 && (
            <div className="flex gap-3 mt-2">
              <span className="text-zinc-400 text-xs">
                {selectedLog.exercise_logs.length} sets
              </span>
              {(() => {
                const vol = selectedLog.exercise_logs.reduce(
                  (a: number, el: any) => a + ((el.weight_kg ?? 0) * (el.reps_completed ?? 0)),
                  0
                )
                return vol > 0 ? (
                  <span className="text-zinc-400 text-xs">{formatVolume(vol)} kg volume</span>
                ) : null
              })()}
            </div>
          )}
          <p className="text-zinc-600 text-xs mt-1">{selectedLog.programs?.name}</p>
        </div>
      )}
    </div>
  )
}
