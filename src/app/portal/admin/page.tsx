'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { PageSpinner } from '@/components/ui/Spinner'
import { useRouter } from 'next/navigation'

interface CoachOverview {
  id: string
  full_name: string | null
  email: string
  clientCount: number
  activePrograms: number
  totalWorkouts7d: number
  lastActivity: string | null
}

interface ClientOverview {
  id: string
  full_name: string | null
  email: string
  role: string
  coachName: string | null
  activeProgram: string | null
  workoutsThisWeek: number
  lastWorkout: string | null
  totalExerciseLogs: number
}

export default function AdminDashboard() {
  const supabase = createClient()
  const router = useRouter()
  const { profile, loading: authLoading } = useAuth()

  const [coaches, setCoaches] = useState<CoachOverview[]>([])
  const [clients, setClients] = useState<ClientOverview[]>([])
  const [stats, setStats] = useState({ totalUsers: 0, totalCoaches: 0, totalClients: 0, totalWorkouts: 0 })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'coaches' | 'clients'>('overview')
  const [changingRole, setChangingRole] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!profile || profile.role !== 'admin') {
      router.push('/portal/dashboard')
      return
    }
    loadAdminData()
  }, [authLoading, profile?.id])

  async function loadAdminData() {
    if (!profile) return

    // Alle profielen ophalen
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, created_at')

    if (!allProfiles) { setLoading(false); return }

    const coachProfiles = allProfiles.filter(p => p.role === 'coach')
    const clientProfiles = allProfiles.filter(p => p.role === 'client')

    // Coach-client relaties
    const { data: coachClients } = await supabase
      .from('coach_client')
      .select('coach_id, client_id, active')
      .eq('active', true)

    // Actieve programma's
    const { data: programs } = await supabase
      .from('programs')
      .select('id, client_id, coach_id, name, is_active')
      .eq('is_active', true)

    // Workout logs afgelopen 7 dagen
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const { data: recentWorkouts } = await supabase
      .from('workout_logs')
      .select('id, client_id, logged_at, completed_at')
      .gte('logged_at', weekAgo.toISOString().split('T')[0])

    // Alle workout logs (voor totaal)
    const { data: allWorkouts } = await supabase
      .from('workout_logs')
      .select('id, client_id, logged_at, completed_at')
      .not('completed_at', 'is', null)

    // Exercise logs count per client (afgelopen 30 dagen)
    const monthAgo = new Date()
    monthAgo.setDate(monthAgo.getDate() - 30)

    // Stats
    setStats({
      totalUsers: allProfiles.length,
      totalCoaches: coachProfiles.length,
      totalClients: clientProfiles.length,
      totalWorkouts: allWorkouts?.length ?? 0,
    })

    // Coach overzichten
    const coachOverviews: CoachOverview[] = coachProfiles.map(coach => {
      const myClients = coachClients?.filter(cc => cc.coach_id === coach.id) ?? []
      const myPrograms = programs?.filter(p => p.coach_id === coach.id) ?? []
      const clientIds = new Set(myClients.map(cc => cc.client_id))
      const myWorkouts = recentWorkouts?.filter(w => clientIds.has(w.client_id)) ?? []
      const latestWorkout = myWorkouts.sort((a, b) =>
        new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()
      )[0]

      return {
        id: coach.id,
        full_name: coach.full_name,
        email: coach.email ?? '',
        clientCount: myClients.length,
        activePrograms: myPrograms.length,
        totalWorkouts7d: myWorkouts.filter(w => w.completed_at).length,
        lastActivity: latestWorkout?.logged_at ?? null,
      }
    })
    setCoaches(coachOverviews)

    // Client overzichten
    // All users overview (for role management)
    const allUserOverviews: ClientOverview[] = allProfiles.map(user => {
      const myCoachRel = coachClients?.find(cc => cc.client_id === user.id)
      const myCoach = myCoachRel ? coachProfiles.find(c => c.id === myCoachRel.coach_id) ?? allProfiles.find(p => p.id === myCoachRel.coach_id) : null
      const myProgram = programs?.find(p => p.client_id === user.id)
      const myWorkouts = recentWorkouts?.filter(w => w.client_id === user.id) ?? []
      const myAllWorkouts = allWorkouts?.filter(w => w.client_id === user.id) ?? []
      const latestWorkout = myAllWorkouts.sort((a, b) =>
        new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()
      )[0]

      return {
        id: user.id,
        full_name: user.full_name,
        email: (user as any).email ?? '',
        role: (user as any).role ?? 'client',
        coachName: myCoach?.full_name ?? 'Geen coach',
        activeProgram: myProgram?.name ?? null,
        workoutsThisWeek: myWorkouts.filter(w => w.completed_at).length,
        lastWorkout: latestWorkout?.logged_at ?? null,
        totalExerciseLogs: 0,
      }
    })

    setClients(allUserOverviews)
    setLoading(false)
  }

  async function changeRole(userId: string, newRole: 'client' | 'coach' | 'admin') {
    setChangingRole(userId)
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)
    if (error) {
      alert('Fout bij rol wijzigen: ' + error.message)
    } else {
      // Reload data
      await loadAdminData()
    }
    setChangingRole(null)
  }

  if (authLoading || loading) return <PageSpinner />

  const formatDate = (d: string | null) => {
    if (!d) return '—'
    const date = new Date(d)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return 'Vandaag'
    if (diffDays === 1) return 'Gisteren'
    if (diffDays < 7) return `${diffDays} dagen geleden`
    return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="min-h-screen bg-zinc-950 pb-28">
      {/* Header */}
      <div className="relative overflow-hidden px-5 pt-12 pb-6 border-b border-zinc-800/50">
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 via-zinc-900 to-zinc-950" />
        <div className="relative z-10">
          <p className="text-red-500 text-[10px] font-black tracking-[0.25em] uppercase mb-1">Admin</p>
          <h1 className="text-white text-3xl font-black tracking-tight">Platform Overzicht</h1>
          <p className="text-zinc-500 text-sm mt-1">Alle coaches, cliënten en activiteit in één oogopslag.</p>
        </div>
      </div>

      <div className="px-4 py-5 space-y-4">
        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Totaal gebruikers" value={stats.totalUsers} color="text-white" />
          <StatCard label="Coaches" value={stats.totalCoaches} color="text-orange-400" />
          <StatCard label="Cliënten" value={stats.totalClients} color="text-blue-400" />
          <StatCard label="Workouts (totaal)" value={stats.totalWorkouts} color="text-green-400" />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap" role="tablist">
          {([
            { key: 'overview', label: 'Overzicht' },
            { key: 'coaches', label: `Coaches (${coaches.length})` },
            { key: 'clients', label: `Gebruikers (${clients.length})` },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              role="tab"
              aria-selected={activeTab === tab.key}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                activeTab === tab.key
                  ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                  : 'bg-zinc-800/60 text-zinc-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview tab */}
        {activeTab === 'overview' && (
          <div className="space-y-3">
            <SectionHeader title="Recente coaches activiteit" />
            {coaches.map(coach => (
              <div key={coach.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-bold text-sm">{coach.full_name || coach.email}</p>
                    <p className="text-zinc-500 text-xs mt-0.5">
                      {coach.clientCount} cliënten · {coach.activePrograms} actieve programma's
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-orange-400 text-lg font-black">{coach.totalWorkouts7d}</p>
                    <p className="text-zinc-600 text-[10px]">workouts/7d</p>
                  </div>
                </div>
                <p className="text-zinc-600 text-xs mt-2">Laatst actief: {formatDate(coach.lastActivity)}</p>
              </div>
            ))}

            <SectionHeader title="Cliënten zonder activiteit (7d)" />
            {clients.filter(c => c.workoutsThisWeek === 0).map(client => (
              <div key={client.id} className="bg-zinc-900 border border-red-500/20 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-bold text-sm">{client.full_name || client.email}</p>
                    <p className="text-zinc-500 text-xs">Coach: {client.coachName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-red-400 text-xs font-bold">Inactief</p>
                    <p className="text-zinc-600 text-[10px]">Laatste: {formatDate(client.lastWorkout)}</p>
                  </div>
                </div>
              </div>
            ))}
            {clients.filter(c => c.workoutsThisWeek === 0).length === 0 && (
              <p className="text-zinc-600 text-sm text-center py-4">Alle cliënten zijn actief deze week!</p>
            )}
          </div>
        )}

        {/* Coaches tab */}
        {activeTab === 'coaches' && (
          <div className="space-y-3">
            {coaches.map(coach => (
              <div key={coach.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <span className="text-orange-400 font-black text-sm">
                      {(coach.full_name || coach.email).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-bold text-sm">{coach.full_name || 'Naamloos'}</p>
                    <p className="text-zinc-500 text-xs">{coach.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <MiniStat label="Cliënten" value={coach.clientCount} />
                  <MiniStat label="Programma's" value={coach.activePrograms} />
                  <MiniStat label="Workouts/7d" value={coach.totalWorkouts7d} />
                </div>
                <p className="text-zinc-600 text-xs">Laatst actief: {formatDate(coach.lastActivity)}</p>
              </div>
            ))}
          </div>
        )}

        {/* Clients tab */}
        {activeTab === 'clients' && (
          <div className="space-y-3">
            <SectionHeader title="Gebruikers & Rollenbeheer" />
            <p className="text-zinc-500 text-xs">Wijs rollen toe aan gebruikers. Coaches krijgen een extra tab om hun cliënten te beheren.</p>
            {clients.map(client => (
              <div key={client.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-white font-bold text-sm">{client.full_name || client.email}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        client.role === 'admin' ? 'bg-red-500/20 text-red-400' :
                        client.role === 'coach' ? 'bg-orange-500/20 text-orange-400' :
                        'bg-zinc-800 text-zinc-500'
                      }`}>
                        {client.role}
                      </span>
                    </div>
                    <p className="text-zinc-500 text-xs">{client.email}</p>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    client.workoutsThisWeek > 0
                      ? 'bg-green-500/15 text-green-400'
                      : 'bg-red-500/15 text-red-400'
                  }`}>
                    {client.workoutsThisWeek > 0 ? `${client.workoutsThisWeek}x deze week` : 'Inactief'}
                  </span>
                </div>
                {/* Role toggle */}
                <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
                  <span className="text-zinc-500 text-xs mr-auto">Rol:</span>
                  {(['client', 'coach', 'admin'] as const).map(role => (
                    <button
                      key={role}
                      onClick={() => {
                        if (client.role !== role) changeRole(client.id, role)
                      }}
                      disabled={changingRole === client.id}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        client.role === role
                          ? role === 'admin'
                            ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/40'
                            : role === 'coach'
                            ? 'bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/40'
                            : 'bg-zinc-700 text-white ring-1 ring-zinc-600'
                          : 'bg-zinc-800/50 text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {changingRole === client.id ? '...' : role === 'client' ? 'Client' : role === 'coach' ? 'Coach' : 'Admin'}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">{label}</p>
      <p className={`${color} text-2xl font-black mt-1`}>{value}</p>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-zinc-800/50 rounded-xl p-2 text-center">
      <p className="text-white font-black text-base">{value}</p>
      <p className="text-zinc-500 text-[10px]">{label}</p>
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <p className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em] pt-2">{title}</p>
  )
}
