/**
 * Shared Input component — replaces repeated input styling patterns.
 */
'use client'

import { forwardRef, type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  suffix?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, suffix, className = '', ...props }, ref) => {
    return (
      <div>
        {label && (
          <label className="text-zinc-500 text-xs uppercase tracking-wider mb-1 block">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            className={`
              w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3
              text-white text-sm placeholder-zinc-500
              focus:outline-none focus:border-orange-500 transition
              ${suffix ? 'pr-10' : ''}
              ${className}
            `.trim()}
            {...props}
          />
          {suffix && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">
              {suffix}
            </span>
          )}
        </div>
      </div>
    )
  }
)

Input.displayName = 'Input'
