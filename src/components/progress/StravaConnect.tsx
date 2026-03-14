'use client'

import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { nl } from 'date-fns/locale'

interface StravaActivity {
  id: number
  name: string
  type: string
  sport_type: string
  distance_km: number | null
  duration_seconds: number | null
  elevation_gain: number | null
  avg_heart_rate: number | null
  max_heart_rate: number | null
  avg_speed_kmh: number | null
  calories: number | null
  start_date: string
}

interface StravaConnectProps {
  onImportActivity?: (activity: StravaActivity) => void
}

const ACTIVITY_ICONS: Record<string, string> = {
  Run: '🏃',
  Ride: '🚴',
  Swim: '🏊',
  Walk: '🚶',
  Hike: '🥾',
  WeightTraining: '🏋️',
  Yoga: '🧘',
  Crossfit: '🔥',
  Rowing: '🚣',
  default: '🏃',
}

export default function StravaConnect({ onImportActivity }: StravaConnectProps) {
  const [connected, setConnected] = useState(false)
  const [activities, setActivities] = useState<StravaActivity[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check URL params for Strava callback result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const stravaStatus = params.get('strava')

    if (stravaStatus === 'connected') {
      setConnected(true)
      fetchActivities()

      // Clean URL
      const url = new URL(window.location.href)
      url.searchParams.delete('strava')
      window.history.replaceState({}, '', url.toString())
    } else if (stravaStatus === 'error') {
      setError('Verbinding met Strava mislukt. Probeer opnieuw.')
      const url = new URL(window.location.href)
      url.searchParams.delete('strava')
      window.history.replaceState({}, '', url.toString())
    } else {
      // Try fetching activities — if cookie exists, we're connected
      checkConnection()
    }

    // Clean up old localStorage token (migration)
    localStorage.removeItem('strava_token')
  }, [])

  async function checkConnection() {
    try {
      const res = await fetch('/api/strava/activities')
      if (res.ok) {
        const data = await res.json()
        setActivities(data)
        setConnected(true)
      }
    } catch {
      // Silently fail — user is just not connected
    }
  }

  async function fetchActivities() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/strava/activities')
      if (res.ok) {
        const data = await res.json()
        setActivities(data)
      } else if (res.status === 401) {
        setConnected(false)
        setError('Strava sessie verlopen. Verbind opnieuw.')
      } else {
        setError('Kon activiteiten niet laden.')
      }
    } catch {
      setError('Netwerkfout bij laden van activiteiten.')
    }
    setLoading(false)
  }

  async function disconnect() {
    try {
      await fetch('/api/strava/disconnect', { method: 'POST' })
    } catch {
      // Best effort
    }
    setConnected(false)
    setActivities([])
  }

  function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}u ${m}m`
    return `${m}m ${s}s`
  }

  if (!connected) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FC4C02] rounded-xl flex items-center justify-center">
              <span className="text-white font-black text-sm">S</span>
            </div>
            <div>
              <p className="text-white font-bold text-sm">Strava</p>
              <p className="text-zinc-500 text-xs">Koppel je Strava account</p>
            </div>
          </div>
        </div>
        <p className="text-zinc-400 text-xs mb-3">
          Synchroniseer je runs, fietstochten en andere activiteiten automatisch vanuit Strava.
        </p>
        {error && (
          <p className="text-red-400 text-xs mb-3">{error}</p>
        )}
        <a
          href="/api/strava/connect"
          className="block w-full text-center bg-[#FC4C02] hover:bg-[#e0440a] text-white font-bold py-3 rounded-xl transition text-sm"
        >
          Verbind met Strava
        </a>
      </div>
    )
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#FC4C02] rounded-lg flex items-center justify-center">
            <span className="text-white font-black text-xs">S</span>
          </div>
          <div>
            <p className="text-white font-bold text-sm">Strava</p>
            <p className="text-green-400 text-xs">Verbonden</p>
          </div>
        </div>
        <button
          onClick={disconnect}
          className="text-zinc-600 hover:text-red-400 text-xs font-medium transition"
        >
          Ontkoppelen
        </button>
      </div>

      {activities.length > 0 && (
        <div className="grid grid-cols-3 gap-0 border-b border-zinc-800">
          <div className="p-3 text-center border-r border-zinc-800">
            <p className="text-white font-black text-lg">{activities.length}</p>
            <p className="text-zinc-500 text-xs">Activiteiten</p>
          </div>
          <div className="p-3 text-center border-r border-zinc-800">
            <p className="text-white font-black text-lg">
              {Math.round(activities.reduce((acc, a) => acc + (a.distance_km ?? 0), 0))}
            </p>
            <p className="text-zinc-500 text-xs">Totaal km</p>
          </div>
          <div className="p-3 text-center">
            <p className="text-white font-black text-lg">
              {Math.round(activities.reduce((acc, a) => acc + (a.calories ?? 0), 0))}
            </p>
            <p className="text-zinc-500 text-xs">Calorieën</p>
          </div>
        </div>
      )}

      {error && (
        <div className="px-4 py-3 bg-red-500/10 border-b border-red-500/20">
          <p className="text-red-400 text-xs">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center">
          <div className="w-6 h-6 border-2 border-[#FC4C02] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-zinc-500 text-xs">Activiteiten laden...</p>
        </div>
      ) : activities.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-zinc-500 text-sm">Nog geen activiteiten gevonden</p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-800 max-h-96 overflow-y-auto">
          {activities.slice(0, 15).map(activity => (
            <div key={activity.id} className="px-4 py-3 hover:bg-zinc-800/50 transition">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-zinc-800 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-lg">
                    {ACTIVITY_ICONS[activity.type] ?? ACTIVITY_ICONS.default}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-bold text-sm truncate">{activity.name}</p>
                    <span className="text-zinc-600 text-xs flex-shrink-0">{activity.type}</span>
                  </div>
                  <p className="text-zinc-500 text-xs">
                    {format(parseISO(activity.start_date), 'EEEE d MMMM, HH:mm', { locale: nl })}
                  </p>
                  <div className="flex gap-3 mt-1 flex-wrap">
                    {activity.distance_km != null && activity.distance_km > 0 && (
                      <span className="text-zinc-400 text-xs">{activity.distance_km} km</span>
                    )}
                    {activity.duration_seconds != null && (
                      <span className="text-zinc-400 text-xs">⏱ {formatDuration(activity.duration_seconds)}</span>
                    )}
                    {activity.avg_heart_rate != null && (
                      <span className="text-zinc-400 text-xs">❤️ {Math.round(activity.avg_heart_rate)} bpm</span>
                    )}
                    {activity.calories != null && activity.calories > 0 && (
                      <span className="text-zinc-400 text-xs">🔥 {activity.calories} kcal</span>
                    )}
                    {activity.elevation_gain != null && activity.elevation_gain > 0 && (
                      <span className="text-zinc-400 text-xs">⛰️ {Math.round(activity.elevation_gain)}m</span>
                    )}
                  </div>
                </div>
                {onImportActivity && (
                  <button
                    onClick={() => onImportActivity(activity)}
                    className="text-xs text-orange-400 font-bold bg-orange-500/10 px-2 py-1 rounded-lg
                               hover:bg-orange-500/20 transition flex-shrink-0"
                  >
                    Import
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
