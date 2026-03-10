'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function TemplatesPage() {
  const supabase = createClient()
  const router = useRouter()
  const [templates, setTemplates] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('strength')
  const [numWeeks, setNumWeeks] = useState(4)
  const [daysPerWeek, setDaysPerWeek] = useState(3)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/portal/login'); return }

      const { data: profile } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setProfile(profile)

      const { data: templates } = await supabase
        .from('program_templates')
        .select('*')
        .eq('coach_id', user.id)
        .order('created_at', { ascending: false })

      setTemplates(templates ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function createTemplate() {
    if (!name) return
    setSaving(true)

    const { data: template } = await supabase
      .from('program_templates')
      .insert({
        coach_id: profile.id,
        name,
        goal,
        num_weeks: numWeeks,
        days_per_week: daysPerWeek,
      })
      .select().single()

    if (template) {
      // Maak weken en dagen aan
      for (let w = 1; w <= numWeeks; w++) {
        const { data: week } = await supabase
          .from('template_weeks')
          .insert({ template_id: template.id, week_number: w, label: `Week ${w}` })
          .select().single()

        if (week) {
          for (let d = 1; d <= daysPerWeek; d++) {
            await supabase.from('template_days').insert({
              week_id: week.id,
              day_number: d,
              label: `Dag ${d}`,
              rest_day: false
            })
          }
        }
      }

      setTemplates(prev => [template, ...prev])
      setShowForm(false)
      setName('')
      router.push(`/portal/coach/templates/${template.id}`)
    }

    setSaving(false)
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
          className="text-zinc-500 text-xs mb-2 flex items-center gap-1">
          ← Terug
        </button>
        <p className="text-orange-500 text-xs font-bold tracking-widest uppercase mb-1">
          Coach
        </p>
        <h1 className="text-white text-2xl font-black">Workout Templates</h1>
        <p className="text-zinc-500 text-xs mt-1">
          Maak herbruikbare programma blokken
        </p>
      </div>

      <div className="px-4 py-5 space-y-4">

        {/* Nieuw template knop */}
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black
                     py-4 rounded-2xl text-sm transition"
        >
          + Nieuw template
        </button>

        {/* Nieuw template form */}
        {showForm && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-white font-bold">Template details</h2>

            <div>
              <label className="text-zinc-500 text-xs uppercase tracking-wider mb-1 block">
                Naam *
              </label>
              <input
                type="text"
                placeholder="bijv. GPP Blok 1 - Kracht"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3
                           text-white text-sm focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="text-zinc-500 text-xs uppercase tracking-wider mb-1 block">
                Doel
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { val: 'strength', label: '💪 Kracht' },
                  { val: 'hypertrophy', label: '🏋️ Spiermassa' },
                  { val: 'fat_loss', label: '🔥 Vetverlies' },
                  { val: 'athletic', label: '⚡ Atletisch' },
                ].map(g => (
                  <button key={g.val} onClick={() => setGoal(g.val)}
                    className={`py-2.5 rounded-xl text-sm font-semibold transition ${
                      goal === g.val
                        ? 'bg-orange-500 text-white'
                        : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                    }`}>
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-zinc-500 text-xs uppercase tracking-wider mb-1 block">
                  Weken
                </label>
                <select value={numWeeks} onChange={e => setNumWeeks(parseInt(e.target.value))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3
                             text-white text-sm focus:outline-none focus:border-orange-500">
                  {[2,3,4,6,8,10,12].map(n => (
                    <option key={n} value={n}>{n} weken</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-zinc-500 text-xs uppercase tracking-wider mb-1 block">
                  Dagen/week
                </label>
                <select value={daysPerWeek} onChange={e => setDaysPerWeek(parseInt(e.target.value))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3
                             text-white text-sm focus:outline-none focus:border-orange-500">
                  {[2,3,4,5,6].map(n => (
                    <option key={n} value={n}>{n} dagen</option>
                  ))}
                </select>
              </div>
            </div>

            <button onClick={createTemplate} disabled={saving || !name}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40
                         text-white font-black py-4 rounded-2xl text-sm transition">
              {saving ? 'Aanmaken...' : '→ Template aanmaken & oefeningen toevoegen'}
            </button>
          </div>
        )}

        {/* Templates lijst */}
        {templates.length === 0 && !showForm ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-zinc-400 text-sm">Nog geen templates</p>
            <p className="text-zinc-600 text-xs mt-1">
              Maak je eerste herbruikbare programma template aan
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map(t => (
              <button key={t.id}
                onClick={() => router.push(`/portal/coach/templates/${t.id}`)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4
                           flex items-center justify-between hover:border-zinc-600 transition">
                <div className="text-left">
                  <p className="text-white font-bold">{t.name}</p>
                  <p className="text-zinc-500 text-xs mt-0.5">
                    {t.num_weeks} weken · {t.days_per_week} dagen/week · {t.goal}
                  </p>
                </div>
                <span className="text-zinc-600 text-sm">→</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}