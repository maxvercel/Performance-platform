'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { differenceInDays, addDays, parseISO } from 'date-fns'
import { nl } from 'date-fns/locale'

export default function CoachDashboard() {
  const supabase = createClient()
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'clients' | 'programs'>('clients')

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/portal/login'); return }

    const { data: profile } = await supabase
      .from('profiles').select('*').eq('id', user.id).single()

    if (!profile || !['coach', 'admin'].includes(profile.role)) {
      router.push('/portal/dashboard'); return
    }
    setProfile(profile)

    const { data: relations } = await supabase
      .from('coach_client')
      .select('client_id')
      .eq('coach_id', user.id)
      .eq('active', true)

    const clientIds = relations?.map(r => r.client_id) ?? []
    if (clientIds.length === 0) { setLoading(false); return }

    const { data: profiles } = await supabase
      .from('profiles').select('*').in('id', clientIds)

    // Laatste workout per client
    const { data: workoutLogs } = await supabase
      .from('workout_logs')
      .select('client_id, logged_at')
      .in('client_id', clientIds)
      .order('logged_at', { ascending: false })

    const lastWorkout: Record<string, string> = {}
    workoutLogs?.forEach(log => {
      if (!lastWorkout[log.client_id]) lastWorkout[log.client_id] = log.logged_at
    })

    // Actief programma per client
    const { data: programs } = await supabase
      .from('programs')
      .select('client_id, name, start_date, id')
      .in('client_id', clientIds)
      .eq('is_active', true)

    const programWeeksMap: Record<string, number> = {}
    if (programs && programs.length > 0) {
      const programIds = programs.map(p => p.id)
      const { data: weeks } = await supabase
        .from('program_weeks')
        .select('program_id')
        .in('program_id', programIds)
      programs.forEach(p => {
        programWeeksMap[p.id] = weeks?.filter(w => w.program_id === p.id).length ?? 0
      })
    }

    const activeProgram: Record<string, any> = {}
    programs?.forEach(p => {
      if (!activeProgram[p.client_id]) activeProgram[p.client_id] = p
    })

    // Ongelezen berichten — sender_id is client, receiver_id is coach
    const { data: msgs } = await supabase
      .from('messages')
      .select('sender_id, read_at')
      .eq('receiver_id', user.id)
      .is('read_at', null)
      .in('sender_id', clientIds)

    const unreadMap: Record<string, number> = {}
    msgs?.forEach(m => {
      unreadMap[m.sender_id] = (unreadMap[m.sender_id] ?? 0) + 1
    })

    const enriched = (profiles ?? []).map(c => {
      const prog = activeProgram[c.id]
      const numWeeks = prog ? programWeeksMap[prog.id] ?? 4 : 4
      const endDate = prog ? addDays(parseISO(prog.start_date), numWeeks * 7) : null
      const daysLeft = endDate ? differenceInDays(endDate, new Date()) : null

      return {
        ...c,
        lastWorkout: lastWorkout[c.id] ?? null,
        activeProgram: prog ?? null,
        daysLeft,
        unread: unreadMap[c.id] ?? 0,
      }
    })

    enriched.sort((a, b) => getUrgencyScore(b) - getUrgencyScore(a))
    setClients(enriched)
    setLoading(false)
  }

  function getUrgencyScore(client: any) {
    let score = 0
    if (client.unread > 0) score += 100
    if (!client.lastWorkout) score += 50
    else {
      const days = differenceInDays(new Date(), new Date(client.lastWorkout))
      if (days > 7) score += 40
      else if (days > 4) score += 20
    }
    if (client.daysLeft !== null && client.daysLeft <= 7) score += 30
    return score
  }

  function getStatusColor(client: any): 'green' | 'orange' | 'red' {
    const score = getUrgencyScore(client)
    if (score >= 80) return 'red'
    if (score >= 20) return 'orange'
    return 'green'
  }

  async function addClient(email: string) {
    const { data: clientProfile } = await supabase
      .from('profiles').select('*').eq('email', email).single()
    if (!clientProfile) { alert('Geen gebruiker gevonden.'); return }
    const { error } = await supabase
      .from('coach_client')
      .insert({ coach_id: profile.id, client_id: clientProfile.id })
    if (error) { alert('Fout: ' + error.message); return }
    await load()
  }

  const totalUnread = clients.reduce((sum, c) => sum + c.unread, 0)
  const redClients = clients.filter(c => getStatusColor(c) === 'red').length
  const greenClients = clients.filter(c => getStatusColor(c) === 'green').length

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      <div className="bg-zinc-900 px-5 pt-12 pb-5 border-b border-zinc-800">
        <p className="text-orange-500 text-xs font-bold tracking-widest uppercase mb-1">Coach Dashboard</p>
        <h1 className="text-white text-2xl font-black">Hey {profile?.full_name?.split(' ')[0]} 👋</h1>
        <div className="flex gap-3 mt-4">
          <div className="flex-1 bg-zinc-800 rounded-xl p-3 text-center">
            <p className="text-white font-black text-xl">{clients.length}</p>
            <p className="text-zinc-500 text-xs">Clients</p>
          </div>
          <div className={`flex-1 rounded-xl p-3 text-center ${redClients > 0 ? 'bg-red-500/20' : 'bg-zinc-800'}`}>
            <p className={`font-black text-xl ${redClients > 0 ? 'text-red-400' : 'text-white'}`}>{redClients}</p>
            <p className="text-zinc-500 text-xs">Aandacht nodig</p>
          </div>
          <div className={`flex-1 rounded-xl p-3 text-center ${totalUnread > 0 ? 'bg-orange-500/20' : 'bg-zinc-800'}`}>
            <p className={`font-black text-xl ${totalUnread > 0 ? 'text-orange-400' : 'text-white'}`}>{totalUnread}</p>
            <p className="text-zinc-500 text-xs">Ongelezen</p>
          </div>
          <div className="flex-1 bg-zinc-800 rounded-xl p-3 text-center">
            <p className="text-green-400 font-black text-xl">{greenClients}</p>
            <p className="text-zinc-500 text-xs">Op schema</p>
          </div>
        </div>
      </div>

      <div className="flex bg-zinc-900 border-b border-zinc-800">
        {[
          { key: 'clients', label: '👥 Clients' },
          { key: 'programs', label: '📋 Programma Builder' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`flex-1 py-3 text-sm font-semibold transition border-b-2 ${
              activeTab === tab.key ? 'text-orange-500 border-orange-500' : 'text-zinc-500 border-transparent'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-5 space-y-4">
        {activeTab === 'clients' && (
          <>
            <AddClientForm onAdd={addClient} />
            {clients.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
                <div className="text-4xl mb-3">👥</div>
                <p className="text-zinc-400 text-sm">Nog geen clients toegevoegd</p>
              </div>
            ) : (
              <div className="space-y-3">
                {clients.map(client => {
                  const status = getStatusColor(client)
                  const borderColor = status === 'red' ? 'border-red-500/50' : status === 'orange' ? 'border-orange-500/40' : 'border-zinc-800'
                  const dotColor = status === 'red' ? 'bg-red-500' : status === 'orange' ? 'bg-orange-400' : 'bg-green-500'
                  const avatarBg = status === 'red' ? 'bg-red-500' : status === 'orange' ? 'bg-orange-500' : 'bg-green-600'
                  const workoutDaysAgo = client.lastWorkout
                    ? differenceInDays(new Date(), new Date(client.lastWorkout))
                    : null

                  return (
                    <button key={client.id}
                      onClick={() => router.push(`/portal/coach/client/${client.id}`)}
                      className={`w-full bg-zinc-900 border ${borderColor} rounded-2xl p-4 text-left transition hover:brightness-110`}>
                      <div className="flex items-start gap-3">
                        <div className="relative flex-shrink-0">
                          <div className={`w-12 h-12 ${avatarBg} rounded-full flex items-center justify-center text-white font-black text-lg`}>
                            {client.full_name?.[0] ?? '?'}
                          </div>
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ${dotColor} rounded-full border-2 border-zinc-900`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-white font-bold text-sm">{client.full_name}</p>
                            {client.unread > 0 && (
                              <span className="bg-orange-500 text-white text-xs font-black px-1.5 py-0.5 rounded-full">
                                {client.unread}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              workoutDaysAgo === null ? 'bg-red-500/20 text-red-400'
                              : workoutDaysAgo > 7 ? 'bg-red-500/20 text-red-400'
                              : workoutDaysAgo > 4 ? 'bg-orange-500/20 text-orange-400'
                              : 'bg-green-500/20 text-green-400'
                            }`}>
                              💪 {workoutDaysAgo === null ? 'Nog geen workout'
                                : workoutDaysAgo === 0 ? 'Vandaag getraind'
                                : `${workoutDaysAgo}d geleden`}
                            </span>
                            {client.daysLeft !== null && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                client.daysLeft <= 3 ? 'bg-red-500/20 text-red-400'
                                : client.daysLeft <= 7 ? 'bg-orange-500/20 text-orange-400'
                                : 'bg-zinc-800 text-zinc-400'
                              }`}>
                                📅 {client.daysLeft <= 0 ? 'Programma verlopen!' : `Nog ${client.daysLeft}d`}
                              </span>
                            )}
                            {!client.activeProgram && (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-500/20 text-red-400">
                                ⚠️ Geen programma
                              </span>
                            )}
                            {client.unread > 0 && (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-orange-500/20 text-orange-400">
                                💬 {client.unread} nieuw bericht{client.unread > 1 ? 'en' : ''}
                              </span>
                            )}
                          </div>
                          {client.activeProgram && (
                            <p className="text-zinc-600 text-xs mt-1.5">📋 {client.activeProgram.name}</p>
                          )}
                        </div>
                        <span className="text-zinc-600 text-sm flex-shrink-0">→</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            <div className="space-y-3 pt-2">
              <p className="text-zinc-500 text-xs uppercase tracking-widest font-bold px-1">Coach tools</p>
              <button onClick={() => router.push('/portal/coach/habits')}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-3 hover:border-zinc-600 transition">
                <span className="text-2xl">🎯</span>
                <div className="text-left">
                  <p className="text-white font-bold">Habits beheren</p>
                  <p className="text-zinc-500 text-xs">Dagelijkse habits instellen per client</p>
                </div>
                <span className="text-zinc-600 ml-auto">→</span>
              </button>
              <button onClick={() => router.push('/portal/coach/exercises')}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-3 hover:border-zinc-600 transition">
                <span className="text-2xl">🏋️</span>
                <div className="text-left">
                  <p className="text-white font-bold">Oefeningen beheren</p>
                  <p className="text-zinc-500 text-xs">Illustraties en oefeningen beheren</p>
                </div>
                <span className="text-zinc-600 ml-auto">→</span>
              </button>
            </div>
          </>
        )}

        {activeTab === 'programs' && (
          <ProgramBuilder coachId={profile.id} clients={clients} />
        )}
      </div>
    </div>
  )
}

