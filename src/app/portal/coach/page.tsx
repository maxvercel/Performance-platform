'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { differenceInDays, addDays, parseISO, subWeeks } from 'date-fns'
import { PageSpinner } from '@/components/ui'
import { AddClientForm, ClientCard, ProgramBuilder } from '@/components/coach'
import { selectInChunks } from '@/lib/supabase/queryHelpers'
import type { Profile } from '@/types'

interface WorkoutLogRow { client_id: string; logged_at: string }
interface ProgramRow { id: string; client_id: string; name: string; start_date: string }
interface EnrichedClient extends Profile {
  lastWorkout: string | null
  activeProgram: ProgramRow | null
  daysLeft: number | null
  sparkline: number[]
  compliance: number
}

export default function CoachDashboard() {
  const supabase = createClient()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [clients, setClients] = useState<EnrichedClient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'clients' | 'programs'>('clients')
  const [searchQuery, setSearchQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(20)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/portal/login'); return }

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()

      if (!prof || !['coach', 'admin'].includes(prof.role)) {
        router.push('/portal/dashboard'); return
      }
      setProfile(prof as Profile)

      const { data: relations, error: relErr } = await supabase
        .from('coach_client')
        .select('client_id')
        .eq('coach_id', user.id)
        .eq('active', true)

      if (relErr) { setError('Kan clients niet laden.'); setLoading(false); return }

      const clientIds = relations?.map(r => r.client_id) ?? []
      if (clientIds.length === 0) { setLoading(false); return }

      const fiveWeeksAgo = subWeeks(new Date(), 5).toISOString()

      // Use selectInChunks for safe .in() with many client IDs
      const [profiles, workoutLogs, allWorkoutLogs, programs] = await Promise.all([
        selectInChunks<Profile>(supabase, 'profiles', '*', 'id', clientIds),
        selectInChunks<WorkoutLogRow>(supabase, 'workout_logs', 'client_id, logged_at', 'client_id', clientIds,
          (q) => q.not('completed_at', 'is', null).gte('logged_at', fiveWeeksAgo).order('logged_at', { ascending: false })),
        selectInChunks<WorkoutLogRow>(supabase, 'workout_logs', 'client_id, logged_at', 'client_id', clientIds,
          (q) => q.not('completed_at', 'is', null).order('logged_at', { ascending: false }).limit(500)),
        selectInChunks<ProgramRow>(supabase, 'programs', 'client_id, name, start_date, id', 'client_id', clientIds,
          (q) => q.eq('is_active', true)),
      ])

    // Last workout per client
    const lastWorkout: Record<string, string> = {}
    allWorkoutLogs.forEach(log => {
      if (!lastWorkout[log.client_id]) lastWorkout[log.client_id] = log.logged_at
    })

    // Sparkline: workouts per week for last 5 weeks
    const sparklineMap: Record<string, number[]> = {}
    clientIds.forEach(id => { sparklineMap[id] = [0, 0, 0, 0, 0] })
    const now = new Date()
    workoutLogs.forEach(log => {
      const weeksAgo = Math.floor(differenceInDays(now, new Date(log.logged_at)) / 7)
      if (weeksAgo >= 0 && weeksAgo < 5) {
        const idx = 4 - weeksAgo
        sparklineMap[log.client_id][idx] = (sparklineMap[log.client_id][idx] ?? 0) + 1
      }
    })

    // Program weeks count
    const programWeeksMap: Record<string, number> = {}
    if (programs.length > 0) {
      const programIds = programs.map(p => p.id)
      const weeks = await selectInChunks<{ program_id: string }>(
        supabase, 'program_weeks', 'program_id', 'program_id', programIds
      )
      programs.forEach(p => {
        programWeeksMap[p.id] = weeks.filter(w => w.program_id === p.id).length
      })
    }

    const activeProgram: Record<string, ProgramRow> = {}
    programs.forEach(p => {
      if (!activeProgram[p.client_id]) activeProgram[p.client_id] = p
    })

    const enriched: EnrichedClient[] = profiles.map(c => {
      const prog = activeProgram[c.id]
      const numWeeks = prog ? programWeeksMap[prog.id] ?? 4 : 4
      const endDate = prog ? addDays(parseISO(prog.start_date), numWeeks * 7) : null
      const daysLeft = endDate ? differenceInDays(endDate, new Date()) : null
      const recentWorkouts = (sparklineMap[c.id] ?? [0, 0, 0, 0, 0]).slice(1).reduce((a: number, b: number) => a + b, 0)
      const compliance = Math.min(100, Math.round((recentWorkouts / (3 * 4)) * 100))

      return {
        ...c,
        lastWorkout: lastWorkout[c.id] ?? null,
        activeProgram: prog ?? null,
        daysLeft,
        sparkline: sparklineMap[c.id] ?? [0, 0, 0, 0, 0],
        compliance,
      }
    })

    enriched.sort((a, b) => getUrgencyScore(b) - getUrgencyScore(a))
    setClients(enriched)
    } catch (err) {
      console.error('Coach dashboard load error:', err)
      setError('Er ging iets mis bij het laden van het dashboard.')
    } finally {
      setLoading(false)
    }
  }

  function getUrgencyScore(client: EnrichedClient) {
    let score = 0
    if (!client.lastWorkout) score += 50
    else {
      const days = differenceInDays(new Date(), new Date(client.lastWorkout))
      if (days > 7) score += 40
      else if (days > 4) score += 20
    }
    if (client.daysLeft !== null && client.daysLeft <= 7) score += 30
    return score
  }

  function getStatusColor(client: EnrichedClient): 'green' | 'orange' | 'red' {
    const score = getUrgencyScore(client)
    if (score >= 80) return 'red'
    if (score >= 20) return 'orange'
    return 'green'
  }

  function computeAlerts() {
    interface Alert {
      type: 'inactive' | 'program_expiring' | 'low_compliance' | 'no_program'
      clientId: string
      clientName: string
      description: string
      colorClass: string
    }
    const alerts: Alert[] = []

    clients.forEach(client => {
      // 1. Inactive - hasn't worked out in 4+ days
      if (client.lastWorkout) {
        const daysSinceWorkout = differenceInDays(new Date(), new Date(client.lastWorkout))
        if (daysSinceWorkout >= 4) {
          alerts.push({
            type: 'inactive',
            clientId: client.id,
            clientName: client.full_name || 'Onbekend',
            description: `${daysSinceWorkout} ${daysSinceWorkout === 1 ? 'dag' : 'dagen'} inactief`,
            colorClass: 'border-red-500'
          })
        }
      } else {
        // Never worked out
        alerts.push({
          type: 'inactive',
          clientId: client.id,
          clientName: client.full_name || 'Onbekend',
          description: 'Nog geen workout',
          colorClass: 'border-red-500'
        })
      }

      // 2. Program expiring - expires within 7 days
      if (client.daysLeft !== null && client.daysLeft > 0 && client.daysLeft <= 7) {
        alerts.push({
          type: 'program_expiring',
          clientId: client.id,
          clientName: client.full_name || 'Onbekend',
          description: `Programma loopt af in ${client.daysLeft} ${client.daysLeft === 1 ? 'dag' : 'dagen'}`,
          colorClass: 'border-orange-500'
        })
      }

      // 3. Low compliance - < 40%
      if (client.compliance < 40) {
        alerts.push({
          type: 'low_compliance',
          clientId: client.id,
          clientName: client.full_name || 'Onbekend',
          description: `${client.compliance}% compliance`,
          colorClass: 'border-yellow-500'
        })
      }

      // 4. No program - client has no active program
      if (!client.activeProgram) {
        alerts.push({
          type: 'no_program',
          clientId: client.id,
          clientName: client.full_name || 'Onbekend',
          description: 'Geen actief programma',
          colorClass: 'border-zinc-600'
        })
      }
    })

    return alerts
  }

  async function addClient(email: string) {
    const { data: clientProfile } = await supabase
      .from('profiles').select('*').eq('email', email).single()
    if (!clientProfile) { alert('Geen gebruiker gevonden.'); return }
    if (!profile) return
    const { error } = await supabase
      .from('coach_client')
      .insert({ coach_id: profile.id, client_id: clientProfile.id })
    if (error) { alert('Fout: ' + error.message); return }
    await load()
  }

  const redClients = clients.filter(c => getStatusColor(c) === 'red').length
  const greenClients = clients.filter(c => getStatusColor(c) === 'green').length

  if (loading) return <PageSpinner />

  if (error) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-6">
      <div className="text-center">
        <p className="text-4xl mb-3">⚠️</p>
        <p className="text-red-400 font-bold mb-2">Fout bij laden</p>
        <p className="text-zinc-500 text-sm mb-4">{error}</p>
        <button onClick={() => { setError(null); setLoading(true); load() }}
          className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-6 py-2 rounded-xl text-sm transition">
          Opnieuw proberen
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      {/* Header */}
      <div className="bg-zinc-900 px-5 pt-12 pb-5 border-b border-zinc-800">
        <p className="text-orange-500 text-xs font-bold tracking-widest uppercase mb-1">Coach Dashboard</p>
        <h1 className="text-white text-2xl font-black">Hey {profile?.full_name?.split(' ')[0]} 👋</h1>
        <div className="flex gap-3 mt-4">
          <StatBox value={clients.length} label="Clients" />
          <StatBox value={redClients} label="Aandacht nodig" highlight={redClients > 0 ? 'red' : undefined} />
          <StatBox value={greenClients} label="Op schema" color="text-green-400" />
        </div>
      </div>

      {/* Alerts Section */}
      {(() => {
        const alerts = computeAlerts()
        if (alerts.length === 0) return null

        return (
          <div className="bg-zinc-900 px-5 py-4 border-b border-zinc-800">
            <div className="flex items-center gap-3 mb-3">
              <p className="text-orange-500 text-xs font-bold tracking-widest uppercase">⚠️ Aandacht nodig ({alerts.length})</p>
            </div>
            <div className="overflow-x-auto pb-2 -mx-5 px-5">
              <div className="flex gap-2 w-max">
                {alerts.map((alert, idx) => (
                  <button
                    key={`${alert.clientId}-${alert.type}-${idx}`}
                    onClick={() => router.push(`/portal/coach/client/${alert.clientId}`)}
                    className={`flex-shrink-0 bg-zinc-900 border-l-4 ${alert.colorClass} rounded-lg px-3 py-2
                                 hover:bg-zinc-800 transition cursor-pointer min-w-max`}
                  >
                    <p className="text-white text-sm font-semibold truncate max-w-xs">
                      {alert.clientName}
                    </p>
                    <p className="text-zinc-400 text-xs truncate max-w-xs">
                      {alert.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Tabs */}
      <div className="flex bg-zinc-900 border-b border-zinc-800" role="tablist">
        {[
          { key: 'clients', label: '👥 Clients' },
          { key: 'programs', label: '📋 Programma Builder' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as 'clients' | 'programs')}
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
              <>
                {/* Search */}
                {clients.length > 10 && (
                  <input
                    type="text"
                    placeholder="Zoek client..."
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setVisibleCount(20) }}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3
                               text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-orange-500"
                  />
                )}
                {(() => {
                  const filtered = searchQuery
                    ? clients.filter(c => c.full_name?.toLowerCase().includes(searchQuery.toLowerCase()))
                    : clients
                  const visible = filtered.slice(0, visibleCount)
                  const hasMore = filtered.length > visibleCount
                  return (
                    <>
                      <div className="space-y-3">
                        {visible.map(client => (
                          <ClientCard
                            key={client.id}
                            client={client}
                            statusColor={getStatusColor(client)}
                            onClick={() => router.push(`/portal/coach/client/${client.id}`)}
                          />
                        ))}
                      </div>
                      {hasMore && (
                        <button
                          onClick={() => setVisibleCount(prev => prev + 20)}
                          className="w-full py-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-400
                                     hover:text-white hover:border-orange-500/40 font-bold text-sm transition"
                        >
                          Meer laden ({filtered.length - visibleCount} overig)
                        </button>
                      )}
                    </>
                  )
                })()}
              </>
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
            <ProgramBuilder coachId={profile!.id} clients={clients as Array<{ id: string; full_name: string }>} />
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
