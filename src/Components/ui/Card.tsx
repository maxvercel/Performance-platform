/**
 * Shared Card component — replaces the repeated bg-zinc-900 border pattern.
 */
'use client'

import { type HTMLAttributes, forwardRef } from 'react'

type CardVariant = 'default' | 'active' | 'success' | 'warning'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  interactive?: boolean
}

const variantStyles: Record<CardVariant, string> = {
  default: 'bg-zinc-900 border-zinc-800',
  active: 'bg-orange-500/10 border-orange-500/50',
  success: 'bg-green-500/5 border-green-500/30',
  warning: 'bg-red-500/10 border-red-500/30',
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', interactive = false, className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          border rounded-2xl p-4 transition-all
          ${variantStyles[variant]}
          ${interactive ? 'cursor-pointer active:opacity-80 hover:brightness-110' : ''}
          ${className}
        `.trim()}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'
