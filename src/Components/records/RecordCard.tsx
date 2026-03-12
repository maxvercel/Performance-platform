'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { nl } from 'date-fns/locale'
import { calc1RM } from '@/utils/calculations'
import type { RankInfo } from '@/types/database'
import { HexBadge } from './HexBadge'
import { RankLadder } from './RankLadder'

interface PREntry {
  weight: number
  reps: number
  date: string
  improvement: number
}

interface RecordData {
  id: string
  name: string
  rank: RankInfo
  prs: PREntry[]
  currentMax: number
  currentMaxReps: number
  estMax1RM: number
  improvementPct: number
}

interface RecordCardProps {
  record: RecordData
}

function buildShareText(record: RecordData): string {
  return [
    `${record.rank.name.toUpperCase()} RANK bereikt!`,
    ``,
    `🏋️ ${record.name}`,
    `💪 ${record.currentMax}kg × ${record.currentMaxReps} reps`,
    `📊 Geschat 1RM: ${record.estMax1RM}kg`,
    record.improvementPct > 0 ? `📈 +${record.improvementPct}% sterker geworden!` : '',
    ``,
    `${record.prs.length}× een PR gezet`,
    ``,
    `#9toFit #PersonalRecord #${record.rank.name} #Fitness`,
  ].filter(Boolean).join('\n')
}

export function RecordCard({ record }: RecordCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [copied, setCopied] = useState(false)

  const lastPR = record.prs[record.prs.length - 1]

  async function shareRecord() {
    setSharing(true)
    const text = buildShareText(record)
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: `${record.rank.name} Rank: ${record.name}`, text })
      } else {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      }
    } catch (_) { /* user cancelled */ }
    setSharing(false)
  }

  return (
    <div
      className="relative rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        background: `linear-gradient(135deg, ${record.rank.outline}08 0%, ${record.rank.g1}15 50%, ${record.rank.outline}05 100%)`,
        border: `1px solid ${record.rank.outline}25`,
      }}
    >
      {/* Subtle top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background: `linear-gradient(90deg, transparent, ${record.rank.outline}60, transparent)`,
        }}
      />

      <button
        className="w-full p-4 text-left"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">
            <HexBadge rank={record.rank} size={56} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-[15px] leading-tight truncate">{record.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="text-xs font-black tracking-wide uppercase"
                style={{ color: record.rank.outline }}
              >
                {record.rank.name}
              </span>
              <span className="text-zinc-700">·</span>
              <span className="text-zinc-500 text-xs font-medium">{record.prs.length}× PR</span>
              {record.improvementPct > 0 && (
                <>
                  <span className="text-zinc-700">·</span>
                  <span className="text-green-400 text-xs font-bold">+{record.improvementPct}%</span>
                </>
              )}
            </div>
            <div className="mt-2.5">
              <RankLadder currentRankId={record.rank.id} />
            </div>
          </div>

          <div className="text-right flex-shrink-0">
            <p className="text-white font-black text-2xl leading-none tracking-tight">
              {record.currentMax}<span className="text-zinc-500 text-sm font-bold ml-0.5">kg</span>
            </p>
            <p className="text-zinc-600 text-[11px] mt-1 font-medium">
              ~{record.estMax1RM}kg 1RM
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800/60">
          <button
            onClick={e => { e.stopPropagation(); shareRecord() }}
            className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-full transition-all duration-200 active:scale-95 hover:brightness-110"
            style={{
              background: `linear-gradient(135deg, ${record.rank.outline}18, ${record.rank.outline}08)`,
              color: record.rank.outline,
              border: `1px solid ${record.rank.outline}30`,
            }}
          >
            {sharing ? '...' : copied ? '✓ Gekopieerd!' : '📤 Deel rank'}
          </button>
          <p className="text-zinc-600 text-xs font-medium">
            {lastPR && format(parseISO(lastPR.date), 'd MMM yyyy', { locale: nl })}
            <span className="ml-2 text-zinc-700">{isExpanded ? '▲' : '▼'}</span>
          </p>
        </div>
      </button>

      {/* PR Timeline */}
      {isExpanded && (
        <div className="px-4 pb-5 border-t border-zinc-800/40">
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mt-4 mb-4">
            PR Timeline
          </p>
          <div className="relative">
            {/* Timeline line */}
            <div
              className="absolute left-[7px] top-3 bottom-3 w-[2px] rounded-full"
              style={{
                background: `linear-gradient(180deg, ${record.rank.outline}60, ${record.rank.outline}10)`,
              }}
            />
            <div className="space-y-3">
              {[...record.prs].reverse().map((pr, i) => {
                const isLatest = i === 0
                return (
                  <div key={i} className="flex items-start gap-3.5 relative">
                    {/* Timeline dot */}
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0 z-10 mt-1.5"
                      style={{
                        backgroundColor: isLatest ? record.rank.outline : '#27272a',
                        border: `2px solid ${isLatest ? record.rank.outline : '#3f3f46'}`,
                        boxShadow: isLatest ? `0 0 8px ${record.rank.outline}55` : 'none',
                      }}
                    />

                    {/* Content card */}
                    <div
                      className="flex-1 rounded-xl p-3.5 transition-colors"
                      style={{
                        backgroundColor: isLatest ? `${record.rank.outline}08` : 'rgba(39,39,42,0.5)',
                        border: isLatest ? `1px solid ${record.rank.outline}20` : '1px solid transparent',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-baseline gap-2">
                          <span className={`font-black text-lg ${isLatest ? 'text-white' : 'text-zinc-300'}`}>
                            {pr.weight}kg
                          </span>
                          <span className="text-zinc-500 text-xs">× {pr.reps} reps</span>
                          <span className="text-zinc-600 text-xs">
                            (1RM ~{calc1RM(pr.weight, pr.reps)}kg)
                          </span>
                        </div>
                        {isLatest && (
                          <span
                            className="text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider"
                            style={{
                              background: `${record.rank.outline}15`,
                              color: record.rank.outline,
                              border: `1px solid ${record.rank.outline}25`,
                            }}
                          >
                            Huidig
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-zinc-600 text-xs">
                          {format(parseISO(pr.date), 'EEEE d MMMM yyyy', { locale: nl })}
                        </span>
                        {pr.improvement > 0 && (
                          <span className="text-green-400 text-[11px] font-bold">
                            ↑ +{Math.round(pr.improvement)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
