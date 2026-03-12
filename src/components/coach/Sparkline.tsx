'use client'

import { memo } from 'react'

interface SparklineProps {
  data: number[]
}

export const Sparkline = memo(function Sparkline({ data }: SparklineProps) {
  const max = Math.max(...data, 1)
  return (
    <div className="flex items-end gap-0.5 h-6" aria-label="Workout frequentie laatste 5 weken">
      {data.map((val, i) => (
        <div
          key={i}
          className={`flex-1 rounded-sm transition-all ${val === 0 ? 'bg-zinc-800' : 'bg-orange-500/70'}`}
          style={{ height: `${Math.max(15, (val / max) * 100)}%` }}
          aria-label={`Week ${i + 1}: ${val} workouts`}
        />
      ))}
    </div>
  )
})
