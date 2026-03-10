'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { format, startOfWeek, parseISO } from 'date-fns'
import { nl } from 'date-fns/locale'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar
} from 'recharts'

function calc1RM(weight: number, reps: number) {
  if (reps === 1) return weight
  return Math.round(weight * (1 + reps / 30))
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}u ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatPace(secondsPerKm: number) {
  const m = Math.floor(secondsPerKm / 60)
  const s = Math.round(secondsPerKm % 60)
  return `${m}:${s.toString().padStart(2, '0')} /km`
}

export default function ProgressPage() {
  const supabase = createClient()
  const router = useRouter()

  const [profile, setProfile] = useState<any>(null)
  const [tab, setTab] = useState<'kracht' | 'cardio'>('kracht')
  const [loading, setLoading] = useState(true)

  // Kracht
  const [workoutHistory, setWorkoutHistory] = useState<any[]>([])
  const [exercises, setExercises] = useState<any[]>([])
  const [selectedExercise, setSelectedExercise] = useState<string>('')
  const [exerciseProgress, setExerciseProgress] = useState<any[]>([])
  const [weeklyFrequency, setWeeklyFrequency] = useState<any[]>([])

  // Cardio
  const [runs, setRuns] = useState<any[]>([])
  const [showRunForm, setShowRunForm] = useState(false)
  const [runForm, setRunForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    distance_km: '',
    duration_min: '',
    duration_sec: '',
    avg_heart_rate: '',
    notes: '',
    run_type: 'easy',
  })
  const [savingRun, setSavingRun] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/portal/login'); return }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(prof)
    await Promise.all([loadKrachtData(user.id), loadCardioData(user.id)])
    setLoading(false)
  }

  async function loadKrachtData(userId: string) {
    // Workout history via workout_logs
    const { data: logs } = await supabase
      .from('workout_logs')
      .select(`
        id, logged_at, feeling, completed_at,
        program_days(label),
        programs(name)
      `)
      .eq('client_id', userId)
      .not('completed_at', 'is', null)
      .order('logged_at', { ascending: false })
      .limit(30)

    if (!logs || logs.length === 0) {
      setWorkoutHistory([])
      setWeeklyFrequency([])
      setLoading(false)
      return
    }

    // Haal exercise_logs op voor deze workout_logs
    const logIds = logs.map((l: any) => l.id)
    const { data: exLogs } = await supabase
      .from('exercise_logs')
      .select('*, exercises(name, muscle_group)')
      .in('workout_log_id', logIds)

    // Koppel exercise_logs aan workout_logs
    const exLogsByWorkout: Record<string, any[]> = {}
    exLogs?.forEach((el: any) => {
      if (!exLogsByWorkout[el.workout_log_id]) exLogsByWorkout[el.workout_log_id] = []
      exLogsByWorkout[el.workout_log_id].push(el)
    })

    const enrichedLogs = logs.map((log: any) => ({
      ...log,
      exercise_logs: exLogsByWorkout[log.id] ?? [],
    }))
    setWorkoutHistory(enrichedLogs)

    // Frequentie per week
    const freqMap: Record<string, number> = {}
    logs.forEach((log: any) => {
      const weekStart = format(
        startOfWeek(parseISO(log.logged_at), { weekStartsOn: 1 }),
        'dd MMM', { locale: nl }
      )
      freqMap[weekStart] = (freqMap[weekStart] ?? 0) + 1
    })
    setWeeklyFrequency(Object.entries(freqMap).map(([week, count]) => ({ week, count })).reverse())

    // Unieke oefeningen met logs
    const seen = new Set()
    const uniqueEx: any[] = []
    exLogs?.forEach((el: any) => {
      if (el.exercises && !seen.has(el.exercise_id)) {
        seen.add(el.exercise_id)
        uniqueEx.push(el.exercises)
      }
    })
    setExercises(uniqueEx)
    if (uniqueEx.length > 0) {
      setSelectedExercise(uniqueEx[0].id)
      await loadExerciseProgress(logIds, uniqueEx[0].id)
    }
  }

  async function loadExerciseProgress(completedLogIds: string[], exerciseId: string) {
    const { data: logs } = await supabase
      .from('exercise_logs')
      .select('*, workout_logs(logged_at)')
      .in('workout_log_id', completedLogIds)
      .eq('exercise_id', exerciseId)
      .not('weight_kg', 'is', null)

    // Beste set per datum
    const byDate: Record<string, { weight: number, reps: number, date: string }> = {}
    logs?.forEach((log: any) => {
      if (!log.workout_logs?.logged_at) return
      const date = format(parseISO(log.workout_logs.logged_at), 'dd MMM', { locale: nl })
      const reps = log.reps_completed ?? 1
      const oneRM = calc1RM(log.weight_kg, reps)
      if (!byDate[date] || oneRM > calc1RM(byDate[date].weight, byDate[date].reps)) {
        byDate[date] = { weight: log.weight_kg, reps, date }
      }
    })

    setExerciseProgress(
      Object.values(byDate).map(d => ({
        date: d.date,
        gewicht: d.weight,
        '1RM': calc1RM(d.weight, d.reps),
      }))
    )
  }

  async function loadCardioData(userId: string) {
    const { data } = await supabase
      .from('cardio_logs')
      .select('*')
      .eq('client_id', userId)
      .order('logged_at', { ascending: false })
      .limit(50)
    setRuns(data ?? [])
  }

  async function saveRun() {
    if (!profile) return
    setSavingRun(true)
    const totalSeconds = (parseInt(runForm.duration_min) || 0) * 60 + (parseInt(runForm.duration_sec) || 0)
    await supabase.from('cardio_logs').insert({
      client_id: profile.id,
      logged_at: runForm.date,
      distance_km: parseFloat(runForm.distance_km) || null,
      duration_seconds: totalSeconds || null,
      avg_heart_rate: parseInt(runForm.avg_heart_rate) || null,
      notes: runForm.notes || null,
      activity_type: runForm.run_type,
    })
    setShowRunForm(false)
    setRunForm({ date: format(new Date(), 'yyyy-MM-dd'), distance_km: '', duration_min: '', duration_sec: '', avg_heart_rate: '', notes: '', run_type: 'easy' })
    await loadCardioData(profile.id)
    setSavingRun(false)
  }

  async function deleteRun(id: string) {
    await supabase.from('cardio_logs').delete().eq('id', id)
    setRuns(prev => prev.filter(r => r.id !== id))
  }

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const totalVolume = workoutHistory.reduce((acc, log) => {
    return acc + (log.exercise_logs?.reduce((a: number, el: any) =>
      a + ((el.weight_kg ?? 0) * (el.reps_completed ?? 0)), 0) ?? 0)
  }, 0)

  const bestRM = exerciseProgress.length > 0 ? Math.max(...exerciseProgress.map(e => e['1RM'])) : 0
  const totalRunKm = runs.reduce((acc, r) => acc + (r.distance_km ?? 0), 0)
  const paceRuns = runs.filter(r => r.distance_km && r.duration_seconds)
  const avgRunPace = paceRuns.length > 0
    ? paceRuns.reduce((acc, r) => acc + r.duration_seconds / r.distance_km, 0) / paceRuns.length
    : 0

  const runChartData = [...runs].reverse().map(r => ({
    datum: format(parseISO(r.logged_at), 'dd MMM', { locale: nl }),
    km: r.distance_km,
  }))

  return (
    <div className="min-h-screen bg-zinc-950 pb-28">

      <div className="bg-zinc-900 px-5 pt-12 pb-4 border-b border-zinc-800">
        <p className="text-orange-500 text-xs font-bold tracking-widest uppercase mb-1">Progress</p>
        <h1 className="text-white text-2xl font-black">Jouw voortgang</h1>
        <p className="text-zinc-500 text-xs mt-1">{format(new Date(), 'EEEE d MMMM yyyy', { locale: nl })}</p>
      </div>

      <div className="px-4 pt-4">
        <div className="flex bg-zinc-900 rounded-2xl p-1 border border-zinc-800">
          <button onClick={() => setTab('kracht')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${tab === 'kracht' ? 'bg-orange-500 text-white' : 'text-zinc-400'}`}>
            💪 Kracht
          </button>
          <button onClick={() => setTab('cardio')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${tab === 'cardio' ? 'bg-orange-500 text-white' : 'text-zinc-400'}`}>
            🏃 Cardio
          </button>
        </div>
      </div>

      {/* ===== KRACHT ===== */}
      {tab === 'kracht' && (
        <div className="px-4 py-4 space-y-4">

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <p className="text-zinc-500 text-xs mb-1">Workouts (30 dgn)</p>
              <p className="text-white text-3xl font-black">{workoutHistory.length}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <p className="text-zinc-500 text-xs mb-1">Totaal volume</p>
              <p className="text-white text-3xl font-black">
                {totalVolume >= 1000 ? `${Math.round(totalVolume / 1000)}k` : Math.round(totalVolume)}
                <span className="text-zinc-500 text-sm font-normal"> kg</span>
              </p>
            </div>
          </div>

          {weeklyFrequency.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <p className="text-white font-bold mb-1 text-sm">Workout frequentie</p>
              <p className="text-zinc-500 text-xs mb-3">Workouts per week</p>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={weeklyFrequency} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="week" tick={{ fill: '#71717a', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                    labelStyle={{ color: '#fff' }}
                    itemStyle={{ color: '#f97316' }}
                    formatter={(v: any) => [`${v} workouts`, '']}
                  />
                  <Bar dataKey="count" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {exercises.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <p className="text-white font-bold mb-1 text-sm">Progressie per oefening</p>
              <select
                value={selectedExercise}
                onChange={async e => {
                  setSelectedExercise(e.target.value)
                  const logIds = workoutHistory.map(l => l.id)
                  await loadExerciseProgress(logIds, e.target.value)
                }}
                className="w-full bg-zinc-800 text-white text-sm rounded-xl px-3 py-2 mb-3
                           focus:outline-none focus:ring-1 focus:ring-orange-500 border border-zinc-700"
              >
                {exercises.map(ex => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
              </select>

              {exerciseProgress.length > 1 ? (
                <>
                  {bestRM > 0 && (
                    <div className="flex items-center gap-2 mb-3 bg-yellow-500/10 rounded-xl px-3 py-2">
                      <span>🏆</span>
                      <span className="text-yellow-400 text-sm font-bold">Beste 1RM schatting: {bestRM} kg</span>
                    </div>
                  )}
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={exerciseProgress} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#71717a', fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                        labelStyle={{ color: '#fff' }}
                        formatter={(v: any, name: string) => [`${v} kg`, name]}
                      />
                      <Line type="monotone" dataKey="gewicht" stroke="#f97316" strokeWidth={2} dot={{ fill: '#f97316', r: 3 }} name="Gewicht" />
                      <Line type="monotone" dataKey="1RM" stroke="#facc15" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: '#facc15', r: 3 }} name="1RM schatting" />
                    </LineChart>
                  </ResponsiveContainer>
                  <p className="text-zinc-600 text-xs mt-2 text-center">Oranje = gewicht · Geel gestippeld = 1RM (Epley)</p>
                </>
              ) : (
                <p className="text-zinc-500 text-sm text-center py-4">Nog niet genoeg data — log meer workouts 💪</p>
              )}
            </div>
          )}

          {/* Workout history */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800">
              <p className="text-white font-bold text-sm">Workout geschiedenis</p>
              <p className="text-zinc-500 text-xs">Laatste 30 workouts</p>
            </div>
            {workoutHistory.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-4xl mb-2">🏋️</p>
                <p className="text-zinc-500 text-sm">Nog geen workouts afgerond</p>
                <p className="text-zinc-600 text-xs mt-1">Rond een workout af om hier data te zien</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {workoutHistory.map(log => {
                  const setsCount = log.exercise_logs?.length ?? 0
                  const volume = log.exercise_logs?.reduce((a: number, el: any) =>
                    a + ((el.weight_kg ?? 0) * (el.reps_completed ?? 0)), 0) ?? 0
                  const muscleGroups = [...new Set(
                    log.exercise_logs?.map((el: any) => el.exercises?.muscle_group).filter(Boolean)
                  )] as string[]
                  const feelingEmoji = ['', '😫', '😕', '😊', '💪', '🔥'][log.feeling ?? 3]

                  return (
                    <div key={log.id} className="px-4 py-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-white font-bold text-sm">
                              {log.program_days?.label ?? 'Workout'}
                            </p>
                            {log.feeling && <span className="text-base">{feelingEmoji}</span>}
                          </div>
                          <p className="text-zinc-500 text-xs mt-0.5">
                            {format(parseISO(log.logged_at), 'EEEE d MMMM', { locale: nl })}
                          </p>
                          <div className="flex gap-3 mt-1.5">
                            <span className="text-zinc-400 text-xs">{setsCount} sets</span>
                            {volume > 0 && (
                              <span className="text-zinc-400 text-xs">
                                {volume >= 1000 ? `${Math.round(volume / 1000)}k` : Math.round(volume)} kg volume
                              </span>
                            )}
                          </div>
                          {muscleGroups.length > 0 && (
                            <div className="flex gap-1 mt-1.5 flex-wrap">
                              {muscleGroups.slice(0, 3).map((mg: string) => (
                                <span key={mg} className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">{mg}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <p className="text-zinc-600 text-xs ml-3 flex-shrink-0">{log.programs?.name}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== CARDIO ===== */}
      {tab === 'cardio' && (
        <div className="px-4 py-4 space-y-4">

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-center">
              <p className="text-zinc-500 text-xs mb-1">Runs</p>
              <p className="text-white text-2xl font-black">{runs.length}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-center">
              <p className="text-zinc-500 text-xs mb-1">Totaal km</p>
              <p className="text-white text-2xl font-black">{Math.round(totalRunKm)}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-center">
              <p className="text-zinc-500 text-xs mb-1">Gem. tempo</p>
              <p className="text-white text-lg font-black">
                {avgRunPace > 0 ? formatPace(avgRunPace) : '-'}
              </p>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-white font-bold text-sm">Koppelingen</p>
              <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-bold">Binnenkort</span>
            </div>
            <div className="flex gap-3">
              <div className="flex-1 bg-zinc-800/60 rounded-xl p-3 flex items-center gap-2 opacity-50">
                <div className="w-8 h-8 bg-[#FC4C02] rounded-lg flex items-center justify-center">
                  <span className="text-white font-black text-xs">S</span>
                </div>
                <div>
                  <p className="text-white text-xs font-bold">Strava</p>
                  <p className="text-zinc-500 text-xs">Sync activiteiten</p>
                </div>
              </div>
              <div className="flex-1 bg-zinc-800/60 rounded-xl p-3 flex items-center gap-2 opacity-50">
                <div className="w-8 h-8 bg-[#007DC5] rounded-lg flex items-center justify-center">
                  <span className="text-white font-black text-xs">G</span>
                </div>
                <div>
                  <p className="text-white text-xs font-bold">Garmin</p>
                  <p className="text-zinc-500 text-xs">Sync activiteiten</p>
                </div>
              </div>
            </div>
          </div>

          {runChartData.length > 1 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <p className="text-white font-bold mb-3 text-sm">Afstand per run</p>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={runChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="datum" tick={{ fill: '#71717a', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 10 }} unit="km" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                    labelStyle={{ color: '#fff' }}
                    formatter={(v: any) => [`${v} km`, 'Afstand']}
                  />
                  <Bar dataKey="km" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <button onClick={() => setShowRunForm(true)}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-4 rounded-2xl text-base transition">
            + Run toevoegen
          </button>

          {showRunForm && (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center">
              <div className="bg-zinc-900 rounded-t-3xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                  <h2 className="text-white font-black text-xl">Run toevoegen</h2>
                  <button onClick={() => setShowRunForm(false)} className="text-zinc-400 text-2xl leading-none">×</button>
                </div>

                <div>
                  <label className="text-zinc-400 text-xs font-bold block mb-2">Type</label>
                  <div className="flex gap-2">
                    {[
                      { val: 'easy', label: '🐢 Easy' },
                      { val: 'tempo', label: '⚡ Tempo' },
                      { val: 'interval', label: '🔥 Interval' },
                      { val: 'long', label: '🏃 Long' },
                    ].map(t => (
                      <button key={t.val} onClick={() => setRunForm(p => ({ ...p, run_type: t.val }))}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                          runForm.run_type === t.val ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-400'
                        }`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-zinc-400 text-xs font-bold block mb-2">Datum</label>
                  <input type="date" value={runForm.date}
                    onChange={e => setRunForm(p => ({ ...p, date: e.target.value }))}
                    className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 border border-zinc-700" />
                </div>

                <div>
                  <label className="text-zinc-400 text-xs font-bold block mb-2">Afstand (km)</label>
                  <input type="number" step="0.01" placeholder="5.0" value={runForm.distance_km}
                    onChange={e => setRunForm(p => ({ ...p, distance_km: e.target.value }))}
                    className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 border border-zinc-700" />
                </div>

                <div>
                  <label className="text-zinc-400 text-xs font-bold block mb-2">Tijd</label>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <input type="number" placeholder="25" value={runForm.duration_min}
                        onChange={e => setRunForm(p => ({ ...p, duration_min: e.target.value }))}
                        className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 border border-zinc-700" />
                      <p className="text-zinc-500 text-xs mt-1 text-center">minuten</p>
                    </div>
                    <div className="flex-1">
                      <input type="number" placeholder="30" value={runForm.duration_sec}
                        onChange={e => setRunForm(p => ({ ...p, duration_sec: e.target.value }))}
                        className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 border border-zinc-700" />
                      <p className="text-zinc-500 text-xs mt-1 text-center">seconden</p>
                    </div>
                  </div>
                  {runForm.distance_km && (runForm.duration_min || runForm.duration_sec) && (
                    <p className="text-orange-400 text-xs mt-2 text-center font-bold">
                      Tempo: {formatPace(
                        ((parseInt(runForm.duration_min) || 0) * 60 + (parseInt(runForm.duration_sec) || 0)) /
                        parseFloat(runForm.distance_km)
                      )}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-zinc-400 text-xs font-bold block mb-2">Gem. hartslag (optioneel)</label>
                  <input type="number" placeholder="155" value={runForm.avg_heart_rate}
                    onChange={e => setRunForm(p => ({ ...p, avg_heart_rate: e.target.value }))}
                    className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 border border-zinc-700" />
                </div>

                <div>
                  <label className="text-zinc-400 text-xs font-bold block mb-2">Notities (optioneel)</label>
                  <textarea placeholder="Hoe voelde het?" value={runForm.notes}
                    onChange={e => setRunForm(p => ({ ...p, notes: e.target.value }))}
                    rows={2}
                    className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 border border-zinc-700 resize-none" />
                </div>

                <button onClick={saveRun} disabled={savingRun || !runForm.distance_km}
                  className="w-full bg-orange-500 text-white font-black py-4 rounded-2xl text-lg disabled:opacity-50 transition">
                  {savingRun ? 'Opslaan...' : '💾 Opslaan'}
                </button>
              </div>
            </div>
          )}

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800">
              <p className="text-white font-bold text-sm">Run geschiedenis</p>
            </div>
            {runs.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <div className="text-4xl mb-2">🏃</div>
                <p className="text-zinc-500 text-sm">Nog geen runs gelogd</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {runs.map(run => {
                  const typeEmoji: Record<string, string> = { easy: '🐢', tempo: '⚡', interval: '🔥', long: '🏃' }
                  const typeLabel: Record<string, string> = { easy: 'Easy run', tempo: 'Tempo', interval: 'Interval', long: 'Long run' }
                  return (
                    <div key={run.id} className="px-4 py-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center flex-shrink-0">
                            <span className="text-xl">{typeEmoji[run.activity_type] ?? '🏃'}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-white font-bold text-sm">
                                {run.distance_km ? `${run.distance_km} km` : typeLabel[run.activity_type]}
                              </p>
                              <span className="text-xs text-zinc-500">{typeLabel[run.activity_type]}</span>
                            </div>
                            <p className="text-zinc-500 text-xs mt-0.5">
                              {format(parseISO(run.logged_at), 'EEEE d MMMM', { locale: nl })}
                            </p>
                            <div className="flex gap-3 mt-1">
                              {run.duration_seconds && (
                                <span className="text-zinc-400 text-xs">⏱ {formatDuration(run.duration_seconds)}</span>
                              )}
                              {run.distance_km && run.duration_seconds && (
                                <span className="text-zinc-400 text-xs">
                                  🏎 {formatPace(run.duration_seconds / run.distance_km)}
                                </span>
                              )}
                              {run.avg_heart_rate && (
                                <span className="text-zinc-400 text-xs">❤️ {run.avg_heart_rate} bpm</span>
                              )}
                            </div>
                            {run.notes && <p className="text-zinc-500 text-xs mt-1 italic">{run.notes}</p>}
                          </div>
                        </div>
                        <button onClick={() => deleteRun(run.id)}
                          className="text-zinc-700 hover:text-red-400 text-lg transition ml-2">×</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}