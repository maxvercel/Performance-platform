/**
 * Skeleton loading components — replaces spinners for a premium feel.
 * Matches the app's dark theme with subtle pulse animation.
 */
'use client'

interface SkeletonProps {
  className?: string
}

/** Base skeleton element with pulse animation */
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`bg-zinc-800 animate-pulse rounded-xl ${className}`}
    />
  )
}

/** Pre-built skeleton for a typical stat card */
export function SkeletonCard() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-7 w-16" />
      <Skeleton className="h-2 w-full" />
    </div>
  )
}

/** Skeleton for a dashboard page layout */
export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      {/* Header skeleton */}
      <div className="bg-zinc-900 px-5 pt-12 pb-5 border-b border-zinc-800">
        <Skeleton className="h-3 w-32 mb-2" />
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="px-4 py-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </div>
  )
}

/** Skeleton for workout page */
export function WorkoutsSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      <div className="bg-zinc-900 px-5 pt-12 pb-4 border-b border-zinc-800">
        <Skeleton className="h-3 w-24 mb-2" />
        <Skeleton className="h-7 w-44" />
      </div>
      <div className="px-4 py-4 space-y-5">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-2.5 w-full" />
        </div>
        {[1, 2, 3].map(w => (
          <div key={w} className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map(d => (
                <Skeleton key={d} className="h-24 rounded-2xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Skeleton for habit page */
export function HabitsSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      <div className="bg-zinc-900 px-5 pt-12 pb-5 border-b border-zinc-800">
        <Skeleton className="h-3 w-28 mb-2" />
        <Skeleton className="h-7 w-24" />
      </div>
      <div className="px-4 py-5 space-y-4">
        <div className="flex gap-2">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-14 w-16 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-20 w-full rounded-2xl" />
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
