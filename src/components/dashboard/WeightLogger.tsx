'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function WeightLogger({ userId, onSaved }: { userId: string, onSaved: () => void }) {
  const supabase = createClient()
  const [weight, setWeight] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function saveWeight() {
    if (!weight || isNaN(parseFloat(weight))) return
    setSaving(true)
    setError(null)

    const { error: insertError } = await supabase.from('progress_metrics').insert({
      client_id: userId,
      weight_kg: parseFloat(weight),
      logged_at: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]
    })

    setSaving(false)

    if (insertError) {
      console.error('Weight save error:', insertError)
      setError('Opslaan mislukt, probeer opnieuw')
      setTimeout(() => setError(null), 3000)
      return
    }

    setSaved(true)
    setWeight('')
    onSaved()
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <h2 className="text-white font-bold mb-1">Gewicht loggen</h2>
      <p className="text-zinc-500 text-xs mb-4">Log je gewicht van vandaag</p>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <input
            type="number"
            step="0.1"
            placeholder="0.0"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveWeight()}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 
                       text-white text-sm focus:outline-none focus:border-orange-500 
                       transition pr-10"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">
            kg
          </span>
        </div>
        <button
          onClick={saveWeight}
          disabled={saving || !weight}
          className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white 
                     font-bold px-5 rounded-xl text-sm transition"
        >
          {saving ? '...' : saved ? '✓' : 'Opslaan'}
        </button>
      </div>
      {error && (
        <p className="text-red-400 text-xs mt-2">{error}</p>
      )}
    </div>
  )
}