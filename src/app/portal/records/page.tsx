'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { PageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { calc1RM } from '@/utils/calculations'
import { RANK_ORDER, getRank } from '@/utils/constants'
import { HexBadge, RankLadder, RecordCard } from '@/components/records'

type FilterType = 'all' | 'elite' | 'gold'

const ELITE_IDS = new Set(['champion', 'titan', 'olympian'])
const GOLD_IDS = new Set(['gold', 'platinum', 'diamond', 'champion', 'titan', 'olympian'])

export default function RecordsPage() {
  const supabase = createClient()
  const router = useRouter()
  const { profile, loading: authLoading } = useAuth()

  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')

  useEffect(() => {
    if (authLoading || !profile) return
    loadRecords()
  }, [authLoading, profile?.id])

  async function loadRecords() {
    if (!profile) return

    // Step 1: Get all completed workout_log IDs for this user
    const { data: workoutLogs } = await supabase
      .from('workout_logs')
      .select('id, logged_at')
      .eq('client_id', profile.id)
      .not('completed_at', 'is', null)

    const wlIds = workoutLogs?.map(wl => wl.id) ?? []
    if (wlIds.length === 0) {
      setLoading(false)
      return
    }

    // Build a map of workout_log_id → logged_at for date lookups
    const wlDateMap: Record<string, string> = {}
    workoutLogs?.forEach(wl => { wlDateMap[wl.id] = wl.logged_at })

    // Step 2: Get all exercise logs for those workouts
    const { data: logs, error } = await supabase
      .from('exercise_logs')
      .select('id, weight_kg, reps_completed, workout_log_id, exercises(id, name, muscle_group)')
      .in('workout_log_id', wlIds)
      .not('weight_kg', 'is', null)

    if (error) {
      console.error('Records query error:', error)
      setLoading(false)
      return
    }

    if (!logs || logs.length === 0) {
      setLoading(false)
      return
    }

    // ── Step 3: Per oefening, per workout-sessie → alleen het zwaarste gewicht ──
    // Dit voorkomt dat opwarmsets als losse PRs tellen.

    // 3a. Groepeer logs per oefening + per workout sessie
    const sessionBests: Record<string, Record<string, { weight: number; reps: number; date: string; exName: string; exMuscle: string }>> = {}

    logs.forEach((log: any) => {
      const exId = log.exercises?.id
      if (!exId || !log.weight_kg) return
      const wlId = log.workout_log_id
      const w = parseFloat(log.weight_kg)

      if (!sessionBests[exId]) sessionBests[exId] = {}
      const existing = sessionBests[exId][wlId]

      if (!existing || w > existing.weight) {
        sessionBests[exId][wlId] = {
          weight: w,
          reps: log.reps_completed ?? 1,
          date: wlDateMap[wlId] ?? '',
          exName: log.exercises.name,
          exMuscle: log.exercises.muscle_group ?? 'Overig',
        }
      }
    })

    // 3b. Per oefening: sorteer sessies op datum, tel PRs over sessies heen
    const exerciseMap: Record<string, any> = {}

    for (const [exId, sessions] of Object.entries(sessionBests)) {
      const sorted = Object.values(sessions).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )

      const entry = {
        id: exId,
        name: sorted[0].exName,
        muscleGroup: sorted[0].exMuscle,
        prs: [] as any[],
        currentMax: 0,
        currentMaxReps: 1,
        firstWeight: null as number | null,
      }

      for (const session of sorted) {
        if (session.weight > entry.currentMax) {
          if (entry.firstWeight === null) entry.firstWeight = session.weight
          entry.prs.push({
            weight: session.weight,
            reps: session.reps,
            date: session.date,
            improvement: entry.currentMax > 0
              ? ((session.weight - entry.currentMax) / entry.currentMax) * 100
              : 0,
          })
          entry.currentMax = session.weight
          entry.currentMaxReps = session.reps
        }
      }

      exerciseMap[exId] = entry
    }

    const result = Object.values(exerciseMap)
      .filter((e: any) => e.prs.length > 0)
      .map((e: any) => {
        const improvementPct = e.firstWeight > 0
          ? ((e.currentMax - e.firstWeight) / e.firstWeight) * 100
          : 0
        const rank = getRank(e.prs.length, improvementPct)
        return {
          ...e,
          rank,
          estMax1RM: calc1RM(e.currentMax, e.currentMaxReps),
          improvementPct: Math.round(improvementPct),
        }
      })
      .sort((a: any, b: any) => {
        const diff = (RANK_ORDER[b.rank.id] ?? 0) - (RANK_ORDER[a.rank.id] ?? 0)
        return diff !== 0 ? diff : b.improvementPct - a.improvementPct
      })

    setRecords(result)
    setLoading(false)
  }

  /* ─── Computed ─── */

  const filteredRecords = records.filter(r => {
    if (filter === 'elite') return ELITE_IDS.has(r.rank.id)
    if (filter === 'gold') return GOLD_IDS.has(r.rank.id)
    return true
  })

  const topRank = records.length > 0
    ? records.reduce((best, r) => (RANK_ORDER[r.rank.id] ?? 0) > (RANK_ORDER[best.rank.id] ?? 0) ? r : best, records[0])
    : null
  const totalPRs = records.reduce((sum, r) => sum + r.prs.length, 0)

  /* ─── Render ─── */

  if (authLoading || loading) return <PageSpinner />

  return (
    <div className="min-h-screen bg-zinc-950 pb-28">
      {/* Hero header */}
      <div className="relative overflow-hidden px-5 pt-12 pb-6 border-b border-zinc-800/50">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-zinc-900 to-zinc-950" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-orange-500/8 blur-3xl rounded-full" />
        <div className="relative z-10">
          <p className="text-orange-500 text-[10px] font-black tracking-[0.25em] uppercase mb-1">Hall of Fame</p>
          <h1 className="text-white text-3xl font-black tracking-tight">PR Muur</h1>

          {topRank && (
            <div className="flex items-center gap-4 mt-5">
              <HexBadge rank={topRank.rank} size={64} pulse />
              <div>
                <p className="text-white font-bold text-base">
                  Hoogste rank: <span style={{ color: topRank.rank.outline }}>{topRank.rank.name}</span>
                </p>
                <p className="text-zinc-500 text-sm mt-0.5">
                  {records.length} oefeningen · {totalPRs} totaal PRs
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-5 space-y-4">
        {records.length === 0 ? (
          <EmptyState
            icon="🏋️"
            title="Nog geen records"
            description="Log gewichten tijdens je workouts om je eerste rank te behalen!"
            action={{ label: 'Naar workouts →', onClick: () => router.push('/portal/workouts') }}
          />
        ) : (
          <>
            {/* Rank overview card */}
            <div
              className="rounded-2xl p-4"
              style={{
                background: 'linear-gradient(135deg, rgba(39,39,42,0.8), rgba(24,24,27,0.9))',
                border: '1px solid rgba(63,63,70,0.5)',
              }}
            >
              <p className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em] mb-3">
                Jouw voortgang
              </p>
              <RankLadder currentRankId={topRank?.rank?.id ?? 'wood'} />
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2" role="tablist">
              {([
                { key: 'all' as const, label: `Alle (${records.length})` },
                { key: 'gold' as const, label: `Goud+ (${records.filter(r => GOLD_IDS.has(r.rank.id)).length})` },
                { key: 'elite' as const, label: `Elite (${records.filter(r => ELITE_IDS.has(r.rank.id)).length})` },
              ]).map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  role="tab"
                  aria-selected={filter === f.key}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 ${
                    filter === f.key
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                      : 'bg-zinc-800/60 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Record cards */}
            <div className="space-y-3">
              {filteredRecords.map((record: any) => (
                <RecordCard key={record.id} record={record} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
