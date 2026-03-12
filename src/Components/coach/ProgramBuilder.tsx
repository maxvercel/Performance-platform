'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { WeekBuilder } from './WeekBuilder'

interface ProgramBuilderProps {
  coachId: string
  clients: Array<{ id: string; full_name: string }>
}

export function ProgramBuilder({ coachId, clients }: ProgramBuilderProps) {
  const supabase = createClient()
  const [step, setStep] = useState<'form' | 'weeks' | 'done'>('form')
  const [saving, setSaving] = useState(false)
  const [programId, setProgramId] = useState<string | null>(null)
  const [weeks, setWeeks] = useState<any[]>([])
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('strength')
  const [clientId, setClientId] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [numWeeks, setNumWeeks] = useState(4)
  const [daysPerWeek, setDaysPerWeek] = useState(3)
  const [templateId, setTemplateId] = useState('')
  const [coachPrograms, setCoachPrograms] = useState<any[]>([])
  const [templateInfo, setTemplateInfo] = useState<any>(null)

  useEffect(() => {
    supabase
      .from('programs')
      .select('id, name, goal, client_id, profiles(full_name)')
      .eq('coach_id', coachId)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => setCoachPrograms(data ?? []))
  }, [coachId])

  useEffect(() => {
    if (!templateId) { setTemplateInfo(null); return }
    supabase
      .from('programs')
      .select('name, goal, program_weeks(week_number, program_days(day_number, rest_day))')
      .eq('id', templateId)
      .single()
      .then(({ data }) => {
        if (data) {
          const totalDays = (data.program_weeks ?? []).reduce(
            (sum: number, w: any) => sum + (w.program_days?.length ?? 0), 0
          )
          setTemplateInfo({
            name: data.name,
            goal: data.goal,
            numWeeks: data.program_weeks?.length ?? 0,
            totalDays,
          })
        }
      })
  }, [templateId])

  async function duplicateFromTemplate() {
    if (!name || !clientId || !templateId) return
    setSaving(true)

    const { data: template } = await supabase
      .from('programs')
      .select(`
        goal,
        program_weeks(id, week_number, label,
          program_days(id, day_number, label, rest_day,
            program_exercises(exercise_id, sets, reps, weight_kg, rest_seconds, tempo, notes, order_index)
          )
        )
      `)
      .eq('id', templateId)
      .single()

    if (!template) { setSaving(false); return }

    const { data: program } = await supabase
      .from('programs')
      .insert({ coach_id: coachId, client_id: clientId, name, goal: goal || template.goal, start_date: startDate, is_active: true })
      .select().single()

    if (!program) { setSaving(false); return }

    const sortedWeeks = [...(template.program_weeks ?? [])].sort((a: any, b: any) => a.week_number - b.week_number)

    for (const week of sortedWeeks) {
      const { data: newWeek } = await supabase
        .from('program_weeks')
        .insert({ program_id: program.id, week_number: week.week_number, label: week.label ?? `Week ${week.week_number}` })
        .select().single()
      if (!newWeek) continue

      const sortedDays = [...(week.program_days ?? [])].sort((a: any, b: any) => a.day_number - b.day_number)

      for (const day of sortedDays) {
        const { data: newDay } = await supabase
          .from('program_days')
          .insert({ week_id: newWeek.id, day_number: day.day_number, label: day.label ?? `Dag ${day.day_number}`, rest_day: day.rest_day })
          .select().single()
        if (!newDay) continue

        const exercises = day.program_exercises ?? []
        if (exercises.length > 0) {
          await supabase.from('program_exercises').insert(
            exercises.map((e: any) => ({
              day_id: newDay.id,
              exercise_id: e.exercise_id,
              sets: e.sets,
              reps: e.reps,
              weight_kg: e.weight_kg,
              rest_seconds: e.rest_seconds,
              tempo: e.tempo,
              notes: e.notes,
              order_index: e.order_index,
            }))
          )
        }
      }
    }

    setSaving(false)
    setStep('done')
  }

  async function createProgram() {
    if (!name || !clientId) return
    setSaving(true)
    const { data: program } = await supabase
      .from('programs')
      .insert({ coach_id: coachId, client_id: clientId, name, goal, start_date: startDate, is_active: true })
      .select().single()
    if (!program) { setSaving(false); return }
    const createdWeeks = []
    for (let w = 1; w <= numWeeks; w++) {
      const { data: week } = await supabase
        .from('program_weeks')
        .insert({ program_id: program.id, week_number: w, label: `Week ${w}` })
        .select().single()
      if (week) {
        const days = []
        for (let d = 1; d <= daysPerWeek; d++) {
          const { data: day } = await supabase
            .from('program_days')
            .insert({ week_id: week.id, day_number: d, label: `Dag ${d}`, rest_day: false })
            .select().single()
          if (day) days.push({ ...day, exercises: [] })
        }
        createdWeeks.push({ ...week, days })
      }
    }
    setProgramId(program.id)
    setWeeks(createdWeeks)
    setStep('weeks')
    setSaving(false)
  }

  function resetForm() {
    setStep('form')
    setName('')
    setClientId('')
    setWeeks([])
  }

  const GOALS = [
    { val: 'strength', label: '💪 Kracht' },
    { val: 'hypertrophy', label: '🏋️ Spiermassa' },
    { val: 'fat_loss', label: '🔥 Vetverlies' },
    { val: 'athletic', label: '⚡ Atletisch' },
  ] as const

  if (step === 'done') return (
    <div className="bg-zinc-900 border border-green-500/30 rounded-2xl p-6 text-center">
      <div className="text-4xl mb-3">✅</div>
      <h2 className="text-white font-bold mb-2">Programma aangemaakt!</h2>
      <button onClick={resetForm}
        className="bg-orange-500 text-white font-bold py-2 px-6 rounded-xl text-sm">
        Nieuw programma
      </button>
    </div>
  )

  if (step === 'weeks') return (
    <WeekBuilder weeks={weeks} programId={programId!} onDone={() => setStep('done')} />
  )

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
      <h2 className="text-white font-bold">Nieuw programma</h2>

      <div>
        <label className="text-zinc-500 text-xs uppercase tracking-wider mb-1 block">Programma naam *</label>
        <input type="text" placeholder="bijv. Kracht Fase 1" value={name}
          onChange={e => setName(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500" />
      </div>

      <div>
        <label className="text-zinc-500 text-xs uppercase tracking-wider mb-1 block">Client *</label>
        <select value={clientId} onChange={e => setClientId(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500">
          <option value="">Selecteer client</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </select>
      </div>

      <div>
        <label className="text-zinc-500 text-xs uppercase tracking-wider mb-1 block">Doel</label>
        <div className="grid grid-cols-2 gap-2">
          {GOALS.map(g => (
            <button key={g.val} onClick={() => setGoal(g.val)}
              className={`py-2.5 rounded-xl text-sm font-semibold transition ${
                goal === g.val ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
              }`}>
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-zinc-500 text-xs uppercase tracking-wider mb-1 block">Startdatum</label>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500 [color-scheme:dark]" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-zinc-500 text-xs uppercase tracking-wider mb-1 block">Aantal weken</label>
          <select value={numWeeks} onChange={e => setNumWeeks(parseInt(e.target.value))}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500">
            {[2, 3, 4, 6, 8, 10, 12].map(n => <option key={n} value={n}>{n} weken</option>)}
          </select>
        </div>
        <div>
          <label className="text-zinc-500 text-xs uppercase tracking-wider mb-1 block">Dagen per week</label>
          <select value={daysPerWeek} onChange={e => setDaysPerWeek(parseInt(e.target.value))}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500">
            {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} dagen</option>)}
          </select>
        </div>
      </div>

      {coachPrograms.length > 0 && (
        <div className="border border-zinc-700 rounded-xl p-3 space-y-2">
          <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider">
            📋 Of dupliceer een bestaand programma
          </p>
          <select value={templateId} onChange={e => setTemplateId(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500">
            <option value="">Kies een template (optioneel)</option>
            {coachPrograms.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}{p.profiles?.full_name ? ` — ${p.profiles.full_name}` : ''}
              </option>
            ))}
          </select>
          {templateInfo && (
            <div className="bg-zinc-800/60 rounded-xl p-3 flex items-center gap-3">
              <span className="text-xl">✓</span>
              <div>
                <p className="text-white text-xs font-bold">{templateInfo.name}</p>
                <p className="text-zinc-500 text-xs">
                  {templateInfo.numWeeks} weken · {templateInfo.totalDays} trainingsdagen worden gekopieerd
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <button
        onClick={templateId ? duplicateFromTemplate : createProgram}
        disabled={saving || !name || !clientId}
        className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-black py-4 rounded-2xl text-sm transition"
      >
        {saving
          ? (templateId ? 'Kopiëren...' : 'Aanmaken...')
          : templateId
            ? '→ Dupliceer & maak programma'
            : '→ Programma aanmaken'}
      </button>
    </div>
  )
}
