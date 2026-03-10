'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'

export default function TemplateEditorPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const templateId = params.id as string

  const [template, setTemplate] = useState<any>(null)
  const [weeks, setWeeks] = useState<any[]>([])
  const [allExercises, setAllExercises] = useState<any[]>([])
  const [selectedWeek, setSelectedWeek] = useState(0)
  const [selectedDay, setSelectedDay] = useState(0)
  const [dayExercises, setDayExercises] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState<any[]>([])

  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResponse, setAiResponse] = useState('')
  const [aiMode, setAiMode] = useState<'build' | 'advice'>('build')

  const [showAssign, setShowAssign] = useState(false)
  const [assignClient, setAssignClient] = useState('')
  const [assignDate, setAssignDate] = useState(new Date().toISOString().split('T')[0])
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [
        { data: template },
        { data: exercises },
        { data: relations },
      ] = await Promise.all([
        supabase.from('program_templates').select('*').eq('id', templateId).single(),
        supabase.from('exercises').select('*').eq('is_global', true).order('name'),
        supabase.from('coach_client')
          .select('client_id')
          .eq('coach_id', user.id)
          .eq('active', true),
      ])

      setTemplate(template)
      setAllExercises(exercises ?? [])

      // Haal client profielen op
      const clientIds = relations?.map((r: any) => r.client_id) ?? []
      const { data: clientProfiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', clientIds)
      setClients(clientProfiles ?? [])
      
      const { data: weeks } = await supabase
        .from('template_weeks')
        .select(`*, template_days(*, template_exercises(*, exercises(*)))`)
        .eq('template_id', templateId)
        .order('week_number')

      if (weeks) {
        const formatted = weeks.map(w => ({
          ...w,
          days: w.template_days?.sort((a: any, b: any) => a.day_number - b.day_number) ?? []
        }))
        setWeeks(formatted)

        const exMap: Record<string, any[]> = {}
        formatted.forEach(w => {
          w.days.forEach((d: any) => {
            exMap[d.id] = d.template_exercises
              ?.sort((a: any, b: any) => a.order_index - b.order_index) ?? []
          })
        })
        setDayExercises(exMap)
      }

      setLoading(false)
    }
    load()
  }, [])

  const currentDay = weeks[selectedWeek]?.days[selectedDay]
  const currentExercises = dayExercises[currentDay?.id] ?? []

  async function addExercise(exerciseId: string) {
    if (!currentDay) return
    const exercise = allExercises.find(e => e.id === exerciseId)
    if (!exercise) return

    const { data: te } = await supabase
      .from('template_exercises')
      .insert({
        day_id: currentDay.id,
        exercise_id: exerciseId,
        order_index: currentExercises.length,
        sets: 3,
        reps: '8-12',
        rest_seconds: 90,
      })
      .select().single()

    if (te) {
      setDayExercises(prev => ({
        ...prev,
        [currentDay.id]: [...(prev[currentDay.id] ?? []), { ...te, exercises: exercise }]
      }))
    }
  }

  async function updateExercise(teId: string, field: string, value: any) {
    await supabase.from('template_exercises').update({ [field]: value }).eq('id', teId)
    setDayExercises(prev => ({
      ...prev,
      [currentDay.id]: prev[currentDay.id]?.map(e =>
        e.id === teId ? { ...e, [field]: value } : e
      ) ?? []
    }))
  }

  async function removeExercise(teId: string) {
    await supabase.from('template_exercises').delete().eq('id', teId)
    setDayExercises(prev => ({
      ...prev,
      [currentDay.id]: prev[currentDay.id]?.filter(e => e.id !== teId) ?? []
    }))
  }

  async function assignToClient() {
    if (!assignClient) return
    setAssigning(true)

    const { data: program } = await supabase
      .from('programs')
      .insert({
        coach_id: template.coach_id,
        client_id: assignClient,
        name: template.name,
        goal: template.goal,
        start_date: assignDate,
        is_active: true,
      })
      .select().single()

    if (program) {
      for (const week of weeks) {
        const { data: pw } = await supabase
          .from('program_weeks')
          .insert({ program_id: program.id, week_number: week.week_number, label: week.label })
          .select().single()

        if (pw) {
          for (const day of week.days) {
            const { data: pd } = await supabase
              .from('program_days')
              .insert({
                week_id: pw.id,
                day_number: day.day_number,
                label: day.label,
                rest_day: day.rest_day
              })
              .select().single()

            if (pd) {
              const exes = dayExercises[day.id] ?? []
              for (const ex of exes) {
                await supabase.from('program_exercises').insert({
                  day_id: pd.id,
                  exercise_id: ex.exercise_id,
                  order_index: ex.order_index,
                  sets: ex.sets,
                  reps: ex.reps,
                  weight_kg: ex.weight_kg,
                  rest_seconds: ex.rest_seconds,
                  notes: ex.notes,
                })
              }
            }
          }
        }
      }

      alert('✅ Programma toegewezen aan client!')
      setShowAssign(false)
    }

    setAssigning(false)
  }

  async function applyAIProgram(aiProgram: any) {
    for (const aiWeek of aiProgram.weeks) {
      const week = weeks.find(w => w.week_number === aiWeek.week_number)
      if (!week) continue

      for (const aiDay of aiWeek.days) {
        const day = week.days.find((d: any) => d.day_number === aiDay.day_number)
        if (!day) continue

        await supabase.from('template_days')
          .update({ label: aiDay.label })
          .eq('id', day.id)

        await supabase.from('template_exercises').delete().eq('day_id', day.id)

        for (let i = 0; i < aiDay.exercises.length; i++) {
          const ex = aiDay.exercises[i]

          const { data: found } = await supabase
            .from('exercises')
            .select('*')
            .ilike('name', `%${ex.name}%`)
            .limit(1)
            .single()

          if (found) {
            await supabase.from('template_exercises').insert({
              day_id: day.id,
              exercise_id: found.id,
              order_index: i,
              sets: ex.sets,
              reps: ex.reps,
              weight_kg: ex.weight_kg,
              rest_seconds: ex.rest_seconds,
              notes: ex.notes,
            })
          }
        }
      }
    }
  }

  async function askAI() {
    if (!aiPrompt) return
    setAiLoading(true)
    setAiResponse('')

    const context = weeks.map(w => ({
      week: w.week_number,
      days: w.days.map((d: any) => ({
        day_number: d.day_number,
        dag: d.label,
        oefeningen: (dayExercises[d.id] ?? []).map(e => ({
          naam: e.exercises?.name,
          sets: e.sets,
          reps: e.reps,
          kg: e.weight_kg,
          rust: e.rest_seconds,
          notitie: e.notes,
        }))
      }))
    }))

    try {
      const res = await fetch('/api/ai/program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt,
          program: context,
          templateName: template.name,
          mode: aiMode,
        })
      })

      const data = await res.json()

      if (aiMode === 'advice') {
        setAiResponse(data.response ?? 'Geen antwoord ontvangen.')
      } else {
        if (data.program) {
          await applyAIProgram(data.program)
          setAiResponse('✅ Programma ingevuld! Pagina wordt herladen...')
          setTimeout(() => window.location.reload(), 1500)
        } else if (data.raw) {
          try {
            const clean = data.raw.replace(/```json/g, '').replace(/```/g, '').trim()
            const parsed = JSON.parse(clean)
            await applyAIProgram(parsed)
            setAiResponse('✅ Programma ingevuld! Pagina wordt herladen...')
            setTimeout(() => window.location.reload(), 1500)
          } catch {
            setAiResponse('❌ AI kon het programma niet correct verwerken. Probeer opnieuw.')
          }
        } else {
          setAiResponse('❌ Geen programma ontvangen van AI. Probeer opnieuw.')
        }
      }
    } catch {
      setAiResponse('❌ Er ging iets mis. Probeer opnieuw.')
    }

    setAiLoading(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">

      <div className="bg-zinc-900 px-5 pt-12 pb-5 border-b border-zinc-800">
        <button onClick={() => router.push('/portal/coach/templates')}
          className="text-zinc-500 text-xs mb-2 flex items-center gap-1">
          ← Terug naar templates
        </button>
        <h1 className="text-white text-2xl font-black">{template?.name}</h1>
        <p className="text-zinc-500 text-xs mt-1">
          {template?.num_weeks} weken · {template?.days_per_week} dagen/week · {template?.goal}
        </p>
      </div>

      <div className="px-4 py-5 space-y-4">

        <button onClick={() => setShowAssign(!showAssign)}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-black
                     py-3 rounded-2xl text-sm transition">
          👤 Toewijzen aan client
        </button>

        {showAssign && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
            <h2 className="text-white font-bold">Toewijzen aan client</h2>
            <select value={assignClient} onChange={e => setAssignClient(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3
                         text-white text-sm focus:outline-none focus:border-orange-500">
              <option value="">Selecteer client</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.full_name}</option>
              ))}
            </select>
            <input type="date" value={assignDate}
              onChange={e => setAssignDate(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3
                         text-white text-sm focus:outline-none focus:border-orange-500
                         [color-scheme:dark]" />
            <button onClick={assignToClient} disabled={assigning || !assignClient}
              className="w-full bg-green-500 disabled:opacity-40 text-white font-bold
                         py-3 rounded-xl text-sm transition">
              {assigning ? 'Toewijzen...' : '✓ Programma toewijzen'}
            </button>
          </div>
        )}

        <div className="bg-zinc-900 border border-orange-500/20 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🤖</span>
            <h2 className="text-white font-bold">AI Programma Assistent</h2>
          </div>

          <div className="flex gap-2 mb-3">
            {[
              { val: 'build', label: '⚡ Direct programmeren' },
              { val: 'advice', label: '💬 Advies vragen' },
            ].map(m => (
              <button key={m.val} onClick={() => setAiMode(m.val as any)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                  aiMode === m.val
                    ? 'bg-orange-500 text-white'
                    : 'bg-zinc-800 text-zinc-400'
                }`}>
                {m.label}
              </button>
            ))}
          </div>

          <p className="text-zinc-500 text-xs mb-3">
            {aiMode === 'build'
              ? 'AI vult het programma automatisch in op basis van jouw instructies'
              : 'AI geeft advies over aanpassingen — jij voert ze zelf door'
            }
          </p>

          <textarea
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
            placeholder={aiMode === 'build'
              ? 'bijv. Maak een upper/lower split. Dag 1 upper met bench press en rows. Dag 2 lower met squat en RDL. 4 weken progressief opbouwen.'
              : 'bijv. Maak week 3 en 4 zwaarder met 10% meer volume...'
            }
            rows={4}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3
                       text-white text-sm focus:outline-none focus:border-orange-500
                       resize-none placeholder-zinc-600 mb-2"
          />
          <button onClick={askAI} disabled={aiLoading || !aiPrompt}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40
                       text-white font-bold py-3 rounded-xl text-sm transition">
            {aiLoading
              ? '🤖 Bezig...'
              : aiMode === 'build' ? '⚡ Programma automatisch invullen' : '💬 Advies vragen'
            }
          </button>

          {aiResponse && (
            <div className="mt-3 bg-zinc-800 rounded-xl p-4">
              <p className="text-zinc-300 text-sm whitespace-pre-wrap leading-relaxed">
                {aiResponse}
              </p>
            </div>
          )}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <h2 className="text-white font-bold mb-3">Oefeningen per dag</h2>

          <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
            {weeks.map((week, wi) => (
              <button key={week.id}
                onClick={() => { setSelectedWeek(wi); setSelectedDay(0) }}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  selectedWeek === wi ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-400'
                }`}>
                Week {week.week_number}
              </button>
            ))}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
            {weeks[selectedWeek]?.days.map((day: any, di: number) => (
              <button key={day.id} onClick={() => setSelectedDay(di)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  selectedDay === di ? 'bg-zinc-600 text-white' : 'bg-zinc-800 text-zinc-400'
                }`}>
                {day.label}
              </button>
            ))}
          </div>

          <select
            onChange={e => { if (e.target.value) addExercise(e.target.value); e.target.value = '' }}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3
                       text-white text-sm focus:outline-none focus:border-orange-500 mb-3">
            <option value="">+ Oefening toevoegen...</option>
            {allExercises.map(ex => (
              <option key={ex.id} value={ex.id}>{ex.name}</option>
            ))}
          </select>

          <div className="space-y-3">
            {currentExercises.length === 0 ? (
              <p className="text-zinc-600 text-sm text-center py-4">
                Nog geen oefeningen — selecteer er een hierboven of gebruik de AI
              </p>
            ) : (
              currentExercises.map((te: any, idx: number) => (
                <div key={te.id} className="bg-zinc-800 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-white font-semibold text-sm">
                      {idx + 1}. {te.exercises?.name}
                    </p>
                    <button onClick={() => removeExercise(te.id)}
                      className="text-red-400 text-xs hover:text-red-300">
                      ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { field: 'sets', label: 'Sets', val: te.sets },
                      { field: 'reps', label: 'Reps', val: te.reps },
                      { field: 'weight_kg', label: 'KG', val: te.weight_kg ?? '' },
                      { field: 'rest_seconds', label: 'Rust(s)', val: te.rest_seconds },
                    ].map(f => (
                      <div key={f.field}>
                        <label className="text-zinc-600 text-xs block mb-1">{f.label}</label>
                        <input type="text" defaultValue={f.val}
                          onBlur={e => updateExercise(te.id, f.field, e.target.value)}
                          className="w-full bg-zinc-700 rounded-lg px-2 py-1.5 text-white
                                     text-xs text-center focus:outline-none focus:ring-1
                                     focus:ring-orange-500" />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2">
                    <label className="text-zinc-600 text-xs block mb-1">Coach notitie</label>
                    <input type="text" placeholder="bijv. Focus op techniek..."
                      defaultValue={te.notes ?? ''}
                      onBlur={e => updateExercise(te.id, 'notes', e.target.value)}
                      className="w-full bg-zinc-700 rounded-lg px-2 py-1.5 text-white
                                 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}