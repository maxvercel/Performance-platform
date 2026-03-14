'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DailyReadiness } from '@/types'

interface ReadinessCheckinProps {
  userId: string
  onScoreUpdate?: (score: number | null) => void
}

const FACTORS = [
  { key: 'sleep_quality',    label: 'Slaapkwaliteit',  emoji: ['😵', '😴', '😐', '😊', '🌟'], low: 'Slecht', high: 'Uitstekend' },
  { key: 'energy_level',     label: 'Energieniveau',    emoji: ['🪫', '😶', '😐', '⚡', '🔋'], low: 'Leeg', high: 'Vol energie' },
  { key: 'muscle_soreness',  label: 'Spierpijn',       emoji: ['🤕', '😣', '😐', '💪', '✨'], low: 'Veel pijn', high: 'Geen pijn' },
  { key: 'stress_level',     label: 'Stressniveau',     emoji: ['🤯', '😰', '😐', '😌', '🧘'], low: 'Veel stress', high: 'Ontspannen' },
] as const

type FactorKey = typeof FACTORS[number]['key']

function getLocalDate(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/**
 * Sleep scoring based on research (Hirshkowitz et al. 2015, NSF guidelines):
 * - <5h: severely insufficient → 1
 * - 5-6h: insufficient → 2
 * - 6-7h: borderline → 3
 * - 7-9h: optimal → 5
 * - 9-10h: slightly excessive but acceptable → 4
 * - >10h: excessive (may indicate illness/overtraining) → 3
 */
function sleepScore(hours: number): number {
  if (hours >= 7 && hours <= 9) return 5
  if (hours > 9 && hours <= 10) return 4
  if (hours >= 6 && hours < 7) return 3
  if (hours > 10) return 3
  if (hours >= 5) return 2
  return 1
}

function sleepLabel(hours: number): string {
  if (hours >= 7 && hours <= 9) return '✅ Optimaal'
  if (hours > 9 && hours <= 10) return '😴 Iets veel'
  if (hours >= 6 && hours < 7) return '⚠️ Borderline'
  if (hours > 10) return '⚠️ Te veel'
  if (hours >= 5) return '❌ Te weinig'
  return '❌ Ernstig tekort'
}

function calcReadinessScore(data: Partial<Record<FactorKey, number>>, sleepHours: number | null): number {
  const values: number[] = []
  for (const f of FACTORS) {
    const v = data[f.key]
    if (v) values.push(v)
  }
  if (sleepHours !== null) {
    values.push(sleepScore(sleepHours))
  }
  if (values.length === 0) return 0
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
}

function scoreColor(score: number): string {
  if (score >= 4) return 'text-green-400'
  if (score >= 3) return 'text-yellow-400'
  if (score >= 2) return 'text-orange-400'
  return 'text-red-400'
}

function scoreBg(score: number): string {
  if (score >= 4) return 'bg-green-500'
  if (score >= 3) return 'bg-yellow-500'
  if (score >= 2) return 'bg-orange-500'
  return 'bg-red-500'
}

function scoreLabel(score: number): string {
  if (score >= 4.5) return 'Top! Klaar voor alles'
  if (score >= 3.5) return 'Goed — train normaal'
  if (score >= 2.5) return 'Oké — pas op met zware sets'
  if (score >= 1.5) return 'Vermoeid — train lichter'
  return 'Rust vandaag'
}

export default function ReadinessCheckin({ userId, onScoreUpdate }: ReadinessCheckinProps) {
  const supabase = createClient()
  const today = getLocalDate()

  const [expanded, setExpanded] = useState(false)
  const [sleepHours, setSleepHours] = useState<string>('')
  const [factors, setFactors] = useState<Partial<Record<FactorKey, number>>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [existingId, setExistingId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Load existing check-in for today
  useEffect(() => {
    if (!userId) return
    loadToday()
  }, [userId])

  async function loadToday() {
    const { data } = await supabase
      .from('daily_readiness')
      .select('*')
      .eq('client_id', userId)
      .eq('date', today)
      .maybeSingle()

    if (data) {
      setExistingId(data.id)
      setSleepHours(data.sleep_hours?.toString() ?? '')
      setNotes(data.notes ?? '')
      const loaded: Partial<Record<FactorKey, number>> = {}
      for (const f of FACTORS) {
        const val = (data as any)[f.key]
        if (val) loaded[f.key] = val
      }
      setFactors(loaded)
      setSaved(true)
      if (data.readiness_score) onScoreUpdate?.(data.readiness_score)
    }
  }

  const setFactor = useCallback((key: FactorKey, value: number) => {
    setFactors(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }, [])

  const score = calcReadinessScore(factors, sleepHours ? parseFloat(sleepHours) : null)
  const filledCount = Object.keys(factors).length + (sleepHours ? 1 : 0)
  const isComplete = filledCount >= 3 // At least 3 of 5 fields filled

  async function saveReadiness() {
    if (!isComplete) return
    setSaving(true)

    const payload = {
      client_id: userId,
      date: today,
      sleep_hours: sleepHours ? parseFloat(sleepHours) : null,
      sleep_quality: factors.sleep_quality ?? null,
      energy_level: factors.energy_level ?? null,
      stress_level: factors.stress_level ?? null,
      muscle_soreness: factors.muscle_soreness ?? null,
      motivation: null,
      notes: notes || null,
      readiness_score: score,
    }

    let saveError = null
    if (existingId) {
      const { error: updateErr } = await supabase.from('daily_readiness').update(payload).eq('id', existingId)
      saveError = updateErr
    } else {
      const { data, error: insertErr } = await supabase.from('daily_readiness').insert(payload).select('id').single()
      saveError = insertErr
      if (data) setExistingId(data.id)
    }

    setSaving(false)

    if (saveError) {
      console.error('Readiness save error:', saveError)
      setError('Opslaan mislukt, probeer opnieuw')
      setTimeout(() => setError(null), 3000)
      return
    }

    setSaved(true)
    setExpanded(false) // Auto-collapse after save
    onScoreUpdate?.(score)
  }

  // Collapsed state — show score or prompt
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-3
                   hover:border-zinc-700 transition active:opacity-80"
      >
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
          saved ? 'bg-green-500/10 border border-green-500/30' : 'bg-orange-500/10 border border-orange-500/30'
        }`}>
          {saved ? '✅' : '📋'}
        </div>
        <div className="flex-1 text-left">
          <p className="text-white font-bold text-sm">
            {saved ? 'Readiness Check-in' : 'Dagelijkse Check-in'}
          </p>
          {saved && score > 0 ? (
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`font-black text-lg ${scoreColor(score)}`}>{score.toFixed(1)}</span>
              <span className="text-zinc-500 text-xs">/5 — {scoreLabel(score)}</span>
            </div>
          ) : (
            <p className="text-zinc-500 text-xs mt-0.5">
              Vul in hoe je je voelt voor optimale training
            </p>
          )}
        </div>
        <span className="text-zinc-600 text-sm">{saved ? '✏️' : '→'}</span>
      </button>
    )
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div>
          <h3 className="text-white font-bold text-sm">Dagelijkse Check-in</h3>
          <p className="text-zinc-500 text-xs mt-0.5">Hoe voel je je vandaag?</p>
        </div>
        <button
          onClick={() => setExpanded(false)}
          className="text-zinc-500 text-xs bg-zinc-800 px-2.5 py-1 rounded-lg hover:bg-zinc-700 transition"
        >
          Inklappen
        </button>
      </div>

      {/* Score display */}
      {score > 0 && (
        <div className="mx-4 mb-3 bg-zinc-800/60 rounded-xl p-3 flex items-center gap-3">
          <div className="relative w-14 h-14 flex-shrink-0">
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="24" fill="none" stroke="#27272a" strokeWidth="4" />
              <circle
                cx="28" cy="28" r="24" fill="none"
                strokeWidth="4"
                strokeLinecap="round"
                className={scoreBg(score).replace('bg-', 'stroke-')}
                strokeDasharray={`${(score / 5) * 150.8} 150.8`}
              />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center font-black text-sm ${scoreColor(score)}`}>
              {score.toFixed(1)}
            </span>
          </div>
          <div>
            <p className={`font-bold text-sm ${scoreColor(score)}`}>{scoreLabel(score)}</p>
            <p className="text-zinc-600 text-xs mt-0.5">{filledCount}/5 factoren ingevuld</p>
          </div>
        </div>
      )}

      {/* Sleep hours */}
      <div className="px-4 mb-3">
        <label className="text-zinc-400 text-xs font-semibold mb-1.5 block">
          Slaap (uren)
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            min="0"
            max="14"
            value={sleepHours}
            onChange={e => { setSleepHours(e.target.value); setSaved(false) }}
            placeholder="7.5"
            className="w-20 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm
                       text-center focus:outline-none focus:border-orange-500 transition"
          />
          <span className="text-zinc-500 text-xs">uur</span>
          {sleepHours && (
            <span className="text-zinc-600 text-xs ml-auto">
              {sleepLabel(parseFloat(sleepHours))}
            </span>
          )}
        </div>
      </div>

      {/* Factor sliders */}
      <div className="px-4 space-y-3 mb-3">
        {FACTORS.map(f => {
          const value = factors[f.key] ?? 0
          return (
            <div key={f.key}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-zinc-400 text-xs font-semibold">{f.label}</span>
                {value > 0 && (
                  <span className="text-xs">{f.emoji[value - 1]}</span>
                )}
              </div>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map(v => (
                  <button
                    key={v}
                    onClick={() => setFactor(f.key, v)}
                    aria-label={`${f.label} ${v} van 5`}
                    className={`flex-1 h-10 rounded-lg text-xs font-bold transition ${
                      value === v
                        ? v <= 2 ? 'bg-red-500/30 text-red-300 border border-red-500/50'
                        : v === 3 ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/50'
                        : 'bg-green-500/30 text-green-300 border border-green-500/50'
                        : 'bg-zinc-800 text-zinc-600 border border-zinc-700 hover:border-zinc-600'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div className="flex justify-between mt-0.5">
                <span className="text-zinc-700 text-[10px]">{f.low}</span>
                <span className="text-zinc-700 text-[10px]">{f.high}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Notes */}
      <div className="px-4 mb-3">
        <label className="text-zinc-400 text-xs font-semibold mb-1.5 block">
          Notities (optioneel)
        </label>
        <textarea
          value={notes}
          onChange={e => { setNotes(e.target.value); setSaved(false) }}
          placeholder="Bv. slecht geslapen, schouder licht geblesseerd..."
          rows={2}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm
                     placeholder-zinc-600 focus:outline-none focus:border-orange-500 transition resize-none"
        />
      </div>

      {/* Save button */}
      <div className="px-4 pb-4">
        <button
          onClick={saveReadiness}
          disabled={!isComplete || saving || saved}
          className={`w-full py-3 rounded-xl font-bold text-sm transition ${
            saved
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : isComplete
                ? 'bg-orange-500 text-white hover:bg-orange-600 active:opacity-80'
                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
          }`}
        >
          {saving ? 'Opslaan...' : saved ? '✓ Opgeslagen' : `Opslaan (${filledCount}/5)`}
        </button>
        {error && (
          <p className="text-red-400 text-xs mt-2 text-center">{error}</p>
        )}
      </div>
    </div>
  )
}
