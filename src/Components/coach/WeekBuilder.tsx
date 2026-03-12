'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface WeekBuilderProps {
  weeks: any[]
  programId: string
  onDone: () => void
}

export function WeekBuilder({ weeks, programId, onDone }: WeekBuilderProps) {
  const supabase = createClient()
  const [selectedWeek, setSelectedWeek] = useState(0)
  const [selectedDay, setSelectedDay] = useState(0)
  const [allExercises, setAllExercises] = useState<any[]>([])
  const [dayExercises, setDayExercises] = useState<Record<string, any[]>>({})

  useEffect(() => {
    supabase.from('exercises').select('*').eq('is_global', true)
      .then(({ data }) => setAllExercises(data ?? []))
  }, [])

  const currentDay = weeks[selectedWeek]?.days[selectedDay]

  async function addExercise(exerciseId: string) {
    if (!currentDay) return
    const exercise = allExercises.find(e => e.id === exerciseId)
    if (!exercise) return
    const key = currentDay.id
    const current = dayExercises[key] ?? []
    const { data: pe } = await supabase
      .from('program_exercises')
      .insert({ day_id: currentDay.id, exercise_id: exerciseId, order_index: current.length, sets: 3, reps: '8-12', weight_kg: null, rest_seconds: 90 })
      .select().single()
    if (pe) setDayExercises(prev => ({ ...prev, [key]: [...(prev[key] ?? []), { ...pe, exercises: exercise }] }))
  }

  async function updateExercise(peId: string, field: string, value: any) {
    await supabase.from('program_exercises').update({ [field]: value }).eq('id', peId)
    const key = currentDay.id
    setDayExercises(prev => ({ ...prev, [key]: prev[key]?.map(e => e.id === peId ? { ...e, [field]: value } : e) ?? [] }))
  }

  async function removeExercise(peId: string) {
    await supabase.from('program_exercises').delete().eq('id', peId)
    const key = currentDay.id
    setDayExercises(prev => ({ ...prev, [key]: prev[key]?.filter(e => e.id !== peId) ?? [] }))
  }

  const currentExercises = dayExercises[currentDay?.id] ?? []

  return (
    <div className="space-y-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <h2 className="text-white font-bold mb-3">Oefeningen per dag toevoegen</h2>

        {/* Week tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3" role="tablist" aria-label="Weken">
          {weeks.map((week: any, wi: number) => (
            <button key={week.id} onClick={() => { setSelectedWeek(wi); setSelectedDay(0) }}
              role="tab"
              aria-selected={selectedWeek === wi}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                selectedWeek === wi ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-400'
              }`}>
              Week {week.week_number}
            </button>
          ))}
        </div>

        {/* Day tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4" role="tablist" aria-label="Dagen">
          {weeks[selectedWeek]?.days.map((day: any, di: number) => (
            <button key={day.id} onClick={() => setSelectedDay(di)}
              role="tab"
              aria-selected={selectedDay === di}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                selectedDay === di ? 'bg-zinc-600 text-white' : 'bg-zinc-800 text-zinc-400'
              }`}>
              {day.label}
            </button>
          ))}
        </div>

        {/* Exercise selector */}
        <div className="mb-4">
          <label className="text-zinc-500 text-xs uppercase tracking-wider mb-1 block">Oefening toevoegen</label>
          <select onChange={e => { if (e.target.value) addExercise(e.target.value); e.target.value = '' }}
            aria-label="Oefening selecteren"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500">
            <option value="">Selecteer oefening...</option>
            {allExercises.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
          </select>
        </div>

        {/* Exercise list */}
        <div className="space-y-3">
          {currentExercises.map((pe: any, idx: number) => (
            <div key={pe.id} className="bg-zinc-800 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-white font-semibold text-sm">{idx + 1}. {pe.exercises?.name}</p>
                <button onClick={() => removeExercise(pe.id)} aria-label={`${pe.exercises?.name} verwijderen`} className="text-red-400 text-xs hover:text-red-300">
                  ✕ Verwijder
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { field: 'sets', label: 'Sets', type: 'number', val: pe.sets },
                  { field: 'reps', label: 'Reps', type: 'text', val: pe.reps },
                  { field: 'weight_kg', label: 'KG', type: 'number', val: pe.weight_kg ?? '' },
                  { field: 'rest_seconds', label: 'Rust(s)', type: 'number', val: pe.rest_seconds },
                ].map(f => (
                  <div key={f.field}>
                    <label className="text-zinc-600 text-xs block mb-1">{f.label}</label>
                    <input type={f.type} defaultValue={f.val}
                      onBlur={e => updateExercise(pe.id, f.field, e.target.value)}
                      className="w-full bg-zinc-700 rounded-lg px-2 py-1.5 text-white text-xs text-center focus:outline-none focus:ring-1 focus:ring-orange-500" />
                  </div>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="text-zinc-600 text-xs block mb-1">
                    Tempo <span className="text-zinc-700">(neer-pauze-omhoog-pauze)</span>
                  </label>
                  <input type="text" placeholder="bijv. 3-1-1-0" defaultValue={pe.tempo ?? ''}
                    onBlur={e => updateExercise(pe.id, 'tempo', e.target.value)}
                    className="w-full bg-zinc-700 rounded-lg px-2 py-1.5 text-white text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-orange-500" />
                </div>
                <div>
                  <label className="text-zinc-600 text-xs block mb-1">Coach notitie</label>
                  <input type="text" placeholder="bijv. Focus op techniek..." defaultValue={pe.notes ?? ''}
                    onBlur={e => updateExercise(pe.id, 'notes', e.target.value)}
                    className="w-full bg-zinc-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-orange-500" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button onClick={onDone}
        className="w-full bg-green-500 hover:bg-green-600 text-white font-black py-4 rounded-2xl text-lg transition">
        ✓ Programma opslaan
      </button>
    </div>
  )
}
