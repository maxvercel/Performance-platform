'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useAccentColor } from '@/hooks/useAccentColor'
import { profileService } from '@/lib/services/profileService'
import { PageSpinner } from '@/components/ui/Spinner'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { NotificationSettings } from '@/components/ui/NotificationSettings'
import { ACCENT_COLORS, ROLE_LABELS } from '@/utils/constants'
import { validateName } from '@/lib/validation'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

export default function ProfilePage() {
  const { profile, loading, signOut, refreshProfile } = useAuth()
  const { accentColor, setAccentColor } = useAccentColor()
  const router = useRouter()

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [fullName, setFullName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Sync fullName when profile loads
  useEffect(() => {
    if (profile?.full_name) {
      setFullName(profile.full_name)
    }
  }, [profile?.full_name])

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
      if (!response.ok) {
        throw new Error('Export mislukt')
      }

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

  function handleDeleteAccount() {
    setShowDeleteConfirm(true)
  }

  function handleDeleteConfirmed() {
    setShowDeleteConfirm(false)
    alert('Neem contact op met je coach om je account te verwijderen')
  }

  if (loading) return <PageSpinner />

  const initials = (fullName || profile?.email || '?').charAt(0).toUpperCase()

  return (
    <div className="min-h-screen bg-zinc-950 pb-28">

      <PageHeader label="Instellingen" title="Jouw profiel" />

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Account verwijderen?"
        description="Weet je zeker dat je je account wilt verwijderen? Dit kan niet ongedaan gemaakt worden."
        confirmText="Ja, verwijderen"
        cancelText="Annuleren"
        variant="danger"
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setShowDeleteConfirm(false)}
      />

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
          <p className="text-white font-bold">Naam wijzigen</p>
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

        {/* Accent color picker */}
        <Card className="space-y-4">
          <div>
            <p className="text-white font-bold">Accent kleur</p>
            <p className="text-zinc-500 text-xs mt-0.5">Pas de kleur van de app aan naar jouw voorkeur</p>
          </div>
          <div className="grid grid-cols-6 gap-3">
            {ACCENT_COLORS.map(color => {
              const isActive = accentColor === color.hex
              return (
                <button
                  key={color.hex}
                  onClick={() => setAccentColor(color.hex)}
                  title={color.name}
                  className={`relative w-full aspect-square rounded-2xl transition-all active:scale-90 ${
                    isActive ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-105' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: color.hex }}
                  aria-label={`Kleur ${color.name}${isActive ? ' (geselecteerd)' : ''}`}
                  aria-pressed={isActive}
                >
                  {isActive && (
                    <span className="absolute inset-0 flex items-center justify-center text-white font-black text-sm">
                      ✓
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <p className="text-zinc-600 text-xs">
            Geselecteerd: <span className="font-bold" style={{ color: accentColor }}>
              {ACCENT_COLORS.find(c => c.hex === accentColor)?.name ?? 'Aangepast'}
            </span>
          </p>
        </Card>

        {/* Notification Settings */}
        <NotificationSettings />

        {/* Account info */}
        <Card className="space-y-3">
          <p className="text-white font-bold">Accountgegevens</p>
          <div className="flex items-center justify-between py-1 border-b border-zinc-800">
            <span className="text-zinc-500 text-sm">E-mailadres</span>
            <span className="text-zinc-300 text-sm">{profile?.email}</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-zinc-500 text-sm">Rol</span>
            <span className="text-zinc-300 text-sm">{ROLE_LABELS[profile?.role ?? 'client'] ?? 'Atleet'}</span>
          </div>
        </Card>

        {/* PR Wall link */}
        <Card interactive onClick={() => router.push('/portal/records')} className="flex items-center gap-3">
          <span className="text-2xl">🏆</span>
          <div className="text-left flex-1">
            <p className="text-white font-bold text-sm">PR Muur</p>
            <p className="text-zinc-500 text-xs">Bekijk al je persoonlijke records</p>
          </div>
          <span className="text-zinc-600">→</span>
        </Card>

        {/* Data export */}
        <Card className="space-y-3">
          <div>
            <p className="text-white font-bold">Gegevens exporteren</p>
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

        {/* Privacy & Data */}
        <Card className="space-y-3">
          <div>
            <p className="text-white font-bold">Privacy & Gegevens</p>
            <p className="text-zinc-500 text-xs mt-0.5">Je data is veilig bij 9toFit</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-orange-500 mt-0.5">•</span>
              <p className="text-zinc-400 text-xs">Je gegevens worden versleuteld opgeslagen</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-orange-500 mt-0.5">•</span>
              <p className="text-zinc-400 text-xs">Alleen jij en je coach hebben toegang</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-orange-500 mt-0.5">•</span>
              <p className="text-zinc-400 text-xs">Je kunt altijd je data exporteren of verwijderen</p>
            </div>
          </div>
          <Button
            variant="danger"
            onClick={handleDeleteAccount}
            fullWidth
          >
            Account verwijderen
          </Button>
        </Card>

        {/* Sign out */}
        <Button variant="danger" fullWidth size="md" onClick={signOut}>
          Uitloggen →
        </Button>

        <p className="text-zinc-700 text-xs text-center pb-2">9toFit Performance Platform</p>
      </div>
    </div>
  )
}
