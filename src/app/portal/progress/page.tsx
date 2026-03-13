'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  format, startOfWeek, parseISO, addMonths, subMonths,
} from 'date-fns'
import { nl } from 'date-fns/locale'
import {
  ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip,
} from 'recharts'
import { useAuth } from '@/hooks/useAuth'
import { PageSpinner } from '@/components/ui/Spinner'
import { PageHeader } from '@/components/ui/PageHeader'
import { calc1RM, formatVolume, formatDuration, formatPace } from '@/utils/calculations'
import {
  WorkoutCalendar,
  MuscleVolumeChart,
  ExerciseProgressChart,
  WorkoutHistory,
  RunFormModal,
} from '@/components/progress'
import ProgressPhotos from '@/components/progress/ProgressPhotos'
import StravaConnect from '@/components/progress/StravaConnect'
import { BodyMap } from '@/components/ui/BodyMap'

import type { WorkoutLog, ExerciseLog } from '@/types'
import { compressImage } from '@/utils/imageCompression'
import { selectInChunks } from '@/lib/supabase/queryHelpers'

type Tab = 'kracht' | 'cardio' | 'programmas' | 'fotos'

interface EnrichedWorkoutLog extends WorkoutLog {
  exercise_logs: ExerciseLog[]
}

interface ProgramSummary {
  id: string
  name: string
  goal: string
  start_date: string
  is_active: boolean
  program_weeks: { id: string }[]
  numWeeks: number
  completedWorkouts: number
}

interface CardioLog {
  id: string
  client_id: string
  logged_at: string
  distance_km: number | null
  duration_seconds: number | null
  avg_heart_rate: number | null
  notes: string | null
  activity_type: string
}

interface ProgressPhoto {
  id: string
  client_id: string
  photo_url: string
  category: 'front' | 'side' | 'back'
  taken_at: string
  notes: string | null
}

interface ExerciseOption {
  id: string
  name: string
  muscle_group: string
}

interface ExerciseProgressPoint {
  date: string
  gewicht: number
  '1RM': number
  volume: number
  isPR: boolean
}

const DEFAULT_RUN_FORM = {
  date: format(new Date(), 'yyyy-MM-dd'),
  distance_km: '',
  duration_min: '',
  duration_sec: '',
  avg_heart_rate: '',
  notes: '',
  run_type: 'easy',
}

