'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { differenceInDays, addDays, parseISO, subWeeks } from 'date-fns'
import { PageSpinner } from '@/components/ui'
import { AddClientForm, ClientCard, ProgramBuilder } from '@/components/coach'

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

    const { data: prof } = await supabase
      .from('profiles').select('*').eq('id', user.id).single()

    if (!prof || !['coach', 'admin'].includes(prof.role)) {
      router.push('/portal/dashboard'); return
    }
    setProfile(prof)

    const { data: relations } = await supabase
      .from('coach_client')
      .select('client_id')
      .eq('coach_id', user.id)
      .eq('active', true)

    const clientIds = relations?.map(r => r.client_id) ?? []
    if (clientIds.length === 0) { setLoading(false); return }

    const fiveWeeksAgo = subWeeks(new Date(), 5).toISOString()

    const [
      { data: profiles },
      { data: workoutLogs },
      { data: allWorkoutLogs },
      { data: programs },
      { data: msgs },
    ] = await Promise.all([
      supabase.from('profiles').select('*').in('id', clientIds),
      supabase.from('workout_logs').select('client_id, logged_at')
        .in('client_id', clientIds).not('completed_at', 'is', null)
        .gte('logged_at', fiveWeeksAgo).order('logged_at', { ascending: false }),
      supabase.from('workout_logs').select('client_id, logged_at')
        .in('client_id', clientIds).not('completed_at', 'is', null)
        .order('logged_at', { ascending: false }),
      supabase.from('programs').select('client_id, name, start_date, id')
        .in('client_id', clientIds).eq('is_active', true),
      supabase.from('messages').select('sender_id, read_at')
        .eq('receiver_id', user.id).is('read_at', null).in('sender_id', clientIds),
    ])

    // Last workout per client
    const lastWorkout: Record<string, string> = {}
    allWorkoutLogs?.forEach(log => {
      if (!lastWorkout[log.client_id]) lastWorkout[log.client_id] = log.logged_at
    })

    // Sparkline: workouts per week for last 5 weeks
    const sparklineMap: Record<string, number[]> = {}
    clientIds.forEach(id => { sparklineMap[id] = [0, 0, 0, 0, 0] })
    const now = new Date()
    workoutLogs?.forEach(log => {
      const weeksAgo = Math.floor(differenceInDays(now, new Date(log.logged_at)) / 7)
      if (weeksAgo >= 0 && weeksAgo < 5) {
        const idx = 4 - weeksAgo
        sparklineMap[log.client_id][idx] = (sparklineMap[log.client_id][idx] ?? 0) + 1
      }
    })

    // Program weeks count
    const programWeeksMap: Record<string, number> = {}
    if (programs && programs.length > 0) {
      const programIds = programs.map(p => p.id)
      const { data: weeks } = await supabase
        .from('program_weeks').select('program_id').in('program_id', programIds)
      programs.forEach(p => {
        programWeeksMap[p.id] = weeks?.filter(w => w.program_id === p.id).length ?? 0
      })
    }

    const activeProgram: Record<string, any> = {}
    programs?.forEach(p => {
      if (!activeProgram[p.client_id]) activeProgram[p.client_id] = p
    })

    // Unread messages
    const unreadMap: Record<string, number> = {}
    msgs?.forEach(m => {
      unreadMap[m.sender_id] = (unreadMap[m.sender_id] ?? 0) + 1
    })

    const enriched = (profiles ?? []).map(c => {
      const prog = activeProgram[c.id]
      const numWeeks = prog ? programWeeksMap[prog.id] ?? 4 : 4
      const endDate = prog ? addDays(parseISO(prog.start_date), numWeeks * 7) : null
      const daysLeft = endDate ? differenceInDays(endDate, new Date()) : null
      const recentWorkouts = (sparklineMap[c.id] ?? [0, 0, 0, 0, 0]).slice(1).reduce((a, b) => a + b, 0)
      const compliance = Math.min(100, Math.round((recentWorkouts / (3 * 4)) * 100))

      return {
        ...c,
        lastWorkout: lastWorkout[c.id] ?? null,
        activeProgram: prog ?? null,
        daysLeft,
        unread: unreadMap[c.id] ?? 0,
        sparkline: sparklineMap[c.id] ?? [0, 0, 0, 0, 0],
        compliance,
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

  if (loading) return <PageSpinner />

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      {/* Header */}
      <div className="bg-zinc-900 px-5 pt-12 pb-5 border-b border-zinc-800">
        <p className="text-orange-500 text-xs font-bold tracking-widest uppercase mb-1">Coach Dashboard</p>
        <h1 className="text-white text-2xl font-black">Hey {profile?.full_name?.split(' ')[0]} 👋</h1>
        <div className="flex gap-3 mt-4">
          <StatBox value={clients.length} label="Clients" />
          <StatBox value={redClients} label="Aandacht nodig" highlight={redClients > 0 ? 'red' : undefined} />
          <StatBox value={totalUnread} label="Ongelezen" highlight={totalUnread > 0 ? 'orange' : undefined} />
          <StatBox value={greenClients} label="Op schema" color="text-green-400" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-zinc-900 border-b border-zinc-800" role="tablist">
        {[
          { key: 'clients', label: '👥 Clients' },
          { key: 'programs', label: '📋 Programma Builder' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`flex-1 py-3 text-sm font-semibold transition border-b-2 ${
              activeTab === tab.key ? 'text-orange-500 border-orange-500' : 'text-zinc-500 border-transparent'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
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
                {clients.map(client => (
                  <ClientCard
                    key={client.id}
                    client={client}
                    statusColor={getStatusColor(client)}
                    onClick={() => router.push(`/portal/coach/client/${client.id}`)}
                  />
                ))}
              </div>
            )}

            {/* Coach tools */}
            <div className="space-y-3 pt-2">
              <p className="text-zinc-500 text-xs uppercase tracking-widest font-bold px-1">Coach tools</p>
              <CoachToolLink label="Habits beheren" description="Dagelijkse habits instellen per client" icon="🎯"
                onClick={() => router.push('/portal/coach/habits')} />
              <CoachToolLink label="Oefeningen beheren" description="Illustraties en oefeningen beheren" icon="🏋️"
                onClick={() => router.push('/portal/coach/exercises')} />
            </div>
          </>
        )}

        {activeTab === 'programs' && (
          <>
            <div className="bg-gradient-to-r from-orange-500/20 to-orange-600/10 border border-orange-500/30 rounded-2xl p-4 flex items-center gap-3">
              <span className="text-3xl">🤖</span>
              <div className="flex-1">
                <p className="text-white font-bold text-sm">AI Programma Builder</p>
                <p className="text-zinc-400 text-xs">Laat AI automatisch een volledig programma bouwen</p>
              </div>
              <button
                onClick={() => router.push('/portal/coach/templates')}
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-2 rounded-xl text-sm transition flex-shrink-0"
              >
                Ga naar AI →
              </button>
            </div>
            <ProgramBuilder coachId={profile.id} clients={clients} />
          </>
        )}
      </div>
    </div>
  )
}

/* ── Small helper components ── */

function StatBox({ value, label, highlight, color }: {
  value: number; label: string; highlight?: 'red' | 'orange'; color?: string
}) {
  const bg = highlight === 'red' ? 'bg-red-500/20' : highlight === 'orange' ? 'bg-orange-500/20' : 'bg-zinc-800'
  const textColor = color ?? (highlight === 'red' ? 'text-red-400' : highlight === 'orange' ? 'text-orange-400' : 'text-white')
  return (
    <div className={`flex-1 ${bg} rounded-xl p-3 text-center`}>
      <p className={`${textColor} font-black text-xl`}>{value}</p>
      <p className="text-zinc-500 text-xs">{label}</p>
    </div>
  )
}

function CoachToolLink({ label, description, icon, onClick }: {
  label: string; description: string; icon: string; onClick: () => void
}) {
  return (
    <button onClick={onClick}
      className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-3 hover:border-zinc-600 transition">
      <span className="text-2xl">{icon}</span>
      <div className="text-left">
        <p className="text-white font-bold">{label}</p>
        <p className="text-zinc-500 text-xs">{description}</p>
      </div>
      <span className="text-zinc-600 ml-auto">→</span>
    </button>
  )
}
