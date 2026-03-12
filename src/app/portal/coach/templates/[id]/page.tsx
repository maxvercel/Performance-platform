'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'

export default function TemplateEditorPage() {
  const supabase = createClient()
  const router = useRouter()
  const { id: templateId } = useParams<{ id: string }>()

  const [profile, setProfile] = useState<any>(null)
  const [template, setTemplate] = useState<any>(null)
  const [weeks, setWeeks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // AI state
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [generatedWeeks, setGeneratedWeeks] = useState<any[]>([])

  // Apply to client state
  const [clients, setClients] = useState<any[]>([])
  const [selectedClient, setSelectedClient] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [applying, setApplying] = useState(false)
  const [showApply, setShowApply] = useState(false)

  // Advice mode
  const [aiAdvice, setAiAdvice] = useState('')

  useEffect(() => { load() }, [templateId])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/portal/login'); return }
    setProfile(user)

    // Load template with weeks and days
    const { data: tmpl } = await supabase
      .from('program_templates')
      .select(`
        id, name, goal, num_weeks, days_per_week, coach_id,
        template_weeks(id, week_number, label,
          template_days(id, day_number, label, rest_day)
        )
      `)
      .eq('id', templateId)
      .single()

    if (!tmpl) { router.push('/portal/coach/templates'); return }
    setTemplate(tmpl)

    const sortedWeeks = (tmpl.template_weeks ?? [])
      .sort((a: any, b: any) => a.week_number - b.week_number)
      .map((w: any) => ({
        ...w,
        template_days: (w.template_days ?? []).sort((a: any, b: any) => a.day_number - b.day_number)
      }))
    setWeeks(sortedWeeks)

    // Load coach's clients
    const { data: clientList } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('coach_id', user.id)
      .eq('role', 'client')
      .order('full_name')
    setClients(clientList ?? [])

    setLoading(false)
  }

  // Build the program structure for the AI API
  function buildProgramStructure() {
    return weeks.map(w => ({
      week: w.week_number,
      days: w.template_days
        .filter((d: any) => !d.rest_day)
        .map((d: any) => ({
          day_number: d.day_number,
          dag: d.label,
        }))
    }))
  }

  async function generateWithAI() {
    if (!aiPrompt.trim()) return
    setAiLoading(true)
    setAiError('')
    setAiAdvice('')

    try {
      const res = await fetch('/api/ai/program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt.trim(),
          program: buildProgramStructure(),
          templateName: template.name,
          mode: 'build',
        })
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Server error: ${res.status}`)
      }

      const data = await res.json()
      if (data.program?.weeks) {
        setGeneratedWeeks(data.program.weeks)
      }
    } catch (err: any) {
      setAiError(err.message || 'Er ging iets mis met de AI')
    }
    setAiLoading(false)
  }

  async function getAIAdvice() {
    if (!aiPrompt.trim()) return
    setAiLoading(true)
    setAiError('')

    try {
      const res = await fetch('/api/ai/program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt.trim(),
          program: buildProgramStructure(),
          templateName: template.name,
          mode: 'advice',
        })
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Server error: ${res.status}`)
      }

      const data = await res.json()
      setAiAdvice(data.response ?? '')
    } catch (err: any) {
      setAiError(err.message || 'Er ging iets mis')
    }
    setAiLoading(false)
  }

  async function applyToClient() {
    if (!selectedClient || !profile || generatedWeeks.length === 0) return
    setApplying(true)

    // 1. Deactivate existing programs for this client
    const { error: deactivateErr } = await supabase
      .from('programs')
      .update({ is_active: false })
      .eq('client_id', selectedClient)
      .eq('is_active', true)

    if (deactivateErr) {
      alert(`Kon bestaande programma's niet deactiveren: ${deactivateErr.message}`)
      setApplying(false)
      return
    }

    // 2. Create program
    const { data: program } = await supabase
      .from('programs')
      .insert({
        coach_id: profile.id,
        client_id: selectedClient,
        name: template.name,
        goal: template.goal,
        start_date: startDate,
        is_active: true,
      })
      .select().single()

    if (!program) { setApplying(false); alert('Kon programma niet aanmaken'); return }

    // 3. Create weeks, days, exercises from generated data
    for (const genWeek of generatedWeeks) {
      const { data: week } = await supabase
        .from('program_weeks')
        .insert({
          program_id: program.id,
          week_number: genWeek.week_number,
          label: `Week ${genWeek.week_number}`,
        })
        .select().single()

      if (!week) continue

      for (const genDay of genWeek.days ?? []) {
        const { data: day } = await supabase
          .from('program_days')
          .insert({
            week_id: week.id,
            day_number: genDay.day_number,
            label: genDay.label,
            rest_day: false,
          })
          .select().single()

        if (!day) continue

        for (let ei = 0; ei < (genDay.exercises ?? []).length; ei++) {
          const ex = genDay.exercises[ei]
          if (!ex.name) continue

          // Find exercise in DB (AI already created them)
          const { data: dbExercise } = await supabase
            .from('exercises')
            .select('id')
            .ilike('name', ex.name.trim())
            .limit(1)
            .maybeSingle()

          if (dbExercise) {
            await supabase.from('program_exercises').insert({
              day_id: day.id,
              exercise_id: dbExercise.id,
              sets: ex.sets ?? 3,
              reps: ex.reps ?? '8-10',
              weight_kg: ex.weight_kg ?? null,
              rest_seconds: ex.rest_seconds ?? 90,
              notes: ex.notes ?? null,
              order_index: ei,
            })
          }
        }
      }
    }

    // Also add rest days
    for (const origWeek of weeks) {
      const restDays = origWeek.template_days.filter((d: any) => d.rest_day)
      if (restDays.length === 0) continue

      // Find matching program_week
      const { data: matchWeek } = await supabase
        .from('program_weeks')
        .select('id')
        .eq('program_id', program.id)
        .eq('week_number', origWeek.week_number)
        .single()

      if (matchWeek) {
        for (const rd of restDays) {
          await supabase.from('program_days').insert({
            week_id: matchWeek.id,
            day_number: rd.day_number,
            label: rd.label,
            rest_day: true,
          })
        }
      }
    }

    setApplying(false)
    alert('Programma toegewezen! De client kan nu beginnen.')
    setShowApply(false)
  }

  async function deleteTemplate() {
    if (!confirm('Weet je zeker dat je dit template wilt verwijderen?')) return
    await supabase.from('program_templates').delete().eq('id', templateId)
    router.push('/portal/coach/templates')
  }

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const goalEmoji: Record<string, string> = { strength: '💪', hypertrophy: '🏋️', fat_loss: '🔥', athletic: '⚡' }

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">

      {/* Header */}
      <div className="bg-zinc-900 px-5 pt-12 pb-4 border-b border-zinc-800">
        <button onClick={() => router.push('/portal/coach/templates')}
          className="text-zinc-500 text-xs mb-2 flex items-center gap-1">
          ← Terug naar templates
        </button>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-orange-500 text-xs font-bold tracking-widest uppercase mb-1">Template Editor</p>
            <h1 className="text-white text-xl font-black">
              {goalEmoji[template?.goal] ?? '📋'} {template?.name}
            </h1>
            <p className="text-zinc-500 text-xs mt-0.5">
              {template?.num_weeks} weken · {template?.days_per_week} dagen/week · {template?.goal}
            </p>
          </div>
          <button onClick={deleteTemplate}
            className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 hover:bg-red-500/20 transition">
            🗑
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* Template structuur */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <p className="text-white font-bold text-sm mb-3">Structuur</p>
          <div className="space-y-2">
            {weeks.map(week => (
              <div key={week.id}>
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">
                  Week {week.week_number}
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {week.template_days.map((day: any) => (
                    <span key={day.id} className={`text-xs px-2.5 py-1 rounded-lg ${
                      day.rest_day ? 'bg-zinc-800 text-zinc-600' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                    }`}>
                      {day.label}{day.rest_day ? ' (rust)' : ''}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Generator */}
        <div className="bg-zinc-900 border border-orange-500/30 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🤖</span>
            <h2 className="text-white font-bold text-sm">AI Oefening Generator</h2>
          </div>
          <p className="text-zinc-500 text-xs">
            Beschrijf wat voor training je wilt en de AI genereert oefeningen per dag.
            Geef zo specifiek mogelijke instructies.
          </p>

          <textarea
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
            placeholder="bijv. Push Pull Legs schema met focus op spiermassa. Compound oefeningen eerst, dan isolatie. Bench press, squat en deadlift als hoofdoefeningen."
            rows={4}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3
                       text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-orange-500 resize-none"
          />

          <div className="flex gap-2">
            <button
              onClick={generateWithAI}
              disabled={aiLoading || !aiPrompt.trim()}
              className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-black
                         py-3 rounded-xl text-sm transition"
            >
              {aiLoading ? '🤖 Genereren...' : '🤖 Genereer oefeningen'}
            </button>
            <button
              onClick={getAIAdvice}
              disabled={aiLoading || !aiPrompt.trim()}
              className="bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 disabled:opacity-40 text-white font-semibold
                         py-3 px-4 rounded-xl text-sm transition"
            >
              💡 Advies
            </button>
          </div>

          {aiError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              <p className="text-red-400 text-xs">{aiError}</p>
            </div>
          )}

          {aiAdvice && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
              <p className="text-blue-400 text-xs font-bold mb-2">💡 AI Advies</p>
              <p className="text-zinc-300 text-sm whitespace-pre-wrap">{aiAdvice}</p>
            </div>
          )}
        </div>

        {/* Generated exercises preview */}
        {generatedWeeks.length > 0 && (
          <div className="bg-zinc-900 border-2 border-green-500/30 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">✅</span>
                <h2 className="text-white font-bold text-sm">Gegenereerd programma</h2>
              </div>
              <button
                onClick={() => setShowApply(!showApply)}
                className="text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-1.5
                           hover:bg-orange-500/20 transition font-bold"
              >
                → Toewijzen aan client
              </button>
            </div>

            {/* Apply to client form */}
            {showApply && (
              <div className="bg-zinc-800/50 rounded-xl p-4 space-y-3 border border-zinc-700">
                <p className="text-white font-bold text-xs">Programma toewijzen</p>

                <div>
                  <label className="text-zinc-500 text-[10px] uppercase tracking-wider mb-1 block">Client *</label>
                  <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500">
                    <option value="">Selecteer client</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-zinc-500 text-[10px] uppercase tracking-wider mb-1 block">Startdatum</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500 [color-scheme:dark]" />
                </div>

                <button
                  onClick={applyToClient}
                  disabled={applying || !selectedClient}
                  className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white font-black py-3 rounded-xl text-sm transition"
                >
                  {applying ? 'Toewijzen...' : '✓ Programma toewijzen & activeren'}
                </button>
                <p className="text-zinc-600 text-[10px]">
                  Het huidige actieve programma van deze client wordt automatisch gedeactiveerd.
                </p>
              </div>
            )}

            {/* Week-by-week preview */}
            {generatedWeeks.map((week: any, wi: number) => (
              <div key={wi}>
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-2">
                  Week {week.week_number}
                </p>
                <div className="space-y-2">
                  {(week.days ?? []).map((day: any, di: number) => (
                    <div key={di} className="bg-zinc-800/50 rounded-lg p-3">
                      <p className="text-white text-xs font-bold mb-2">{day.label}</p>
                      <div className="space-y-1">
                        {(day.exercises ?? []).map((ex: any, ei: number) => (
                          <div key={ei} className="flex items-center gap-2 text-[11px]">
                            <span className="text-zinc-600 w-4">{ei + 1}.</span>
                            <span className="text-zinc-200 flex-1">{ex.name}</span>
                            <span className="text-zinc-500">{ex.sets}×{ex.reps}</span>
                            {ex.rest_seconds && (
                              <span className="text-zinc-600">{ex.rest_seconds}s rust</span>
                            )}
                            {ex.notes && (
                              <span className="text-orange-400/60 text-[10px]">{ex.notes}</span>
                            )}
                          </div>
                        ))}
                        {(!day.exercises || day.exercises.length === 0) && (
                          <p className="text-zinc-600 text-[11px] italic">Geen oefeningen gegenereerd</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Regenerate button */}
            <button
              onClick={generateWithAI}
              disabled={aiLoading}
              className="w-full bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-300 font-semibold
                         py-2.5 rounded-xl text-xs transition"
            >
              🔄 Opnieuw genereren
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
