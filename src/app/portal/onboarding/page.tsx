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

const EXPERIENCE_LEVELS = [
  { val: 'beginner', emoji: '🌱', label: 'Beginner', desc: 'Minder dan 1 jaar trainervaring' },
  { val: 'intermediate', emoji: '💪', label: 'Gemiddeld', desc: '1-3 jaar trainervaring' },
  { val: 'advanced', emoji: '🏆', label: 'Gevorderd', desc: 'Meer dan 3 jaar trainervaring' },
]

const TRAINING_DAYS = [2, 3, 4, 5, 6]

export default function OnboardingPage() {
  const supabase = createClient()
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [experienceLevel, setExperienceLevel] = useState('')
  const [goal, setGoal] = useState('')
  const [trainingDays, setTrainingDays] = useState('')
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/portal/login'); return }
      setUserId(user.id)
      supabase.from('profiles').select('full_name, goal, height_cm, weight_kg, experience_level, training_days_per_week').eq('id', user.id).single()
        .then(({ data }) => {
          if (data?.full_name) setName(data.full_name)
          if (data?.goal) setGoal(data.goal)
          if (data?.height_cm) setHeightCm(data.height_cm.toString())
          if (data?.weight_kg) setWeightKg(data.weight_kg.toString())
          if (data?.experience_level) setExperienceLevel(data.experience_level)
          if (data?.training_days_per_week) setTrainingDays(data.training_days_per_week.toString())
        })
    })
  }, [])

  async function createNutritionTargets() {
    if (!userId || !weightKg || !goal) return

    const weight = parseFloat(weightKg)
    let calorieMultiplier, proteinMultiplier, carbsMultiplier, fatMultiplier

    if (goal === 'strength' || goal === 'hypertrophy') {
      calorieMultiplier = 35
      proteinMultiplier = 2
      carbsMultiplier = 4
      fatMultiplier = 1
    } else if (goal === 'fat_loss') {
      calorieMultiplier = 28
      proteinMultiplier = 2.2
      carbsMultiplier = 2.5
      fatMultiplier = 0.8
    } else {
      // General / Athletic
      calorieMultiplier = 32
      proteinMultiplier = 1.8
      carbsMultiplier = 3.5
      fatMultiplier = 0.9
    }

    const nutritionData = {
      client_id: userId,
      calories: Math.round(weight * calorieMultiplier),
      protein_g: Math.round(weight * proteinMultiplier),
      carbs_g: Math.round(weight * carbsMultiplier),
      fat_g: Math.round(weight * fatMultiplier),
    }

    await supabase.from('nutrition_targets').insert(nutritionData)
  }

  async function saveAndFinish() {
    if (!name.trim() || !userId || !heightCm || !weightKg || !experienceLevel || !goal || !trainingDays) return
    setSaving(true)

    await supabase.from('profiles').update({
      full_name: name.trim(),
      height_cm: parseFloat(heightCm),
      weight_kg: parseFloat(weightKg),
      experience_level: experienceLevel,
      goal: goal || 'general',
      training_days_per_week: parseInt(trainingDays),
      onboarded: true,
    }).eq('id', userId)

    await createNutritionTargets()

    setSaving(false)
    router.push('/portal/dashboard')
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2 pt-14 pb-6">
        {[1, 2, 3, 4, 5].map(s => (
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

        {/* ─── Step 2: Body Stats ─── */}
        {step === 2 && (
          <>
            <div className="text-center mb-10">
              <div className="text-6xl mb-4">📏</div>
              <h1 className="text-white text-2xl font-black mb-2">Je lichaamsgegevens</h1>
              <p className="text-zinc-500 text-sm">Dit helpt ons je voeding aan te passen</p>
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <label className="text-zinc-400 text-sm font-semibold block mb-2">Lengte (cm)</label>
                <input
                  type="number"
                  value={heightCm}
                  onChange={e => setHeightCm(e.target.value)}
                  placeholder="bijv. 180"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl px-5 py-4 text-white text-lg
                             focus:outline-none focus:border-orange-500 transition placeholder-zinc-600"
                />
              </div>
              <div>
                <label className="text-zinc-400 text-sm font-semibold block mb-2">Gewicht (kg)</label>
                <input
                  type="number"
                  value={weightKg}
                  onChange={e => setWeightKg(e.target.value)}
                  placeholder="bijv. 80"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl px-5 py-4 text-white text-lg
                             focus:outline-none focus:border-orange-500 transition placeholder-zinc-600"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6 mb-10">
              <button
                onClick={() => setStep(1)}
                className="flex-1 bg-zinc-800 text-zinc-400 font-bold py-4 rounded-2xl text-sm transition"
              >
                ← Terug
              </button>
              <button
                onClick={() => heightCm && weightKg && setStep(3)}
                disabled={!heightCm || !weightKg}
                className="flex-[2] bg-orange-500 hover:bg-orange-600 disabled:opacity-30
                           text-white font-black py-4 rounded-2xl text-lg transition"
              >
                Doorgaan →
              </button>
            </div>
          </>
        )}

        {/* ─── Step 3: Experience Level ─── */}
        {step === 3 && (
          <>
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">💯</div>
              <h1 className="text-white text-2xl font-black mb-2">Wat is je trainervaring?</h1>
              <p className="text-zinc-500 text-sm">Dit helpt ons het juiste niveau te kiezen</p>
            </div>

            <div className="space-y-3 flex-1">
              {EXPERIENCE_LEVELS.map(e => (
                <button
                  key={e.val}
                  onClick={() => setExperienceLevel(e.val)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition ${
                    experienceLevel === e.val
                      ? 'bg-orange-500/20 border-orange-500'
                      : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'
                  }`}
                >
                  <span className="text-3xl flex-shrink-0">{e.emoji}</span>
                  <div className="text-left flex-1">
                    <p className={`font-bold text-sm ${experienceLevel === e.val ? 'text-white' : 'text-zinc-300'}`}>
                      {e.label}
                    </p>
                    <p className="text-zinc-500 text-xs mt-0.5">{e.desc}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    experienceLevel === e.val ? 'border-orange-500 bg-orange-500' : 'border-zinc-600'
                  }`}>
                    {experienceLevel === e.val && <span className="text-white text-xs">✓</span>}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-3 mt-6 mb-10">
              <button
                onClick={() => setStep(2)}
                className="flex-1 bg-zinc-800 text-zinc-400 font-bold py-4 rounded-2xl text-sm transition"
              >
                ← Terug
              </button>
              <button
                onClick={() => experienceLevel && setStep(4)}
                disabled={!experienceLevel}
                className="flex-[2] bg-orange-500 hover:bg-orange-600 disabled:opacity-30
                           text-white font-black py-4 rounded-2xl text-lg transition"
              >
                Doorgaan →
              </button>
            </div>
          </>
        )}

        {/* ─── Step 4: Goal ─── */}
        {step === 4 && (
          <>
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">🎯</div>
              <h1 className="text-white text-2xl font-black mb-2">
                Wat is jouw doel?
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
                onClick={() => setStep(3)}
                className="flex-1 bg-zinc-800 text-zinc-400 font-bold py-4 rounded-2xl text-sm transition"
              >
                ← Terug
              </button>
              <button
                onClick={() => goal && setStep(5)}
                disabled={!goal}
                className="flex-[2] bg-orange-500 hover:bg-orange-600 disabled:opacity-30
                           text-white font-black py-4 rounded-2xl text-lg transition"
              >
                Doorgaan →
              </button>
            </div>
          </>
        )}

        {/* ─── Step 5: Training Frequency + Launch ─── */}
        {step === 5 && (
          <>
            <div className="text-center mb-10">
              <div className="text-6xl mb-4">📅</div>
              <h1 className="text-white text-2xl font-black mb-2">Trainingsdagen per week</h1>
              <p className="text-zinc-500 text-sm">Hoe vaak kan je trainen?</p>
            </div>

            <div className="flex-1 space-y-3">
              {TRAINING_DAYS.map(days => (
                <button
                  key={days}
                  onClick={() => setTrainingDays(days.toString())}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition ${
                    trainingDays === days.toString()
                      ? 'bg-orange-500/20 border-orange-500'
                      : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'
                  }`}
                >
                  <span className="text-3xl flex-shrink-0">📌</span>
                  <div className="text-left flex-1">
                    <p className={`font-bold text-lg ${trainingDays === days.toString() ? 'text-white' : 'text-zinc-300'}`}>
                      {days} dagen per week
                    </p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    trainingDays === days.toString() ? 'border-orange-500 bg-orange-500' : 'border-zinc-600'
                  }`}>
                    {trainingDays === days.toString() && <span className="text-white text-xs">✓</span>}
                  </div>
                </button>
              ))}
            </div>

            {/* Profile preview card */}
            <div className="mt-8 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 w-full">
              <h3 className="text-white font-bold text-sm mb-3">Jouw profiel:</h3>
              <div className="space-y-2 text-sm text-zinc-300">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Naam:</span>
                  <span className="text-white font-semibold">{name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Lengte:</span>
                  <span className="text-white font-semibold">{heightCm} cm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Gewicht:</span>
                  <span className="text-white font-semibold">{weightKg} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Ervaring:</span>
                  <span className="text-white font-semibold">
                    {EXPERIENCE_LEVELS.find(e => e.val === experienceLevel)?.label}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Doel:</span>
                  <span className="text-white font-semibold">
                    {GOALS.find(g => g.val === goal)?.label}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6 mb-10">
              <button
                onClick={() => setStep(4)}
                className="flex-1 bg-zinc-800 text-zinc-400 font-bold py-4 rounded-2xl text-sm transition"
              >
                ← Terug
              </button>
              <button
                onClick={saveAndFinish}
                disabled={saving || !trainingDays}
                className="flex-[2] bg-orange-500 hover:bg-orange-600 disabled:opacity-40
                           text-white font-black py-4 rounded-2xl text-lg transition"
              >
                {saving ? 'Opslaan...' : 'Start je journey 🔥'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
