'use client'

interface ProgressBarProps {
  completed: number
  total: number
  label?: string
}

export function ProgressBar({ completed, total, label }: ProgressBarProps) {
  const pct = total > 0 ? (completed / total) * 100 : 0

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">
          {label ?? 'Voortgang'}
        </p>
        <p className="text-white font-bold text-sm">{completed}/{total} sets</p>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-orange-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={completed}
          aria-valuemin={0}
          aria-valuemax={total}
        />
      </div>
    </div>
  )
}