function AddClientForm({ onAdd }: { onAdd: (email: string) => void }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  async function handle() {
    if (!email) return
    setLoading(true)
    await onAdd(email)
    setEmail('')
    setLoading(false)
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <h2 className="text-white font-bold mb-3">Client toevoegen</h2>
      <div className="flex gap-2">
        <input type="email" placeholder="emailadres van client" value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handle()}
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-orange-500 transition" />
        <button onClick={handle} disabled={loading || !email}
          className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-bold px-4 rounded-xl text-sm transition">
          {loading ? '...' : '+ Toevoegen'}
        </button>
      </div>
    </div>
  )
}

function ProgramBuilder({ coachId, clients }: { coachId: string, clients: any[] }) {
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

  if (step === 'done') return (
    <div className="bg-zinc-900 border border-green-500/30 rounded-2xl p-6 text-center">
      <div className="text-4xl mb-3">✅</div>
      <h2 className="text-white font-bold mb-2">Programma aangemaakt!</h2>
      <button onClick={() => { setStep('form'); setName(''); setClientId(''); setWeeks([]) }}
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
          {[
            { val: 'strength', label: '💪 Kracht' },
            { val: 'hypertrophy', label: '🏋️ Spiermassa' },
            { val: 'fat_loss', label: '🔥 Vetverlies' },
            { val: 'athletic', label: '⚡ Atletisch' },
          ].map(g => (
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
            {[2,3,4,6,8,10,12].map(n => <option key={n} value={n}>{n} weken</option>)}
          </select>
        </div>
        <div>
          <label className="text-zinc-500 text-xs uppercase tracking-wider mb-1 block">Dagen per week</label>
          <select value={daysPerWeek} onChange={e => setDaysPerWeek(parseInt(e.target.value))}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500">
            {[2,3,4,5,6].map(n => <option key={n} value={n}>{n} dagen</option>)}
          </select>
        </div>
      </div>
      <button onClick={createProgram} disabled={saving || !name || !clientId}
        className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-black py-4 rounded-2xl text-sm transition">
        {saving ? 'Aanmaken...' : '→ Programma aanmaken'}
      </button>
    </div>
  )
}

function WeekBuilder({ weeks, programId, onDone }: any) {
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
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
          {weeks.map((week: any, wi: number) => (
            <button key={week.id} onClick={() => { setSelectedWeek(wi); setSelectedDay(0) }}
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
        <div className="mb-4">
          <label className="text-zinc-500 text-xs uppercase tracking-wider mb-1 block">Oefening toevoegen</label>
          <select onChange={e => { if (e.target.value) addExercise(e.target.value); e.target.value = '' }}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500">
            <option value="">Selecteer oefening...</option>
            {allExercises.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
          </select>
        </div>
        <div className="space-y-3">
          {currentExercises.map((pe: any, idx: number) => (
            <div key={pe.id} className="bg-zinc-800 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-white font-semibold text-sm">{idx + 1}. {pe.exercises?.name}</p>
                <button onClick={() => removeExercise(pe.id)} className="text-red-400 text-xs hover:text-red-300">✕ Verwijder</button>
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
              <div className="mt-2">
                <label className="text-zinc-600 text-xs block mb-1">Coach notitie</label>
                <input type="text" placeholder="bijv. Focus op techniek..." defaultValue={pe.notes ?? ''}
                  onBlur={e => updateExercise(pe.id, 'notes', e.target.value)}
                  className="w-full bg-zinc-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-orange-500" />
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