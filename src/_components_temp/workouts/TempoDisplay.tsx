'use client'

const PHASES = ['Neer', 'Pauze', 'Omhoog', 'Pauze'] as const
const COLORS = ['bg-blue-500', 'bg-yellow-500', 'bg-green-500', 'bg-orange-500'] as const

interface TempoDisplayProps {
  tempo: string | null | undefined
}

export function TempoDisplay({ tempo }: TempoDisplayProps) {
  if (!tempo || tempo.trim() === '') {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-zinc-600 text-xs">Tempo:</span>
        <span className="text-zinc-700 text-xs font-mono">Vrij</span>
      </div>
    )
  }

  const parts = tempo.split('-')

  return (
    <div className="flex items-center gap-2">
      <span className="text-zinc-500 text-xs flex-shrink-0">Tempo:</span>
      <div className="flex items-center gap-1">
        {PHASES.map((phase, i) => {
          const val = parts[i] ?? '0'
          return (
            <div key={i} className="flex flex-col items-center">
              <div
                className={`${COLORS[i]} rounded text-white text-xs font-black flex items-center justify-center`}
                style={{ width: '22px', height: '22px', fontSize: '11px' }}
              >
                {val}
              </div>
              <span className="text-zinc-700 text-xs" style={{ fontSize: '8px' }}>{phase}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
