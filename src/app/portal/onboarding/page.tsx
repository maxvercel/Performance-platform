'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const GOALS = [
  { val: 'strength', emoji: '💪', label: 'Kracht opbouwen', desc: 'Sterker worden en meer tillen' },
  { val: 'hypertrophy', emoji: '🏋️', label: 'Spiermassa', desc: 'Spieren opbouwen en groeien' },
  { val: 'fat_loss', emoji: '🔥', label: 'Vetverlies', desc: 'Afvallen en strakker worden' },
  { val: 'athletic', emoji: '⚡', label: 'Atletisch', desc: 'Prestaties en conditie verbeteren' },
  { val: 'general', emoji: '🌟', label: 'Algemene fitness', desc: 'Gezond en fit blijven' },
]

export default function OnboardingPage() {
  const supabase = createClient()
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/portal/login'); return }
      setUserId(user.id)
      supabase.from('profiles').select('full_name, goal').eq('id', user.id).single()
        .then(({ data }) => {
          if (data?.full_name) setName(data.full_name)
          if (data?.goal) setGoal(data.goal)
        })
    })
  }, [])

  async function saveAndFinish() {
    if (!name.trim() || !userId) return
    setSaving(true)
    await supabase.from('profiles').update({
      full_name: name.trim(),
      goal: goal || 'general',
      onboarded: true,
    }).eq('id', userId)
    setSaving(false)
    router.push('/portal/dashboard')
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2 pt-14 pb-6">
        {[1, 2, 3].map(s => (
          <div
            key={s}
            className={`rounded-full transition-all duration-300 ${
              s === step ? 'w-8 h-2.5 bg-orange-500' :
              s < step ? 'w-2.5 h-2.5 bg-orange-500/60' :
              'w-2.5 h-2.5 bg-zinc-700'
            }`}
          />
        ))}
      </div>

      <div className="flex-1 px-6 flex flex-col">

        {/* ─── Step 1: Name ─── */}
        {step === 1 && (
          <>
            <div className="text-center mb-10">
              <div className="text-7xl mb-5">👋</div>
              <h1 className="text-white text-3xl font-black mb-3">Welkom bij 9toFit!</h1>
              <p className="text-zinc-500 text-sm leading-relaxed">
                Laten we je profiel instellen.<br />Dit duurt maar 1 minuut.
              </p>
            </div>

            <div className="flex-1 space-y-4">
              <label className="text-zinc-400 text-sm font-semibold block">Wat is je naam?</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && name.trim() && setStep(2)}
                placeholder="bijv. Max Trenten"
                autoFocus
                className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl px-5 py-4 text-white text-lg
                           focus:outline-none focus:border-orange-500 transition placeholder-zinc-600"
              />
            </div>

            <button
              onClick={() => name.trim() && setStep(2)}
              disabled={!name.trim()}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-30
                         text-white font-black py-4 rounded-2xl text-lg transition mb-10 mt-8"
            >
              Doorgaan →
            </button>
          </>
        )}

        {/* ─── Step 2: Goal ─── */}
        {step === 2 && (
          <>
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">🎯</div>
              <h1 className="text-white text-2xl font-black mb-2">
                Wat is jouw doel, {name.split(' ')[0]}?
              </h1>
              <p className="text-zinc-500 text-sm">
                Je coach gebruikt dit om het perfecte programma te kiezen.
              </p>
            </div>

            <div className="space-y-3 flex-1">
              {GOALS.map(g => (
                <button
                  key={g.val}
                  onClick={() => setGoal(g.val)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition ${
                    goal === g.val
                      ? 'bg-orange-500/20 border-orange-500'
                      : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'
                  }`}
                >
                  <span className="text-3xl flex-shrink-0">{g.emoji}</span>
                  <div className="text-left flex-1">
                    <p className={`font-bold text-sm ${goal === g.val ? 'text-white' : 'text-zinc-300'}`}>
                      {g.label}
                    </p>
                    <p className="text-zinc-500 text-xs mt-0.5">{g.desc}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    goal === g.val ? 'border-orange-500 bg-orange-500' : 'border-zinc-600'
                  }`}>
                    {goal === g.val && <span className="text-white text-xs">✓</span>}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-3 mt-6 mb-10">
              <button
                onClick={() => setStep(1)}
                className="flex-1 bg-zinc-800 text-zinc-400 font-bold py-4 rounded-2xl text-sm transition"
              >
                ← Terug
              </button>
              <button
                onClick={() => goal && setStep(3)}
                disabled={!goal}
                className="flex-[2] bg-orange-500 hover:bg-orange-600 disabled:opacity-30
                           text-white font-black py-4 rounded-2xl text-lg transition"
              >
                Doorgaan →
              </button>
            </div>
          </>
        )}

        {/* ─── Step 3: Launch ─── */}
        {step === 3 && (
          <>
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="text-8xl mb-6" style={{ animation: 'bounce 1s infinite' }}>🚀</div>
              <h1 className="text-white text-3xl font-black mb-3">
                Let&apos;s go, {name.split(' ')[0]}!
              </h1>
              <p className="text-zinc-400 text-base mb-2">Je profiel is klaar.</p>
              <p className="text-zinc-600 text-sm">Je coach staat klaar om je te begeleiden.</p>

              {/* Profile preview card */}
              <div className="mt-8 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 w-full max-w-xs">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-orange-500 rounded-full flex items-center justify-center
                                  text-white font-black text-2xl flex-shrink-0">
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <p className="text-white font-bold">{name}</p>
                    <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-bold mt-1 inline-block">
                      {GOALS.find(g => g.val === goal)?.emoji} {GOALS.find(g => g.val === goal)?.label ?? 'Fitness'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={saveAndFinish}
              disabled={saving}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40
                         text-white font-black py-5 rounded-2xl text-xl transition mb-10"
            >
              {saving ? 'Opslaan...' : 'Start je journey 🔥'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
