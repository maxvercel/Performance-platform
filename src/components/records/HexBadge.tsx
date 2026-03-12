'use client'

import type { RankInfo } from '@/types/database'

interface HexBadgeProps {
  rank: RankInfo
  size?: number
  pulse?: boolean
}

export function HexBadge({ rank, size = 64, pulse = false }: HexBadgeProps) {
  const icon = rankIcon(rank.id)
  const abbrev = rank.name.slice(0, 3).toUpperCase()

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Glow effect */}
      <div
        className={`absolute inset-0 rounded-2xl ${pulse ? 'animate-pulse' : ''}`}
        style={{
          background: `radial-gradient(circle, ${rank.outline}35 0%, transparent 70%)`,
          transform: 'scale(1.6)',
          filter: 'blur(8px)',
        }}
      />

      {/* Outer hexagon shape via clip-path */}
      <div
        className="absolute inset-0"
        style={{
          clipPath: 'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)',
          background: rank.outline,
          opacity: 0.9,
        }}
      />

      {/* Inner hexagon with gradient */}
      <div
        className="absolute"
        style={{
          top: '8%',
          left: '8%',
          right: '8%',
          bottom: '8%',
          clipPath: 'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)',
          background: `linear-gradient(135deg, ${rank.g1}, ${rank.g2}, ${rank.g1})`,
        }}
      />

      {/* Shine overlay */}
      <div
        className="absolute"
        style={{
          top: '8%',
          left: '8%',
          right: '8%',
          bottom: '8%',
          clipPath: 'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%, rgba(255,255,255,0.05) 100%)',
        }}
      />

      {/* Icon + abbreviation */}
      <div className="relative z-10 flex flex-col items-center justify-center" style={{ gap: size * 0.02 }}>
        <span style={{ fontSize: size * 0.32, lineHeight: 1 }}>{icon}</span>
        {size >= 48 && (
          <span
            className="font-black tracking-tight leading-none"
            style={{
              fontSize: size * 0.16,
              color: 'rgba(255,255,255,0.9)',
              textShadow: '0 1px 2px rgba(0,0,0,0.5)',
            }}
          >
            {abbrev}
          </span>
        )}
      </div>
    </div>
  )
}

function rankIcon(id: string): string {
  switch (id) {
    case 'olympian': return '👑'
    case 'titan': return '⚡'
    case 'champion': return '🏆'
    case 'diamond': return '💎'
    case 'platinum': return '⭐'
    case 'gold': return '🥇'
    case 'silver': return '🥈'
    case 'bronze': return '🥉'
    case 'wood': return '🪵'
    default: return '🏋️'
  }
}