export default function ProgressPage() {
  const supabase = createClient()
  const { profile, loading: authLoading } = useAuth()

  const [tab, setTab] = useState<Tab>('kracht')
  const [loading, setLoading] = useState(true)
  const [calendarMonth, setCalendarMonth] = useState(new Date())

  // Programs
  const [allPrograms, setAllPrograms] = useState<ProgramSummary[]>([])

  // Kracht
  const [workoutHistory, setWorkoutHistory] = useState<EnrichedWorkoutLog[]>([])
  const [exercises, setExercises] = useState<ExerciseOption[]>([])
  const [selectedExercise, setSelectedExercise] = useState<string>('')
  const [exerciseProgress, setExerciseProgress] = useState<ExerciseProgressPoint[]>([])
  const [weeklyFrequency, setWeeklyFrequency] = useState<{ week: string; count: number }[]>([])
  const [muscleVolume, setMuscleVolume] = useState<{ name: string; volume: number }[]>([])

  // Cardio
  const [runs, setRuns] = useState<CardioLog[]>([])
  const [showRunForm, setShowRunForm] = useState(false)
  const [runForm, setRunForm] = useState(DEFAULT_RUN_FORM)
  const [savingRun, setSavingRun] = useState(false)

  // Photos
  const [photos, setPhotos] = useState<ProgressPhoto[]>([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  /* ─── Data loading ─── */

  useEffect(() => {
    if (authLoading || !profile) return
    loadAll()
  }, [authLoading, profile?.id])

  async function loadAll() {
    if (!profile) return
    await Promise.all([
      loadKrachtData(profile.id),
      loadCardioData(profile.id),
      loadPrograms(profile.id),
      loadPhotos(profile.id),
    ])
    setLoading(false)
  }

  async function loadKrachtData(userId: string) {
    const { data: logs } = await supabase
      .from('workout_logs')
      .select('id, logged_at, feeling, completed_at, program_days(label), programs(name)')
      .eq('client_id', userId)
      .not('completed_at', 'is', null)
      .order('logged_at', { ascending: false })
      .limit(30)

    if (!logs || logs.length === 0) {
      setWorkoutHistory([])
      setWeeklyFrequency([])
      return
    }

    const logIds = logs.map(l => l.id)
    const { data: exLogs, error: exError } = await supabase
      .from('exercise_logs')
      .select('id, workout_log_id, exercise_id, set_number, weight_kg, reps_completed, exercises(name, muscle_group)')
      .in('workout_log_id', logIds)

    if (exError) console.error('Exercise logs fetch error:', exError)

    // Enrich logs with exercise data
    const exLogsByWorkout: Record<string, ExerciseLog[]> = {}
    exLogs?.forEach(el => {
      if (!exLogsByWorkout[el.workout_log_id]) exLogsByWorkout[el.workout_log_id] = []
      exLogsByWorkout[el.workout_log_id].push(el as unknown as ExerciseLog)
    })
    setWorkoutHistory(logs.map(log => ({ ...(log as unknown as WorkoutLog), exercise_logs: exLogsByWorkout[log.id] ?? [] })))

    // Weekly frequency
    const freqMap: Record<string, number> = {}
    logs.forEach(log => {
      const weekStart = format(startOfWeek(parseISO(log.logged_at), { weekStartsOn: 1 }), 'dd MMM', { locale: nl })
      freqMap[weekStart] = (freqMap[weekStart] ?? 0) + 1
    })
    setWeeklyFrequency(Object.entries(freqMap).map(([week, count]) => ({ week, count })).reverse())

    // Volume per muscle group
    const muscleVolumeMap: Record<string, number> = {}
    exLogs?.forEach(el => {
      const ex = el.exercises as unknown as { name: string; muscle_group: string } | null
      const mg = ex?.muscle_group
      if (mg) muscleVolumeMap[mg] = (muscleVolumeMap[mg] ?? 0) + (el.weight_kg ?? 0) * (el.reps_completed ?? 0)
    })
    setMuscleVolume(
      Object.entries(muscleVolumeMap)
        .map(([name, volume]) => ({ name, volume: Math.round(volume) }))
        .sort((a, b) => b.volume - a.volume)
    )

    // Unique exercises
    const seen = new Set<string>()
    const uniqueEx: ExerciseOption[] = []
    exLogs?.forEach(el => {
      const ex = el.exercises as unknown as { name: string; muscle_group: string } | null
      if (ex && !seen.has(el.exercise_id)) {
        seen.add(el.exercise_id)
        uniqueEx.push({ id: el.exercise_id, name: ex.name, muscle_group: ex.muscle_group })
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

    const byDate: Record<string, { weight: number; reps: number; date: string; volume: number; rawDate: string }> = {}
    logs?.forEach(log => {
      const wl = log.workout_logs as { logged_at: string } | null
      if (!wl?.logged_at) return
      const rawDate = wl.logged_at
      const date = format(parseISO(rawDate), 'dd MMM', { locale: nl })
      const reps = log.reps_completed ?? 1
      const oneRM = calc1RM(log.weight_kg, reps)
      const vol = log.weight_kg * reps

      if (!byDate[date] || oneRM > calc1RM(byDate[date].weight, byDate[date].reps)) {
        byDate[date] = { weight: log.weight_kg, reps, date, volume: vol, rawDate }
      }
    })

    const sorted = Object.values(byDate).sort((a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime())
    let maxRM = 0
    setExerciseProgress(
      sorted.map(d => {
        const rm = calc1RM(d.weight, d.reps)
        const isPR = rm > maxRM
        if (isPR) maxRM = rm
        return { date: d.date, gewicht: d.weight, '1RM': rm, volume: d.volume, isPR }
      })
    )
  }

  async function loadPrograms(userId: string) {
    const { data: programs } = await supabase
      .from('programs')
      .select('id, name, goal, start_date, is_active, program_weeks(id)')
      .eq('client_id', userId)
      .order('start_date', { ascending: false })

    if (!programs) return

    const programIds = programs.map(p => p.id)
    const workoutLogs = await selectInChunks<{ program_id: string; completed_at: string }>(
      supabase, 'workout_logs', 'program_id, completed_at', 'program_id', programIds,
      (q) => q.not('completed_at', 'is', null)
    )

    const workoutCountMap: Record<string, number> = {}
    workoutLogs.forEach(log => {
      workoutCountMap[log.program_id] = (workoutCountMap[log.program_id] ?? 0) + 1
    })

    setAllPrograms(
      programs.map(p => ({
        ...p,
        program_weeks: (p.program_weeks ?? []) as { id: string }[],
        numWeeks: (p.program_weeks as { id: string }[] | null)?.length ?? 0,
        completedWorkouts: workoutCountMap[p.id] ?? 0,
      })) as ProgramSummary[]
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

  /* ─── Cardio actions ─── */

  async function saveRun() {
    if (!profile) return

    // Validate inputs
    const distance = parseFloat(runForm.distance_km)
    const durationMin = parseInt(runForm.duration_min) || 0
    const durationSec = parseInt(runForm.duration_sec) || 0
    const heartRate = parseInt(runForm.avg_heart_rate) || 0

    if (!runForm.date) { alert('Vul een datum in.'); return }
    if (isNaN(distance) || distance <= 0 || distance > 200) { alert('Vul een geldige afstand in (0-200 km).'); return }
    if (durationMin < 0 || durationSec < 0) { alert('Duur mag niet negatief zijn.'); return }
    if (durationMin === 0 && durationSec === 0) { alert('Vul een duur in.'); return }
    if (heartRate && (heartRate < 30 || heartRate > 250)) { alert('Hartslag moet tussen 30-250 bpm zijn.'); return }

    setSavingRun(true)
    const totalSeconds = durationMin * 60 + durationSec
    await supabase.from('cardio_logs').insert({
      client_id: profile.id,
      logged_at: runForm.date,
      distance_km: distance,
      duration_seconds: totalSeconds,
      avg_heart_rate: heartRate || null,
      notes: runForm.notes || null,
      activity_type: runForm.run_type,
    })
    setShowRunForm(false)
    setRunForm(DEFAULT_RUN_FORM)
    await loadCardioData(profile.id)
    setSavingRun(false)
  }

  async function deleteRun(id: string) {
    if (!confirm('Weet je zeker dat je deze activiteit wilt verwijderen?')) return
    await supabase.from('cardio_logs').delete().eq('id', id)
    setRuns(prev => prev.filter(r => r.id !== id))
  }

  /* ─── Photos ─── */

  async function loadPhotos(userId: string) {
    const { data } = await supabase
      .from('progress_photos')
      .select('*')
      .eq('client_id', userId)
      .order('taken_at', { ascending: false })
      .limit(50)
    setPhotos(data ?? [])
  }

  async function uploadPhoto(file: File, category: 'front' | 'side' | 'back', notes: string) {
    if (!profile) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Alleen afbeeldingen (JPG, PNG, WebP) zijn toegestaan.')
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      throw new Error('Bestand is te groot. Maximaal 10 MB.')
    }

    // Validate total photo count (max 50)
    if (photos.length >= 50) {
      throw new Error('Maximaal 50 foto\'s. Verwijder eerst een oude foto.')
    }

    setUploadingPhoto(true)

    // Compress image client-side (saves ~60-80% storage)
    const compressed = await compressImage(file)

    const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'heic']
    const ext = compressed.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const safeExt = allowedExts.includes(ext) ? ext : 'jpg'
    const fileName = `${profile.id}/${Date.now()}.${safeExt}`

    const { data: uploaded, error: uploadErr } = await supabase.storage
      .from('progress-photos')
      .upload(fileName, compressed)

    if (uploadErr) {
      setUploadingPhoto(false)
      throw new Error('Upload mislukt: ' + uploadErr.message)
    }

    const { data: urlData } = supabase.storage
      .from('progress-photos')
      .getPublicUrl(fileName)

    await supabase.from('progress_photos').insert({
      client_id: profile.id,
      photo_url: urlData.publicUrl,
      category,
      taken_at: new Date().toISOString(),
      notes: notes || null,
    })

    await loadPhotos(profile.id)
    setUploadingPhoto(false)
  }

  async function deletePhoto(id: string) {
    if (!confirm('Weet je zeker dat je deze foto wilt verwijderen?')) return
    await supabase.from('progress_photos').delete().eq('id', id)
    setPhotos(prev => prev.filter(p => p.id !== id))
  }

  /* ─── Computed values ─── */

  const totalVolume = workoutHistory.reduce(
    (acc, log) =>
      acc + (log.exercise_logs?.reduce((a: number, el) => a + (el.weight_kg ?? 0) * (el.reps_completed ?? 0), 0) ?? 0),
    0
  )
  const totalRunKm = runs.reduce((acc, r) => acc + (r.distance_km ?? 0), 0)
  const paceRuns = runs.filter(r => r.distance_km && r.duration_seconds)
  const avgRunPace =
    paceRuns.length > 0
      ? paceRuns.reduce((acc, r) => acc + (r.duration_seconds ?? 0) / (r.distance_km ?? 1), 0) / paceRuns.length
      : 0
  const runChartData = [...runs].reverse().map(r => ({
    datum: format(parseISO(r.logged_at), 'dd MMM', { locale: nl }),
    km: r.distance_km,
  }))

  /* ─── Render ─── */

  if (authLoading || loading) return <PageSpinner />

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      <PageHeader label="Voortgang" title="Jouw voortgang" subtitle={format(new Date(), 'EEEE d MMMM yyyy', { locale: nl })} />

      {/* Tab switcher */}
      <div className="px-4 pt-4">
        <div className="flex bg-zinc-900 rounded-2xl p-1 border border-zinc-800" role="tablist">
          {([
            { key: 'kracht', label: '💪 Kracht' },
            { key: 'cardio', label: '🏃 Cardio' },
            { key: 'fotos', label: '📸 Foto\'s' },
            { key: 'programmas', label: "📋 Programma's" },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              role="tab"
              aria-selected={tab === t.key}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${
                tab === t.key ? 'bg-orange-500 text-white' : 'text-zinc-400'
              }`}
            >
              {t.label}
            </button>
          ))}
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
                {formatVolume(totalVolume)}
                <span className="text-zinc-500 text-sm font-normal"> kg</span>
              </p>
            </div>
          </div>

          <WorkoutCalendar
            workoutHistory={workoutHistory}
            month={calendarMonth}
            onPrevMonth={() => setCalendarMonth(subMonths(calendarMonth, 1))}
            onNextMonth={() => setCalendarMonth(addMonths(calendarMonth, 1))}
          />

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
                    formatter={(v) => [`${v} workouts`, '']}
                  />
                  <Bar dataKey="count" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <MuscleVolumeChart data={muscleVolume} />

          {/* Body Map Visualization */}
          {muscleVolume.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <p className="text-white font-bold mb-1 text-sm">Spiergroep overzicht</p>
              <p className="text-zinc-500 text-xs mb-4">Getrainde spiergroepen — intensiteit op basis van volume</p>
              <div className="flex items-center justify-center gap-6">
                <BodyMap
                  highlightedMuscles={muscleVolume.map(m => m.name)}
                  volumeData={Object.fromEntries(muscleVolume.map(m => [m.name, m.volume]))}
                  size="md"
                />
                <div className="space-y-2">
                  {muscleVolume.slice(0, 5).map(({ name, volume }) => (
                    <div key={name} className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${
                        name === 'Borst' ? 'bg-blue-500' :
                        name === 'Rug' ? 'bg-purple-500' :
                        name === 'Benen' ? 'bg-red-500' :
                        name === 'Schouders' ? 'bg-yellow-500' :
                        name === 'Armen' ? 'bg-orange-500' :
                        name === 'Core' ? 'bg-green-500' :
                        name === 'Billen' ? 'bg-pink-500' : 'bg-zinc-500'
                      }`} />
                      <span className="text-zinc-300 text-xs font-medium">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <ExerciseProgressChart
            exercises={exercises}
            selectedExercise={selectedExercise}
            exerciseProgress={exerciseProgress}
            onExerciseChange={async (id) => {
              setSelectedExercise(id)
              await loadExerciseProgress(workoutHistory.map(l => l.id), id)
            }}
          />

          <WorkoutHistory workoutHistory={workoutHistory} />
        </div>
      )}

      {/* ===== PROGRAMMA'S ===== */}
      {tab === 'programmas' && (
        <div className="px-4 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <p className="text-zinc-500 text-xs mb-1">Totaal programma&apos;s</p>
              <p className="text-white text-3xl font-black">{allPrograms.length}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <p className="text-zinc-500 text-xs mb-1">Totaal workouts</p>
              <p className="text-white text-3xl font-black">
                {allPrograms.reduce((acc, p) => acc + p.completedWorkouts, 0)}
              </p>
            </div>
          </div>

          {allPrograms.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-zinc-500 text-sm">Nog geen programma&apos;s gedaan</p>
            </div>
          ) : (
            <div className="space-y-3">
              {allPrograms.map(prog => {
                const goalEmoji: Record<string, string> = {
                  strength: '💪', hypertrophy: '🏋️', fat_loss: '🔥', athletic: '⚡',
                }
                const goalLabel: Record<string, string> = {
                  strength: 'Kracht', hypertrophy: 'Spiermassa', fat_loss: 'Vetverlies', athletic: 'Atletisch',
                }
                const totalProgramDays = prog.numWeeks * 3
                const pct = totalProgramDays > 0
                  ? Math.min(100, Math.round((prog.completedWorkouts / totalProgramDays) * 100))
                  : 0

                return (
                  <div
                    key={prog.id}
                    className={`bg-zinc-900 border rounded-2xl p-4 ${
                      prog.is_active ? 'border-orange-500/40' : 'border-zinc-800'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-white font-bold">{prog.name}</p>
                          {prog.is_active && (
                            <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-bold">
                              Actief
                            </span>
                          )}
                        </div>
                        <p className="text-zinc-500 text-xs mt-0.5">
                          Gestart:{' '}
                          {prog.start_date
                            ? format(parseISO(prog.start_date), 'd MMMM yyyy', { locale: nl })
                            : '–'}
                        </p>
                      </div>
                      <span className="text-2xl ml-2">{goalEmoji[prog.goal] ?? '📋'}</span>
                    </div>
                    <div className="flex gap-3 flex-wrap mt-2">
                      <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded-lg">
                        {goalLabel[prog.goal] ?? prog.goal}
                      </span>
                      <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded-lg">
                        {prog.numWeeks} {prog.numWeeks === 1 ? 'week' : 'weken'}
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded-lg ${
                          prog.completedWorkouts > 0
                            ? 'bg-green-500/15 text-green-400'
                            : 'bg-zinc-800 text-zinc-500'
                        }`}
                      >
                        ✓ {prog.completedWorkouts} workouts gedaan
                      </span>
                    </div>
                    {prog.completedWorkouts > 0 && (
                      <div className="mt-3">
                        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-orange-500 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== FOTO'S ===== */}
      {tab === 'fotos' && (
        <div className="px-4 py-4">
          <ProgressPhotos
            photos={photos}
            onUpload={uploadPhoto}
            onDelete={deletePhoto}
            uploading={uploadingPhoto}
          />
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

          {/* Strava Integration */}
          <StravaConnect />

          {/* Garmin - coming soon */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#007DC5] rounded-xl flex items-center justify-center opacity-50">
                <span className="text-white font-black text-sm">G</span>
              </div>
              <div className="flex-1">
                <p className="text-white font-bold text-sm">Garmin Connect</p>
                <p className="text-zinc-500 text-xs">Binnenkort beschikbaar</p>
              </div>
              <span className="text-xs bg-zinc-800 text-zinc-500 px-2 py-1 rounded-lg">Binnenkort</span>
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
                    formatter={(v) => [`${v} km`, 'Afstand']}
                  />
                  <Bar dataKey="km" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <button
            onClick={() => setShowRunForm(true)}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-4 rounded-2xl text-base transition"
          >
            + Run toevoegen
          </button>

          {showRunForm && (
            <RunFormModal
              form={runForm}
              saving={savingRun}
              onChange={updates => setRunForm(prev => ({ ...prev, ...updates }))}
              onSave={saveRun}
              onClose={() => setShowRunForm(false)}
            />
          )}

          {/* Run history */}
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
                  const typeEmoji: Record<string, string> = {
                    easy: '🐢', tempo: '⚡', interval: '🔥', long: '🏃',
                  }
                  const typeLabel: Record<string, string> = {
                    easy: 'Rustige loop', tempo: 'Tempo', interval: 'Interval', long: 'Lange duurloop',
                  }
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
                        <button
                          onClick={() => deleteRun(run.id)}
                          className="w-9 h-9 flex items-center justify-center text-zinc-700 hover:text-red-400 text-lg transition ml-2 rounded-lg"
                          aria-label="Verwijder run"
                        >
                          ×
                        </button>
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
