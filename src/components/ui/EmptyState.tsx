/**
 * Shared empty state component — replaces the repeated empty state pattern.
 */
'use client'

import { Button } from './Button'

interface EmptyStateProps {
  icon: string
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
      <div className="text-5xl mb-3">{icon}</div>
      <h2 className="text-white font-bold text-lg mb-2">{title}</h2>
      <p className="text-zinc-500 text-sm mb-6">{description}</p>
      {action && (
        <Button onClick={action.onClick} size="md">
          {action.label}
        </Button>
      )}
    </div>
  )
}
