'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { format, startOfWeek, subWeeks } from 'date-fns'
import { nl } from 'date-fns/locale'
import { useAuth } from '@/hooks/useAuth'
import { progressService } from '@/lib/services/progressService'
import { habitService } from '@/lib/services/habitService'
import { createClient } from '@/lib/supabase/client'
import { DashboardSkeleton } from '@/components/ui/Skeleton'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { calcPercentage } from '@/utils/calculations'
import WeightLogger from '@/components/dashboard/WeightLogger'
import WeightChart from '@/components/dashboard/WeightChart'
import type { ProgressMetric } from '@/types'

export default function DashboardPage() {
  const { profile, userId, loading: authLoading } = useAuth({ requireOnboarding: true })
  const router = useRouter()
  const supabase = createClient()

  const [dataLoading, setDataLoading] = useState(true)
  const [weightData, setWeightData] = useState<ProgressMetric[]>([])
  const [todayHabits, setTodayHabits] = useState({ completed: 0, total: 0 })
  const [activeProgram, setActiveProgram] = useState<{ name: string; end_date: string | null } | null>(null)
  const [lastWorkout, setLastWorkout] = useState<string | null>(null)
  const [streak, setStreak] = useState(0)

  const loadDashboardData = useCallback(async () => {
    if (!userId) return

    try {
      // Parallel data fetching — ~3x faster than sequential
      const [weights, habits, program, workoutLogs] = await Promise.all([
        progressService.getWeightHistory(userId),
        habitService.getTodayStats(userId),
        supabase
          .from('programs')
          .select('name, end_date')
          .eq('client_id', userId)
          .eq('is_active', true)
          .limit(1)
          .single()
          .then(({ data }) => data),
        progressService.getCompletedWorkouts(userId),
      ])

      setWeightData(weights)
      setTodayHabits(habits)
      setActiveProgram(program)

      if (workoutLogs.length > 0) {
        setLastWorkout(workoutLogs[0].logged_at)

        // Calculate weekly streak
        const weeksWithWorkout = new Set<string>(
          workoutLogs.map(l =>
            startOfWeek(new Date(l.logged_at), { weekStartsOn: 1 }).toISOString()
          )
        )
        let streakCount = 0
        let checkWeek = startOfWeek(new Date(), { weekStartsOn: 1 })
        while (weeksWithWorkout.has(checkWeek.toISOString())) {
          streakCount++
          checkWeek = subWeeks(checkWeek, 1)
        }
        setStreak(streakCount)
      }
    } catch (error) {
      console.error('Dashboard data loading error:', error)
    } finally {
      setDataLoading(false)
    }
  }, [userId, supabase])

  useEffect(() => {
    if (!authLoading && userId) loadDashboardData()
  }, [authLoading, userId, loadDashboardData])

  /** Refresh weight chart after logging */
  const handleWeightSaved = useCallback(async () => {
    if (!userId) return
    const freshWeights = await progressService.getWeightHistory(userId)
    setWeightData(freshWeights)
  }, [userId])

  // Show skeleton while loading (premium feel vs spinner)
  if (authLoading || dataLoading) return <DashboardSkeleton />

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Atleet'
  const habitPercent = calcPercentage(todayHabits.completed, todayHabits.total)

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">

      {/* Header */}
      <PageHeader
        label={format(new Date(), 'EEEE d MMMM', { locale: nl })}
        title={`Hey ${firstName} 👋`}
        subtitle={
          streak >= 4 ? `${streak} weken op rij actief — hou het vol! 💪` :
          streak >= 2 ? `${streak} weken achter elkaar getraind 🏋️` :
          'Welkom terug in jouw portal'
        }
        rightContent={streak > 0 ? (
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${
            streak >= 4 ? 'bg-orange-500/20 border border-orange-500/40' :
            streak >= 2 ? 'bg-yellow-500/20 border border-yellow-500/40' :
            'bg-zinc-800 border border-zinc-700'
          }`}>
            <span className="text-base">🔥</span>
            <span className={`text-sm font-black ${
              streak >= 4 ? 'text-orange-400' :
              streak >= 2 ? 'text-yellow-400' :
              'text-zinc-400'
            }`}>{streak}</span>
            <span className="text-zinc-600 text-xs">wk</span>
          </div>
        ) : undefined}
      />

      <div className="px-4 py-5 space-y-4">

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          {/* Habits today */}
          <Card interactive onClick={() => router.push('/portal/habits')}>
            <p className="text-zinc-500 text-xs mb-2">Habits vandaag</p>
            <div className="flex items-end gap-2">
              <span className="text-white text-2xl font-black">{habitPercent}%</span>
            </div>
            <p className="text-zinc-600 text-xs mt-1">
              {todayHabits.completed}/{todayHabits.total} gedaan
            </p>
            <div className="mt-2 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${habitPercent === 100 ? 'bg-green-500' : 'bg-orange-500'}`}
                style={{ width: `${habitPercent}%` }}
              />
            </div>
          </Card>

          {/* Streak card */}
          <Card interactive onClick={() => router.push('/portal/progress')}>
            <p className="text-zinc-500 text-xs mb-2">Week streak</p>
            <div className="flex items-center gap-2">
              <span className="text-3xl">
                {streak === 0 ? '😴' : streak >= 8 ? '🔥' : streak >= 4 ? '⚡' : '💪'}
              </span>
              <span className="text-white text-2xl font-black">{streak}</span>
            </div>
            <p className="text-zinc-600 text-xs mt-1">
              {streak === 0 ? 'Nog geen workouts' :
               streak === 1 ? 'week actief' :
               `weken op rij`}
            </p>
            {streak > 0 && (
              <div className="mt-2 flex gap-0.5 h-1.5">
                {Array.from({ length: Math.min(streak, 8) }).map((_, i) => (
                  <div key={i} className="flex-1 bg-orange-500 rounded-full" />
                ))}
                {Array.from({ length: Math.max(0, 8 - streak) }).map((_, i) => (
                  <div key={i} className="flex-1 bg-zinc-800 rounded-full" />
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Active program banner */}
        {activeProgram && (
          <Card interactive onClick={() => router.push('/portal/workouts')} className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
              📋
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm truncate">{activeProgram.name}</p>
              {activeProgram.end_date && (
                <p className="text-zinc-600 text-xs mt-0.5">
                  t/m {format(new Date(activeProgram.end_date), 'd MMM', { locale: nl })}
                </p>
              )}
            </div>
            <span className="text-orange-500 text-sm font-bold flex-shrink-0">Trainen →</span>
          </Card>
        )}

        {/* Last workout */}
        {lastWorkout && (
          <Card className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center text-xl">
              🏋️
            </div>
            <div>
              <p className="text-white text-sm font-semibold">Laatste workout</p>
              <p className="text-zinc-500 text-xs">
                {format(new Date(lastWorkout), 'EEEE d MMMM', { locale: nl })}
              </p>
            </div>
          </Card>
        )}

        {/* Weight logger */}
        <WeightLogger userId={profile?.id ?? ''} onSaved={handleWeightSaved} />

        {/* Weight chart */}
        {weightData.length > 0 && (
          <Card className="p-5">
            <p className="text-white font-bold text-sm mb-3">Gewichtsverloop</p>
            <WeightChart data={weightData} />
          </Card>
        )}

        {/* Quick links */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Workouts', icon: '🏋️', href: '/portal/workouts' },
            { label: 'Progress', icon: '📈', href: '/portal/progress' },
            { label: 'PRs', icon: '🏆', href: '/portal/records' },
            { label: 'Berichten', icon: '💬', href: '/portal/messages' },
          ].map(({ label, icon, href }) => (
            <button
              key={href}
              onClick={() => router.push(href)}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 flex flex-col items-center gap-1.5 active:opacity-80 transition"
              aria-label={label}
            >
              <span className="text-2xl">{icon}</span>
              <span className="text-zinc-400 text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>

      </div>
    </div>
  )
}
