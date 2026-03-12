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
  const [aiAdvice, setAiAdvice] = useState('')

  // Saved exercises per day (from template_exercises table)
  const [savedExercises, setSavedExercises] = useState<Record<string, any[]>>({})

  // Apply to client state
  const [clients, setClients] = useState<any[]>([])
  const [selectedClient, setSelectedClient] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [applying, setApplying] = useState(false)
  const [showApply, setShowApply] = useState(false)
  const [programName, setProgramName] = useState('')

  // Editing
  const [editingName, setEditingName] = useState(false)
  const [newName, setNewName] = useState('')
  const [savingExercises, setSavingExercises] = useState(false)

  // Expanded day for editing
  const [expandedDay, setExpandedDay] = useState<string | null>(null)

  useEffect(() => { load() }, [templateId])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/portal/login'); return }
    setProfile(user)

    // Load template with weeks, days, and saved exercises
    const { data: tmpl } = await supabase
      .from('program_templates')
      .select(`
        id, name, goal, num_weeks, days_per_week, coach_id,
        template_weeks(id, week_number, label,
          template_days(id, day_number, label, rest_day,
            template_exercises(id, exercise_name, sets, reps, weight_kg, rest_seconds, notes, order_index)
          )
        )
      `)
      .eq('id', templateId)
      .single()

    if (!tmpl) { router.push('/portal/coach/templates'); return }
    setTemplate(tmpl)
    setProgramName(tmpl.name)
    setNewName(tmpl.name)

    const sortedWeeks = (tmpl.template_weeks ?? [])
      .sort((a: any, b: any) => a.week_number - b.week_number)
      .map((w: any) => ({
        ...w,
        template_days: (w.template_days ?? [])
          .sort((a: any, b: any) => a.day_number - b.day_number)
          .map((d: any) => ({
            ...d,
            template_exercises: (d.template_exercises ?? []).sort((a: any, b: any) => a.order_index - b.order_index)
          }))
      }))
    setWeeks(sortedWeeks)

    // Build saved exercises map by day_id
    const exMap: Record<string, any[]> = {}
    sortedWeeks.forEach((w: any) => {
      w.template_days.forEach((d: any) => {
        if (d.template_exercises && d.template_exercises.length > 0) {
          exMap[d.id] = d.template_exercises.map((ex: any) => ({
            id: ex.id,
            name: ex.exercise_name,
            sets: ex.sets,
            reps: ex.reps,
            weight_kg: ex.weight_kg,
            rest_seconds: ex.rest_seconds,
            notes: ex.notes,
            order_index: ex.order_index,
          }))
        }
      })
    })
    setSavedExercises(exMap)

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

  // ─── Rename template ───
  async function renameTemplate() {
    if (!newName.trim() || newName.trim() === template.name) {
      setEditingName(false)
      return
    }
    const { error } = await supabase
      .from('program_templates')
      .update({ name: newName.trim() })
      .eq('id', templateId)
    if (error) { alert(`Fout bij hernoemen: ${error.message}`); return }
    setTemplate((prev: any) => ({ ...prev, name: newName.trim() }))
    setProgramName(newName.trim())
    setEditingName(false)
  }

  // ─── Build program structure for AI API ───
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

  // ─── Generate exercises with AI ───
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
        // Map AI response to savedExercises per day
        const newExMap: Record<string, any[]> = { ...savedExercises }
        for (const genWeek of data.program.weeks) {
          const matchingWeek = weeks.find((w: any) => w.week_number === genWeek.week_number)
          if (!matchingWeek) continue
          for (const genDay of genWeek.days ?? []) {
            const matchingDay = matchingWeek.template_days.find(
              (d: any) => d.day_number === genDay.day_number && !d.rest_day
            )
            if (!matchingDay) continue
            newExMap[matchingDay.id] = (genDay.exercises ?? []).map((ex: any, i: number) => ({
              name: ex.name,
              sets: ex.sets ?? 3,
              reps: ex.reps ?? '8-10',
              weight_kg: ex.weight_kg ?? null,
              rest_seconds: ex.rest_seconds ?? 90,
              notes: ex.notes ?? null,
              order_index: i,
            }))
          }
        }
        setSavedExercises(newExMap)
      }
    } catch (err: any) {
      setAiError(err.message || 'Er ging iets mis met de AI')
    }
    setAiLoading(false)
  }

  // ─── Get AI advice ───
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

  // ─── Save exercises to database ───
  async function saveExercisesToDB() {
    setSavingExercises(true)
    let hasError = false

    for (const [dayId, exercises] of Object.entries(savedExercises)) {
      // Delete existing exercises for this day
      await supabase
        .from('template_exercises')
        .delete()
        .eq('day_id', dayId)

      // Insert new exercises
      if (exercises.length > 0) {
        const rows = exercises.map((ex: any, i: number) => ({
          day_id: dayId,
          exercise_name: ex.name,
          sets: ex.sets ?? 3,
          reps: ex.reps ?? '8-10',
          weight_kg: ex.weight_kg ?? null,
          rest_seconds: ex.rest_seconds ?? 90,
          notes: ex.notes ?? null,
          order_index: i,
        }))
        const { error } = await supabase.from('template_exercises').insert(rows)
        if (error) {
          console.error('Save exercises error:', error)
          hasError = true
        }
      }
    }

    setSavingExercises(false)
    if (hasError) {
      alert('Sommige oefeningen konden niet opgeslagen worden. Controleer je Supabase RLS policies.')
    } else {
      alert('Template opgeslagen!')
    }
  }

  // ─── Inline exercise editing ───
  function updateExercise(dayId: string, index: number, field: string, value: any) {
    setSavedExercises(prev => {
      const dayExercises = [...(prev[dayId] ?? [])]
      dayExercises[index] = { ...dayExercises[index], [field]: value }
      return { ...prev, [dayId]: dayExercises }
    })
  }

  function addExercise(dayId: string) {
    setSavedExercises(prev => {
      const dayExercises = [...(prev[dayId] ?? [])]
      dayExercises.push({
        name: '',
        sets: 3,
        reps: '8-10',
        weight_kg: null,
        rest_seconds: 90,
        notes: null,
        order_index: dayExercises.length,
      })
      return { ...prev, [dayId]: dayExercises }
    })
  }

  function removeExercise(dayId: string, index: number) {
    setSavedExercises(prev => {
      const dayExercises = [...(prev[dayId] ?? [])]
      dayExercises.splice(index, 1)
      return { ...prev, [dayId]: dayExercises }
    })
  }

  function moveExercise(dayId: string, fromIndex: number, direction: 'up' | 'down') {
    setSavedExercises(prev => {
      const dayExercises = [...(prev[dayId] ?? [])]
      const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1
      if (toIndex < 0 || toIndex >= dayExercises.length) return prev
      const temp = dayExercises[fromIndex]
      dayExercises[fromIndex] = dayExercises[toIndex]
      dayExercises[toIndex] = temp
      return { ...prev, [dayId]: dayExercises }
    })
  }

  // ─── Apply template to client ───
  async function applyToClient() {
    if (!selectedClient || !profile) return

    // Check if there are any exercises to apply
    const hasExercises = Object.values(savedExercises).some(exs => exs.length > 0)
    if (!hasExercises) {
      alert('Voeg eerst oefeningen toe aan het template voordat je het toewijst.')
      return
    }

    setApplying(true)

    // 1. Deactivate existing programs
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
    const { data: program, error: progErr } = await supabase
      .from('programs')
      .insert({
        coach_id: profile.id,
        client_id: selectedClient,
        name: programName || template.name,
        goal: template.goal,
        start_date: startDate,
        is_active: true,
      })
      .select().single()

    if (progErr || !program) {
      alert(`Kon programma niet aanmaken: ${progErr?.message ?? 'Onbekende fout'}`)
      setApplying(false)
      return
    }

    // 3. Create weeks, days, exercises from saved template data
    for (const week of weeks) {
      const { data: progWeek, error: weekErr } = await supabase
        .from('program_weeks')
        .insert({
          program_id: program.id,
          week_number: week.week_number,
          label: week.label || `Week ${week.week_number}`,
        })
        .select().single()

      if (weekErr || !progWeek) {
        console.error('Week create error:', weekErr)
        continue
      }

      for (const day of week.template_days) {
        const { data: progDay, error: dayErr } = await supabase
          .from('program_days')
          .insert({
            week_id: progWeek.id,
            day_number: day.day_number,
            label: day.label,
            rest_day: day.rest_day,
          })
          .select().single()

        if (dayErr || !progDay || day.rest_day) continue

        // Get exercises for this day
        const dayExercises = savedExercises[day.id] ?? []
        for (let ei = 0; ei < dayExercises.length; ei++) {
          const ex = dayExercises[ei]
          if (!ex.name?.trim()) continue

          // Find or create exercise in DB
          let exerciseId: string | null = null

          const { data: existing } = await supabase
            .from('exercises')
            .select('id')
            .ilike('name', ex.name.trim())
            .limit(1)
            .maybeSingle()

          if (existing) {
            exerciseId = existing.id
          } else {
            // Create the exercise
            const { data: created } = await supabase
              .from('exercises')
              .insert({
                name: ex.name.trim(),
                category: 'general',
                muscle_group: 'general',
                is_global: true,
              })
              .select('id').single()
            exerciseId = created?.id ?? null
          }

          if (exerciseId) {
            await supabase.from('program_exercises').insert({
              day_id: progDay.id,
              exercise_id: exerciseId,
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

    setApplying(false)
    alert('Programma toegewezen! De client kan nu beginnen.')
    setShowApply(false)
  }

  // ─── Delete template ───
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
  const totalExercises = Object.values(savedExercises).reduce((sum, exs) => sum + exs.length, 0)
  const hasExercises = totalExercises > 0

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">

      {/* Header */}
      <div className="bg-zinc-900 px-5 pt-12 pb-4 border-b border-zinc-800">
        <button onClick={() => router.push('/portal/coach/templates')}
          className="text-zinc-500 text-xs mb-2 flex items-center gap-1">
          ← Terug naar templates
        </button>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-orange-500 text-xs font-bold tracking-widest uppercase mb-1">Template Editor</p>
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') renameTemplate(); if (e.key === 'Escape') setEditingName(false) }}
                  autoFocus
                  className="bg-zinc-800 border border-orange-500 rounded-lg px-3 py-1.5 text-white text-lg font-black
                             focus:outline-none w-full max-w-xs"
                />
                <button onClick={renameTemplate}
                  className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                  ✓
                </button>
                <button onClick={() => { setEditingName(false); setNewName(template.name) }}
                  className="text-xs text-zinc-400 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2">
                  ✕
                </button>
              </div>
            ) : (
              <button onClick={() => setEditingName(true)}
                className="text-left group">
                <h1 className="text-white text-xl font-black group-hover:text-orange-400 transition">
                  {goalEmoji[template?.goal] ?? '📋'} {template?.name}
                  <span className="text-zinc-600 text-sm ml-2 opacity-0 group-hover:opacity-100 transition">✏️</span>
                </h1>
              </button>
            )}
            <p className="text-zinc-500 text-xs mt-0.5">
              {template?.num_weeks} weken · {template?.days_per_week} dagen/week · {template?.goal}
              {hasExercises && ` · ${totalExercises} oefeningen`}
            </p>
          </div>
          <button onClick={deleteTemplate}
            className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 hover:bg-red-500/20 transition flex-shrink-0">
            🗑
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={saveExercisesToDB}
            disabled={savingExercises || !hasExercises}
            className="flex-1 bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white font-black
                       py-3 rounded-xl text-sm transition"
          >
            {savingExercises ? '💾 Opslaan...' : `💾 Template opslaan (${totalExercises} oefeningen)`}
          </button>
          <button
            onClick={() => setShowApply(!showApply)}
            disabled={!hasExercises}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-black
                       py-3 px-4 rounded-xl text-sm transition"
          >
            → Toewijzen
          </button>
        </div>

        {/* Apply to client */}
        {showApply && (
          <div className="bg-zinc-900 border-2 border-orange-500/30 rounded-2xl p-4 space-y-3">
            <p className="text-white font-bold text-sm">Programma toewijzen aan client</p>

            <div>
              <label className="text-zinc-500 text-[10px] uppercase tracking-wider mb-1 block">Programma naam</label>
              <input
                type="text"
                value={programName}
                onChange={e => setProgramName(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm
                           focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="text-zinc-500 text-[10px] uppercase tracking-wider mb-1 block">Client *</label>
              <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm
                           focus:outline-none focus:border-orange-500">
                <option value="">Selecteer client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-zinc-500 text-[10px] uppercase tracking-wider mb-1 block">Startdatum</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm
                           focus:outline-none focus:border-orange-500 [color-scheme:dark]" />
            </div>

            <button
              onClick={applyToClient}
              disabled={applying || !selectedClient}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-black
                         py-3 rounded-xl text-sm transition"
            >
              {applying ? 'Toewijzen...' : '✓ Programma toewijzen & activeren'}
            </button>
            <p className="text-zinc-600 text-[10px]">
              Het huidige actieve programma van deze client wordt automatisch gedeactiveerd.
            </p>
          </div>
        )}

        {/* AI Generator */}
        <div className="bg-zinc-900 border border-orange-500/30 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🤖</span>
            <h2 className="text-white font-bold text-sm">AI Oefening Generator</h2>
          </div>
          <p className="text-zinc-500 text-xs">
            Beschrijf wat voor training je wilt. De AI vult alle dagen in met oefeningen.
            Je kunt ze daarna nog aanpassen.
          </p>

          <textarea
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
            placeholder="bijv. Push Pull Legs schema met focus op spiermassa. Compound oefeningen eerst, dan isolatie. Bench press, squat en deadlift als hoofdoefeningen."
            rows={3}
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

        {/* Program structure with exercises per day */}
        <div className="space-y-3">
          {weeks.map(week => (
            <div key={week.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-3">
                {week.label || `Week ${week.week_number}`}
              </p>
              <div className="space-y-2">
                {week.template_days.map((day: any) => {
                  const dayExercises = savedExercises[day.id] ?? []
                  const isExpanded = expandedDay === day.id

                  if (day.rest_day) {
                    return (
                      <div key={day.id} className="bg-zinc-800/30 rounded-lg px-3 py-2">
                        <span className="text-zinc-600 text-xs">😴 {day.label} (rust)</span>
                      </div>
                    )
                  }

                  return (
                    <div key={day.id} className={`rounded-lg overflow-hidden border ${
                      isExpanded ? 'border-orange-500/40 bg-zinc-800/50' : 'border-zinc-800/50 bg-zinc-800/30'
                    }`}>
                      {/* Day header */}
                      <button
                        onClick={() => setExpandedDay(isExpanded ? null : day.id)}
                        className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-zinc-800/50 transition"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-white text-xs font-bold">{day.label}</span>
                          <span className="text-zinc-600 text-[10px]">
                            {dayExercises.length > 0
                              ? `${dayExercises.length} oefeningen`
                              : 'Geen oefeningen'}
                          </span>
                        </div>
                        <span className="text-zinc-600 text-xs">{isExpanded ? '▲' : '▼'}</span>
                      </button>

                      {/* Collapsed: show exercise names */}
                      {!isExpanded && dayExercises.length > 0 && (
                        <div className="px-3 pb-2">
                          <p className="text-zinc-500 text-[11px]">
                            {dayExercises.map((e: any) => e.name).filter(Boolean).join(' · ')}
                          </p>
                        </div>
                      )}

                      {/* Expanded: editable exercises */}
                      {isExpanded && (
                        <div className="px-3 pb-3 space-y-2">
                          {dayExercises.map((ex: any, ei: number) => (
                            <div key={ei} className="bg-zinc-900/60 rounded-lg p-2.5 space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-zinc-600 text-[10px] font-bold w-4">{ei + 1}.</span>
                                <input
                                  type="text"
                                  value={ex.name ?? ''}
                                  onChange={e => updateExercise(day.id, ei, 'name', e.target.value)}
                                  placeholder="Oefening naam"
                                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5
                                             text-white text-xs focus:outline-none focus:border-orange-500"
                                />
                                <div className="flex gap-0.5">
                                  <button onClick={() => moveExercise(day.id, ei, 'up')} disabled={ei === 0}
                                    className="text-zinc-600 hover:text-white text-xs px-1 disabled:opacity-20">↑</button>
                                  <button onClick={() => moveExercise(day.id, ei, 'down')} disabled={ei === dayExercises.length - 1}
                                    className="text-zinc-600 hover:text-white text-xs px-1 disabled:opacity-20">↓</button>
                                  <button onClick={() => removeExercise(day.id, ei)}
                                    className="text-red-400/60 hover:text-red-400 text-xs px-1">✕</button>
                                </div>
                              </div>
                              <div className="flex gap-2 pl-6">
                                <div className="flex-1">
                                  <label className="text-zinc-600 text-[9px] uppercase">Sets</label>
                                  <input type="number" value={ex.sets ?? 3} min={1} max={10}
                                    onChange={e => updateExercise(day.id, ei, 'sets', parseInt(e.target.value) || 3)}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1
                                               text-white text-xs focus:outline-none focus:border-orange-500" />
                                </div>
                                <div className="flex-1">
                                  <label className="text-zinc-600 text-[9px] uppercase">Reps</label>
                                  <input type="text" value={ex.reps ?? '8-10'}
                                    onChange={e => updateExercise(day.id, ei, 'reps', e.target.value)}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1
                                               text-white text-xs focus:outline-none focus:border-orange-500" />
                                </div>
                                <div className="flex-1">
                                  <label className="text-zinc-600 text-[9px] uppercase">Rust (s)</label>
                                  <input type="number" value={ex.rest_seconds ?? 90}
                                    onChange={e => updateExercise(day.id, ei, 'rest_seconds', parseInt(e.target.value) || 90)}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1
                                               text-white text-xs focus:outline-none focus:border-orange-500" />
                                </div>
                              </div>
                              <div className="pl-6">
                                <label className="text-zinc-600 text-[9px] uppercase">Notities</label>
                                <input type="text" value={ex.notes ?? ''} placeholder="bijv. RPE 7, tempo 3-1-2"
                                  onChange={e => updateExercise(day.id, ei, 'notes', e.target.value || null)}
                                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1
                                             text-white text-xs focus:outline-none focus:border-orange-500" />
                              </div>
                            </div>
                          ))}

                          <button
                            onClick={() => addExercise(day.id)}
                            className="w-full text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20
                                       rounded-lg py-2 hover:bg-orange-500/20 transition font-semibold"
                          >
                            + Oefening toevoegen
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom save bar */}
        {hasExercises && (
          <div className="flex gap-2">
            <button
              onClick={saveExercisesToDB}
              disabled={savingExercises}
              className="flex-1 bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white font-black
                         py-3 rounded-xl text-sm transition"
            >
              {savingExercises ? '💾 Opslaan...' : '💾 Template opslaan'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
