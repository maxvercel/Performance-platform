'use client'

import { differenceInDays } from 'date-fns'
import { Sparkline } from './Sparkline'

interface ClientCardProps {
  client: any
  statusColor: 'green' | 'orange' | 'red'
  onClick: () => void
}

export function ClientCard({ client, statusColor, onClick }: ClientCardProps) {
  const borderColor =
    statusColor === 'red' ? 'border-red-500/50'
    : statusColor === 'orange' ? 'border-orange-500/40'
    : 'border-zinc-800'

  const dotColor =
    statusColor === 'red' ? 'bg-red-500'
    : statusColor === 'orange' ? 'bg-orange-400'
    : 'bg-green-500'

  const avatarBg =
    statusColor === 'red' ? 'bg-red-500'
    : statusColor === 'orange' ? 'bg-orange-500'
    : 'bg-green-600'

  const workoutDaysAgo = client.lastWorkout
    ? differenceInDays(new Date(), new Date(client.lastWorkout))
    : null

  return (
    <button
      onClick={onClick}
      className={`w-full bg-zinc-900 border ${borderColor} rounded-2xl p-4 text-left transition hover:brightness-110`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className={`w-11 h-11 ${avatarBg} rounded-full flex items-center justify-center text-white font-black text-lg`}>
            {client.full_name?.[0] ?? '?'}
          </div>
          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${dotColor} rounded-full border-2 border-zinc-900`} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-white font-bold text-sm">{client.full_name}</p>
            {client.unread > 0 && (
              <span className="bg-orange-500 text-white text-xs font-black px-1.5 py-0.5 rounded-full">
                {client.unread}
              </span>
            )}
          </div>

          {/* Status pills */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              workoutDaysAgo === null ? 'bg-red-500/20 text-red-400'
              : workoutDaysAgo > 7 ? 'bg-red-500/20 text-red-400'
              : workoutDaysAgo > 4 ? 'bg-orange-500/20 text-orange-400'
              : 'bg-green-500/20 text-green-400'
            }`}>
              💪 {workoutDaysAgo === null ? 'Nog geen workout'
                : workoutDaysAgo === 0 ? 'Vandaag'
                : `${workoutDaysAgo}d geleden`}
            </span>
            {client.daysLeft !== null && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                client.daysLeft <= 3 ? 'bg-red-500/20 text-red-400'
                : client.daysLeft <= 7 ? 'bg-orange-500/20 text-orange-400'
                : 'bg-zinc-800 text-zinc-400'
              }`}>
                📅 {client.daysLeft <= 0 ? 'Verlopen!' : `Nog ${client.daysLeft}d`}
              </span>
            )}
            {!client.activeProgram && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-500/20 text-red-400">
                ⚠️ Geen programma
              </span>
            )}
          </div>

          {/* Sparkline + compliance */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Sparkline data={client.sparkline} />
              <p className="text-zinc-700 text-xs mt-0.5">5 weken</p>
            </div>
            <div className="text-right">
              <p className={`text-xs font-black ${
                client.compliance >= 70 ? 'text-green-400'
                : client.compliance >= 40 ? 'text-orange-400'
                : 'text-red-400'
              }`}>{client.compliance}%</p>
              <p className="text-zinc-700 text-xs">compliance</p>
            </div>
          </div>

          {client.activeProgram && (
            <p className="text-zinc-600 text-xs mt-1.5">📋 {client.activeProgram.name}</p>
          )}
        </div>

        <span className="text-zinc-600 text-sm flex-shrink-0">→</span>
      </div>
    </button>
  )
}
