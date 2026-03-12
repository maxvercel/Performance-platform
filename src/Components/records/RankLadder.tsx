'use client'

import { RANKS, RANK_ORDER } from '@/utils/constants'

interface RankLadderProps {
  currentRankId: string
}

export function RankLadder({ currentRankId }: RankLadderProps) {
  const orderedRanks = [...RANKS].reverse()
  const currentOrder = RANK_ORDER[currentRankId] ?? 0
  const totalRanks = orderedRanks.length
  const progressPct = Math.max(5, ((currentOrder) / totalRanks) * 100)

  return (
    <div className="space-y-2" role="list" aria-label="Rank ladder">
      {/* Progress bar */}
      <div className="relative h-2.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${progressPct}%`,
            background: `linear-gradient(90deg, ${orderedRanks[0]?.outline ?? '#b45309'}, ${
              orderedRanks.find(r => r.id === currentRankId)?.outline ?? '#f97316'
            })`,
            boxShadow: `0 0 8px ${orderedRanks.find(r => r.id === currentRankId)?.outline ?? '#f97316'}66`,
          }}
        />
      </div>

      {/* Rank dots */}
      <div className="flex items-center justify-between px-0.5">
        {orderedRanks.map(r => {
          const isReached = (RANK_ORDER[r.id] ?? 0) <= currentOrder
          const isCurrent = r.id === currentRankId

          return (
            <div key={r.id} className="flex flex-col items-center gap-1" role="listitem">
              <div
                className="rounded-full transition-all duration-300"
                style={{
                  width: isCurrent ? 14 : 8,
                  height: isCurrent ? 14 : 8,
                  backgroundColor: isReached ? r.outline : '#3f3f46',
                  boxShadow: isCurrent
                    ? `0 0 0 2px #18181b, 0 0 0 4px ${r.outline}, 0 0 8px ${r.outline}88`
                    : 'none',
                }}
              />
              <span
                className="text-[9px] font-bold leading-none"
                style={{ color: isReached ? r.outline : '#52525b' }}
              >
                {r.name.slice(0, 3).toUpperCase()}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
