'use client'

import { FEELING_OPTIONS } from '@/utils/constants'

interface FeelingSelectorProps {
  value: number
  onChange: (value: number) => void
}

export function FeelingSelector({ value, onChange }: FeelingSelectorProps) {
  return (
    <div className="flex justify-between" role="radiogroup" aria-label="Hoe voelde de workout?">
      {FEELING_OPTIONS.map(({ val, emoji, label }) => (
        <button
          key={val}
          onClick={() => onChange(val)}
          role="radio"
          aria-checked={value === val}
          aria-label={`${label} ${emoji}`}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl transition ${
            value === val
              ? 'bg-orange-500/20 border border-orange-500'
              : 'border border-transparent'
          }`}
        >
          <span className="text-2xl">{emoji}</span>
          <span className="text-zinc-500 text-xs">{label}</span>
        </button>
      ))}
    </div>
  )
}
