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
import ReadinessCheckin from '@/components/dashboard/ReadinessCheckin'
import type { ProgressMetric } from '@/types'

export default function DashboardPage() {
  const { profile, userId, loading: authLoading } = useAuth({ requireOnboarding: true })
  const router = useRouter()
  const supabase = createClient()

  const [dataLoading, setDataLoading] = useState(true)
  const [weightData, setWeightData] = useState<ProgressMetric[]>([])
  const [todayHabits, setTodayHabits] = useState({ completed: 0, total: 0 })
  const [todayHabitsList, setTodayHabitsList] = useState<Array<{ id: string; name: string; icon: string | null; completed: boolean }>>(
    []
  )
  const [activeProgram, setActiveProgram] = useState<{ name: string; end_date: string | null; id: string } | null>(null)
  const [lastWorkout, setLastWorkout] = useState<string | null>(null)
  const [streak, setStreak] = useState(0)
  const [dailyHabitStreak, setDailyHabitStreak] = useState(0)
  const [readinessScore, setReadinessScore] = useState<number | null>(null)
  const [nextProgramDay, setNextProgramDay] = useState<{ day_number: number; name: string } | null>(null)

  const loadDashboardData = useCallback(async () => {
    if (!userId) return

    try {
      // Parallel data fetching — ~3x faster than sequential
      const [weights, habits, program, workoutLogs, habitsListData] = await Promise.all([
        progressService.getWeightHistory(userId),
        habitService.getTodayStats(userId),
        supabase
          .from('programs')
          .select('id, name, end_date')
          .eq('client_id', userId)
          .eq('is_active', true)
          .limit(1)
          .single()
          .then(({ data }) => data),
        progressService.getCompletedWorkouts(userId),
        // Fetch today's habits with completion status
        supabase
          .from('habits')
          .select('id, name, icon, habit_logs(completed)')
          .eq('client_id', userId)
          .eq('active', true)
          .then(async ({ data: habitsData, error }) => {
            if (error || !habitsData) return []
            const today = format(new Date(), 'yyyy-MM-dd')
            return habitsData.map(habit => {
              const log = (habit.habit_logs as any[])?.[0]
              return {
                id: habit.id,
                name: habit.name,
                icon: habit.icon,
                completed: log?.completed ?? false,
              }
            })
          }),
      ])

      setWeightData(weights)
      setTodayHabits(habits)
      setActiveProgram(program)
      setTodayHabitsList(habitsListData)

      // Fetch next unfinished day from active program
      if (program?.id) {
        const { data: days } = await supabase
          .from('program_days')
          .select('day_number, name')
          .eq('program_id', program.id)
          .eq('completed', false)
          .order('day_number', { ascending: true })
          .limit(1)
        if (days && days.length > 0) {
          setNextProgramDay(days[0])
        }
      }

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

      // Calculate daily habit streak (consecutive days with 100% habits completed)
      if (userId) {
        const { data: habitLogs, error: habitsError } = await supabase
          .from('habit_logs')
          .select('date, habit_id')
          .eq('client_id', userId)
          .eq('completed', true)
          .order('date', { ascending: false })

        if (!habitsError && habitLogs) {
          const { data: totalHabits } = await supabase
            .from('habits')
            .select('id')
            .eq('client_id', userId)
            .eq('active', true)

          const habitCount = totalHabits?.length ?? 0
          if (habitCount > 0) {
            // Group logs by date and count completed habits per day
            const habitsByDate = new Map<string, Set<string>>()
            habitLogs.forEach(log => {
              if (!habitsByDate.has(log.date)) {
                habitsByDate.set(log.date, new Set())
              }
              habitsByDate.get(log.date)!.add(log.habit_id)
            })

            // Find consecutive days with 100% completion
            let dailyStreak = 0
            let checkDate = new Date()
            checkDate.setHours(0, 0, 0, 0)

            while (true) {
              const dateStr = format(checkDate, 'yyyy-MM-dd')
              const completedCount = habitsByDate.get(dateStr)?.size ?? 0

              if (completedCount === habitCount) {
                dailyStreak++
                checkDate.setDate(checkDate.getDate() - 1)
              } else {
                break
              }
            }

            setDailyHabitStreak(dailyStreak)
          }
        }
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

  /** Toggle a habit's completion status */
  const toggleHabit = useCallback(
    async (habitId: string, currentCompleted: boolean) => {
      if (!userId) return

      try {
        const today = format(new Date(), 'yyyy-MM-dd')
        if (currentCompleted) {
          // Delete the log
          await supabase.from('habit_logs').delete().eq('habit_id', habitId).eq('date', today)
        } else {
          // Upsert a completed log
          await supabase.from('habit_logs').upsert(
            {
              habit_id: habitId,
              client_id: userId,
              date: today,
              completed: true,
            },
            { onConflict: 'habit_id, date' }
          )
        }

        // Update local state
        setTodayHabitsList(prev =>
          prev.map(h => (h.id === habitId ? { ...h, completed: !currentCompleted } : h))
        )
      } catch (error) {
        console.error('Error toggling habit:', error)
      }
    },
    [userId, supabase]
  )

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

        {/* Start training CTA */}
        {activeProgram && (
          <button
            onClick={() => router.push('/portal/workouts')}
            className="w-full bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-bold py-3 px-4 rounded-2xl transition flex items-center justify-between"
          >
            <div className="flex flex-col items-start">
              <span className="text-base">Start training →</span>
              {nextProgramDay && (
                <span className="text-xs text-orange-100 mt-0.5">Dag {nextProgramDay.day_number}: {nextProgramDay.name}</span>
              )}
            </div>
          </button>
        )}

        {/* Habits — single clickable card (same style as program/workout cards) */}
        {todayHabitsList.length > 0 && (
          <Card interactive onClick={() => router.push('/portal/habits')} className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
              habitPercent === 100 ? 'bg-green-500/20' : 'bg-orange-500/20'
            }`}>
              {habitPercent === 100 ? '✅' : '🎯'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm">Habits</p>
              <p className="text-zinc-500 text-xs mt-0.5">
                {todayHabits.completed}/{todayHabits.total} voltooid
                {dailyHabitStreak >= 3 && ` · 🔥 ${dailyHabitStreak} dagen op rij`}
              </p>
            </div>
            <span className="text-orange-500 text-sm font-bold flex-shrink-0">Bekijk →</span>
          </Card>
        )}

        {/* Daily Readiness Check-in */}
        <ReadinessCheckin userId={profile?.id ?? ''} onScoreUpdate={setReadinessScore} />

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
            { label: 'Trainingen', icon: '🏋️', href: '/portal/workouts' },
            { label: 'Voortgang', icon: '📈', href: '/portal/progress' },
            { label: 'Records', icon: '🏆', href: '/portal/records' },
            { label: 'Habits', icon: '✅', href: '/portal/habits' },
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
