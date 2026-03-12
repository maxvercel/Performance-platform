'use client'

import { memo } from 'react'
import { formatVolume } from '@/utils/calculations'

const MG_BG_COLORS: Record<string, string> = {
  Borst: 'bg-blue-500',
  Rug: 'bg-purple-500',
  Benen: 'bg-red-500',
  Schouders: 'bg-yellow-500',
  Armen: 'bg-orange-500',
  Core: 'bg-green-500',
  Billen: 'bg-pink-500',
}

interface MuscleVolumeChartProps {
  data: { name: string; volume: number }[]
}

export const MuscleVolumeChart = memo(function MuscleVolumeChart({ data }: MuscleVolumeChartProps) {
  if (data.length === 0) return null
  const max = data[0]?.volume ?? 1

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <p className="text-white font-bold mb-1 text-sm">Volume per spiergroep</p>
      <p className="text-zinc-500 text-xs mb-4">Totaal kg × reps — laatste 30 workouts</p>
      <div className="space-y-3">
        {data.map(({ name, volume }) => {
          const pct = Math.round((volume / max) * 100)
          const barColor = MG_BG_COLORS[name] ?? 'bg-orange-500'
          return (
            <div key={name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-zinc-300 text-xs font-semibold">{name}</span>
                <span className="text-zinc-500 text-xs">{formatVolume(volume)} kg</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${barColor} rounded-full transition-all duration-700`}
                  style={{ width: `${pct}%` }}
                  role="progressbar"
                  aria-valuenow={volume}
                  aria-valuemax={max}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})
