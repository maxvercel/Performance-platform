'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const HABIT_TEMPLATES = [
  { name: 'Water drinken', category: 'water', icon: '💧', target_value: 2000, target_unit: 'ml', description: 'Drink voldoende water per dag' },
  { name: 'Stappen', category: 'steps', icon: '👣', target_value: 10000, target_unit: 'stappen', description: 'Loop minimaal 10.000 stappen' },
  { name: 'Slaap', category: 'sleep', icon: '😴', target_value: 8, target_unit: 'uur', description: 'Slaap minimaal 8 uur per nacht' },
  { name: 'Stretch routine', category: 'mobility', icon: '🧘', target_value: 15, target_unit: 'min', description: 'Doe dagelijkse stretch routine' },
  { name: 'Supplementen', category: 'supplements', icon: '💊', target_value: 1, target_unit: 'x', description: 'Neem dagelijkse supplementen' },
  { name: 'Groenten & fruit', category: 'nutrition', icon: '🥗', target_value: 5, target_unit: 'porties', description: 'Eet minimaal 5 porties groenten/fruit' },
]

export default function CoachHabitsPage() {
  const supabase = createClient()
  const router = useRouter()

  const [clients, setClients] = useState<any[]>([])
  const [habits, setHabits] = useState<any[]>([])
  const [selectedClient, setSelectedClient] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    category: 'water',
    target_value: '',
    target_unit: '',
    description: '',
  })

  useEffect(() => {
    load()
  }, [selectedClient])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const { data: relations } = await supabase
      .from('coach_client')
      .select('client_id')
      .eq('coach_id', user.id)
      .eq('active', true)

    const clientIds = relations?.map(r => r.client_id) ?? []
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', clientIds)

    setClients(profiles ?? [])
    if (!selectedClient && profiles?.[0]) setSelectedClient(profiles[0].id)

    if (selectedClient) {
      const { data: habits } = await supabase
        .from('habits')
        .select('*')
        .eq('client_id', selectedClient)
        .order('created_at')
      setHabits(habits ?? [])
    }

    setLoading(false)
  }

  async function addFromTemplate(template: any) {
    if (!selectedClient || !userId) return
    setSaving(true)

    await supabase.from('habits').insert({
      coach_id: userId,
      client_id: selectedClient,
      name: template.name,
      category: template.category,
      icon: template.icon,
      target_value: template.target_value,
      target_unit: template.target_unit,
      description: template.description,
      active: true,
    })

    await load()
    setSaving(false)
  }

  async function addCustom() {
    if (!selectedClient || !userId || !form.name) return
    setSaving(true)

    await supabase.from('habits').insert({
      coach_id: userId,
      client_id: selectedClient,
      name: form.name,
      category: form.category,
      target_value: parseFloat(form.target_value) || null,
      target_unit: form.target_unit || null,
      description: form.description || null,
      active: true,
    })

    setForm({ name: '', category: 'water', target_value: '', target_unit: '', description: '' })
    await load()
    setSaving(false)
  }

  async function toggleActive(habit: any) {
    await supabase.from('habits').update({ active: !habit.active }).eq('id', habit.id)
    setHabits(prev => prev.map(h => h.id === habit.id ? { ...h, active: !h.active } : h))
  }

  async function deleteHabit(id: string) {
    await supabase.from('habits').delete().eq('id', id)
    setHabits(prev => prev.filter(h => h.id !== id))
  }

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">

      <div className="bg-zinc-900 px-5 pt-12 pb-5 border-b border-zinc-800">
        <button onClick={() => router.push('/portal/coach')}
          className="text-zinc-500 text-xs mb-2">← Terug</button>
