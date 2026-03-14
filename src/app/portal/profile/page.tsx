'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useAccentColor } from '@/hooks/useAccentColor'
import { profileService } from '@/lib/services/profileService'
import { createClient } from '@/lib/supabase/client'
import { PageSpinner } from '@/components/ui/Spinner'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { NotificationSettings } from '@/components/ui/NotificationSettings'
import { ACCENT_COLORS, ROLE_LABELS } from '@/utils/constants'
import { validateName } from '@/lib/validation'

export default function ProfilePage() {
  const { profile, loading, signOut, refreshProfile } = useAuth()
  const { accentColor, setAccentColor } = useAccentColor()
  const router = useRouter()
  const supabase = createClient()

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [fullName, setFullName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [inviteCount, setInviteCount] = useState(0)
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [inviteCopied, setInviteCopied] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)

  // Sync fullName when profile loads
  useEffect(() => {
    if (profile?.full_name) {
      setFullName(profile.full_name)
    }
  }, [profile?.full_name])

  // Load referral code and real signup count from API
  useEffect(() => {
    if (!profile?.id) return
    fetch('/api/referral')
      .then(res => res.json())
      .then(data => {
        setReferralCode(data.code ?? null)
        setInviteCount(data.signupCount ?? 0)
      })
      .catch(err => console.error('Referral load error:', err))
  }, [profile?.id])

  async function saveProfile() {
    if (!profile) return

    const validation = validateName(fullName)
    if (!validation.valid) {
      setNameError(validation.error ?? 'Ongeldige naam')
      return
    }
    setNameError(null)

    setSaving(true)
    const success = await profileService.updateName(profile.id, fullName)
    if (success) {
      await refreshProfile()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
    setSaving(false)
  }

  async function handleExportData() {
    setExporting(true)
    try {
      const response = await fetch('/api/export')
      if (!response.ok) throw new Error('Export mislukt')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `9tofit-export-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export error:', error)
      alert('Exporteren mislukt. Probeer het later opnieuw.')
    } finally {
      setExporting(false)
    }
  }

  function handleInvite() {
    const refParam = referralCode ? `?ref=${referralCode}` : ''
    const inviteUrl = `https://app.9tofit.nl/portal/login${refParam}`
    const inviteText = `Ik train met 9toFit Performance Coaching! Probeer het zelf: ${inviteUrl}`

    if (navigator.share) {
      navigator.share({ title: '9toFit', text: inviteText, url: inviteUrl }).catch(() => {})
    } else {
      navigator.clipboard.writeText(inviteText)
    }
    setInviteCopied(true)
    setTimeout(() => setInviteCopied(false), 2000)
  }

  async function handleSharePR() {
    // Fetch the user's top PR
    const { data: records } = await supabase
      .from('exercise_logs')
      .select('weight_kg, exercises(name)')
      .eq('client_id', profile?.id ?? '')
      .order('weight_kg', { ascending: false })
      .limit(1)

    const topPR = records?.[0]
    const exerciseName = (topPR?.exercises as any)?.name ?? 'een oefening'
    const weight = topPR?.weight_kg ?? 0
    const firstName = profile?.full_name?.split(' ')[0] ?? ''

    const shareText = weight > 0
      ? `${firstName} heeft een nieuw PR gezet! 🏆\n\n${weight} kg op ${exerciseName} 💪🔥\n\nTrain jij ook mee? app.9tofit.nl`
      : `${firstName} traint met 9toFit Performance Coaching! 💪\n\nTrain jij ook mee? app.9tofit.nl`

    if (navigator.share) {
      try {
        await navigator.share({ title: '9toFit — Nieuw PR!', text: shareText })
      } catch { /* user cancelled share */ }
    } else {
      navigator.clipboard.writeText(shareText)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    }
  }

  if (loading) return <PageSpinner />

  const initials = (fullName || profile?.email || '?').charAt(0).toUpperCase()
  const inviteRewardUnlocked = inviteCount >= 3

  return (
    <div className="min-h-screen bg-zinc-950 pb-28">

      <PageHeader label="Instellingen" title="Jouw profiel" />

      <div className="px-4 py-5 space-y-4">

        {/* Avatar + name */}
        <Card className="p-5 flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center
                        text-white font-black text-2xl flex-shrink-0"
            style={{ backgroundColor: accentColor }}
            aria-hidden="true"
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-lg truncate">{profile?.full_name || 'Naam instellen'}</p>
            <p className="text-zinc-500 text-sm truncate">{profile?.email}</p>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-bold mt-1.5 inline-block"
              style={{ backgroundColor: accentColor + '33', color: accentColor }}
            >
              {ROLE_LABELS[profile?.role ?? 'client'] ?? 'Atleet'}
            </span>
          </div>
        </Card>

        {/* Name editor */}
        <Card className="space-y-3">
          <p className="text-white font-bold text-sm">Naam wijzigen</p>
          <Input
            type="text"
            value={fullName}
            onChange={e => { setFullName(e.target.value); setNameError(null) }}
            onKeyDown={e => e.key === 'Enter' && saveProfile()}
            placeholder="Jouw volledige naam"
          />
          {nameError && <p className="text-red-400 text-xs">{nameError}</p>}
          <Button
            onClick={saveProfile}
            disabled={saving || fullName === profile?.full_name}
            loading={saving}
            fullWidth
          >
            {saved ? '✓ Opgeslagen!' : 'Opslaan'}
          </Button>
        </Card>

        {/* Accent color picker — compact circles */}
        <Card className="space-y-3">
          <div>
            <p className="text-white font-bold text-sm">Accent kleur</p>
            <p className="text-zinc-500 text-xs mt-0.5">Pas de kleur van de app aan</p>
          </div>
          <div className="flex items-center gap-3">
            {ACCENT_COLORS.map(color => {
              const isActive = accentColor === color.hex
              return (
                <button
                  key={color.hex}
                  onClick={() => setAccentColor(color.hex)}
                  title={color.name}
                  className={`relative w-10 h-10 rounded-full transition-all active:scale-90 flex-shrink-0 ${
                    isActive ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-110' : 'hover:scale-105 opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: color.hex }}
                  aria-label={`Kleur ${color.name}${isActive ? ' (geselecteerd)' : ''}`}
                  aria-pressed={isActive}
                >
                  {isActive && (
                    <span className="absolute inset-0 flex items-center justify-center text-white font-black text-xs">
                      ✓
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </Card>

        {/* Share PRs */}
        <Card className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-500/20 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
              🏆
            </div>
            <div className="flex-1">
              <p className="text-white font-bold text-sm">Deel je PRs</p>
              <p className="text-zinc-500 text-xs mt-0.5">Laat je vrienden zien wat je hebt bereikt</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSharePR}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-bold
                         py-2.5 px-4 rounded-xl text-sm transition active:scale-95"
            >
              {shareCopied ? '✓ Gekopieerd!' : '📤 Deel je beste PR'}
            </button>
            <button
              onClick={() => router.push('/portal/records')}
              className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400
                         font-bold py-2.5 px-4 rounded-xl text-sm transition active:scale-95"
            >
              Bekijk →
            </button>
          </div>
        </Card>

        {/* Invite friends */}
        <Card className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
              👥
            </div>
            <div className="flex-1">
              <p className="text-white font-bold text-sm">Vrienden uitnodigen</p>
              <p className="text-zinc-500 text-xs mt-0.5">
                {inviteRewardUnlocked
                  ? '🎉 Beloning ontgrendeld! Geniet van je Early Supporter badge'
                  : `Nodig 3 vrienden uit en ontgrendel de Early Supporter badge`}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-zinc-500 text-[10px] font-bold">VOORTGANG</span>
              <span className="text-zinc-400 text-xs font-bold">{Math.min(inviteCount, 3)}/3</span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  inviteRewardUnlocked ? 'bg-green-500' : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(100, (inviteCount / 3) * 100)}%` }}
              />
            </div>
          </div>

          {/* Reward badge */}
          {inviteRewardUnlocked && (
            <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl px-3 py-2.5">
              <span className="text-2xl">⭐</span>
              <div>
                <p className="text-green-400 font-bold text-xs">Early Supporter</p>
                <p className="text-zinc-500 text-[10px]">Bedankt voor het delen van 9toFit!</p>
              </div>
            </div>
          )}

          <button
            onClick={handleInvite}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold
                       py-2.5 rounded-xl text-sm transition active:scale-95"
          >
            {inviteCopied ? '✓ Verstuurd!' : '🔗 Deel uitnodigingslink'}
          </button>
        </Card>

        {/* Notification Settings */}
        <NotificationSettings />

        {/* Account info */}
        <Card className="space-y-3">
          <p className="text-white font-bold text-sm">Accountgegevens</p>
          <div className="flex items-center justify-between py-1 border-b border-zinc-800">
            <span className="text-zinc-500 text-sm">E-mailadres</span>
            <span className="text-zinc-300 text-sm">{profile?.email}</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-zinc-500 text-sm">Rol</span>
            <span className="text-zinc-300 text-sm">{ROLE_LABELS[profile?.role ?? 'client'] ?? 'Atleet'}</span>
          </div>
        </Card>

        {/* Data export */}
        <Card className="space-y-3">
          <div>
            <p className="text-white font-bold text-sm">Gegevens exporteren</p>
            <p className="text-zinc-500 text-xs mt-0.5">Download al je data als JSON bestand</p>
          </div>
          <Button
            onClick={handleExportData}
            disabled={exporting}
            loading={exporting}
            fullWidth
          >
            {exporting ? 'Downloaden...' : 'Download mijn data'}
          </Button>
        </Card>

        {/* Privacy info — compact */}
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center text-lg flex-shrink-0">
              🔒
            </div>
            <div>
              <p className="text-white font-bold text-sm">Privacy & Gegevens</p>
              <p className="text-zinc-500 text-xs mt-0.5">Versleuteld opgeslagen — alleen jij en je coach</p>
            </div>
          </div>
        </Card>

        {/* Sign out */}
        <button
          onClick={signOut}
          className="w-full text-zinc-500 hover:text-zinc-300 font-bold py-3 text-sm transition"
        >
          Uitloggen →
        </button>

        <p className="text-zinc-700 text-xs text-center pb-2">9toFit Performance Platform</p>
      </div>
    </div>
  )
}
