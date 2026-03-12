'use client'

import { useState, memo, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'

type ChartMetric = 'gewicht' | '1RM' | 'volume'

interface ExerciseProgressChartProps {
  exercises: Array<{ id: string; name: string }>
  selectedExercise: string
  exerciseProgress: Array<{
    date: string
    gewicht: number
    '1RM': number
    volume: number
    isPR: boolean
  }>
  onExerciseChange: (exerciseId: string) => void
}

export const ExerciseProgressChart = memo(function ExerciseProgressChart({
  exercises,
  selectedExercise,
  exerciseProgress,
  onExerciseChange,
}: ExerciseProgressChartProps) {
  const [chartMetric, setChartMetric] = useState<ChartMetric>('gewicht')

  if (exercises.length === 0) return null

  const bestRM = useMemo(
    () => exerciseProgress.length > 0 ? Math.max(...exerciseProgress.map(e => e['1RM'])) : 0,
    [exerciseProgress]
  )

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <p className="text-white font-bold mb-1 text-sm">Progressie per oefening</p>

      <select
        value={selectedExercise}
        onChange={e => onExerciseChange(e.target.value)}
        className="w-full bg-zinc-800 text-white text-sm rounded-xl px-3 py-2 mb-3
                   focus:outline-none focus:ring-1 focus:ring-orange-500 border border-zinc-700"
      >
        {exercises.map(ex => (
          <option key={ex.id} value={ex.id}>
            {ex.name}
          </option>
        ))}
      </select>

      {/* Metric toggle */}
      <div className="flex bg-zinc-800 rounded-xl p-1 mb-3 gap-1" role="tablist">
        {(['gewicht', '1RM', 'volume'] as const).map(m => (
          <button
            key={m}
            onClick={() => setChartMetric(m)}
            role="tab"
            aria-selected={chartMetric === m}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
              chartMetric === m ? 'bg-orange-500 text-white' : 'text-zinc-400'
            }`}
          >
            {m === 'gewicht' ? '⚖️ Gewicht' : m === '1RM' ? '🏆 1RM' : '📦 Volume'}
          </button>
        ))}
      </div>

      {exerciseProgress.length > 1 ? (
        <>
          {chartMetric === '1RM' && bestRM > 0 && (
            <div className="flex items-center gap-2 mb-3 bg-yellow-500/10 rounded-xl px-3 py-2">
              <span>🏆</span>
              <span className="text-yellow-400 text-sm font-bold">Beste 1RM: {bestRM} kg</span>
            </div>
          )}
          <ResponsiveContainer width="100%" height={180}>
            <LineChart
              data={exerciseProgress}
              margin={{ top: 10, right: 5, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 10 }} />
              <YAxis tick={{ fill: '#71717a', fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#18181b',
                  border: '1px solid #3f3f46',
                  borderRadius: 8,
                }}
                labelStyle={{ color: '#fff' }}
                formatter={(v: any) => [
                  chartMetric === 'volume' ? `${v} kg×reps` : `${v} kg`,
                  chartMetric === 'gewicht'
                    ? 'Gewicht'
                    : chartMetric === '1RM'
                    ? '1RM schatting'
                    : 'Volume',
                ]}
              />
              <Line
                type="monotone"
                dataKey={chartMetric}
                stroke="#f97316"
                strokeWidth={2.5}
                dot={(props: any) => {
                  const { cx, cy, payload } = props
                  if (payload.isPR && chartMetric !== 'volume') {
                    return (
                      <circle
                        key={`dot-${cx}-${cy}`}
                        cx={cx}
                        cy={cy}
                        r={5}
                        fill="#facc15"
                        stroke="#f97316"
                        strokeWidth={2}
                      />
                    )
                  }
                  return (
                    <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={3} fill="#f97316" />
                  )
                }}
                activeDot={{ r: 5 }}
                name={
                  chartMetric === 'gewicht' ? 'Gewicht' : chartMetric === '1RM' ? '1RM' : 'Volume'
                }
              />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-zinc-600 text-xs mt-2 text-center">
            {chartMetric === '1RM' && '🏆 Geel = nieuw PR'}
            {chartMetric === 'gewicht' && 'Zwaarste set per sessie'}
            {chartMetric === 'volume' && 'kg × reps per sessie'}
          </p>
        </>
      ) : (
        <p className="text-zinc-500 text-sm text-center py-4">
          Nog niet genoeg data — log meer workouts 💪
        </p>
      )}
    </div>
  )
})