<h1 className="text-white text-2xl font-black">Habits beheren</h1>
        <button
          onClick={() => router.push('/portal/coach/habits/overzicht')}
          className="mt-3 w-full bg-orange-500/10 border border-orange-500/30 rounded-xl
                     px-4 py-2.5 text-orange-400 text-sm font-bold text-left flex items-center gap-2"
        >
          <span>📊</span> Bekijk compliance overzicht →
        </button>      </div>

      <div className="px-4 py-5 space-y-4">

        {/* Client selector */}
        <select
          value={selectedClient}
          onChange={e => setSelectedClient(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3
                     text-white text-sm focus:outline-none focus:border-orange-500"
        >
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.full_name}</option>
          ))}
        </select>

        {/* Snelle templates */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <h2 className="text-white font-bold mb-3">⚡ Snel toevoegen</h2>
          <div className="grid grid-cols-2 gap-2">
            {HABIT_TEMPLATES.map(t => {
              const alreadyAdded = habits.some(h => h.name === t.name && h.client_id === selectedClient)
              return (
                <button
                  key={t.name}
                  onClick={() => !alreadyAdded && addFromTemplate(t)}
                  disabled={alreadyAdded || saving}
                  className={`flex items-center gap-2 p-3 rounded-xl text-left transition ${
                    alreadyAdded
                      ? 'bg-green-500/10 border border-green-500/30 opacity-60'
                      : 'bg-zinc-800 border border-zinc-700 hover:border-orange-500'
                  }`}
                >
                  <span className="text-xl">{t.icon}</span>
                  <div>
                    <p className="text-white text-xs font-bold">{t.name}</p>
                    <p className="text-zinc-500 text-xs">{t.target_value} {t.target_unit}</p>
                  </div>
                  {alreadyAdded && <span className="text-green-400 text-xs ml-auto">✓</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* Custom habit */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
          <h2 className="text-white font-bold">+ Eigen habit</h2>
          <input
            type="text"
            placeholder="Naam habit"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3
                       text-white text-sm focus:outline-none focus:border-orange-500"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="Doel (bijv. 2000)"
              value={form.target_value}
              onChange={e => setForm(p => ({ ...p, target_value: e.target.value }))}
              className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2
                         text-white text-sm focus:outline-none focus:border-orange-500"
            />
            <input
              type="text"
              placeholder="Eenheid (bijv. ml)"
              value={form.target_unit}
              onChange={e => setForm(p => ({ ...p, target_unit: e.target.value }))}
              className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2
                         text-white text-sm focus:outline-none focus:border-orange-500"
            />
          </div>
          <input
            type="text"
            placeholder="Omschrijving (optioneel)"
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3
                       text-white text-sm focus:outline-none focus:border-orange-500"
          />
          <button
            onClick={addCustom}
            disabled={saving || !form.name}
            className="w-full bg-orange-500 disabled:opacity-40 text-white font-bold
                       py-3 rounded-xl text-sm transition"
          >
            {saving ? 'Opslaan...' : '+ Habit toevoegen'}
          </button>
        </div>

        {/* Huidige habits */}
        {habits.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <h2 className="text-white font-bold mb-3">
              Habits voor {clients.find(c => c.id === selectedClient)?.full_name?.split(' ')[0]}
            </h2>
            <div className="space-y-2">
              {habits.map(h => (
                <div key={h.id} className="flex items-center gap-3 py-2 border-b border-zinc-800 last:border-0">
                  <span className="text-xl">{h.icon ?? '✅'}</span>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${h.active ? 'text-white' : 'text-zinc-600'}`}>
                      {h.name}
                    </p>
                    {h.target_value && (
                      <p className="text-zinc-500 text-xs">{h.target_value} {h.target_unit}</p>
                    )}
                  </div>
                  <button
                    onClick={() => toggleActive(h)}
                    className={`text-xs px-2 py-1 rounded-lg transition ${
                      h.active
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    {h.active ? 'Actief' : 'Inactief'}
                  </button>
                  <button
                    onClick={() => deleteHabit(h.id)}
                    className="text-red-400 text-xs hover:text-red-300 px-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}