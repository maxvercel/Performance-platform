'use client'

import { formatPace } from '@/utils/calculations'
import { Button } from '@/components/ui/Button'

interface RunFormData {
  date: string
  distance_km: string
  duration_min: string
  duration_sec: string
  avg_heart_rate: string
  notes: string
  run_type: string
}

interface RunFormModalProps {
  form: RunFormData
  saving: boolean
  onChange: (updates: Partial<RunFormData>) => void
  onSave: () => void
  onClose: () => void
}

const RUN_TYPES = [
  { val: 'easy', label: '🐢 Easy' },
  { val: 'tempo', label: '⚡ Tempo' },
  { val: 'interval', label: '🔥 Interval' },
  { val: 'long', label: '🏃 Long' },
] as const

export function RunFormModal({ form, saving, onChange, onSave, onClose }: RunFormModalProps) {
  const canShowPace = form.distance_km && (form.duration_min || form.duration_sec)
  const pace = canShowPace
    ? formatPace(
        ((parseInt(form.duration_min) || 0) * 60 + (parseInt(form.duration_sec) || 0)) /
          parseFloat(form.distance_km)
      )
    : null

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center">
      <div className="bg-zinc-900 rounded-t-3xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">Run toevoegen</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 text-2xl leading-none"
            aria-label="Sluiten"
          >
            ×
          </button>
        </div>

        {/* Type */}
        <div>
          <label className="text-zinc-400 text-xs font-bold block mb-2">Type</label>
          <div className="flex gap-2">
            {RUN_TYPES.map(t => (
              <button
                key={t.val}
                onClick={() => onChange({ run_type: t.val })}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                  form.run_type === t.val
                    ? 'bg-orange-500 text-white'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="text-zinc-400 text-xs font-bold block mb-2">Datum</label>
          <input
            type="date"
            value={form.date}
            onChange={e => onChange({ date: e.target.value })}
            className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 text-sm
                       focus:outline-none focus:ring-1 focus:ring-orange-500 border border-zinc-700"
          />
        </div>

        {/* Distance */}
        <div>
          <label className="text-zinc-400 text-xs font-bold block mb-2">Afstand (km)</label>
          <input
            type="number"
            step="0.01"
            placeholder="5.0"
            value={form.distance_km}
            onChange={e => onChange({ distance_km: e.target.value })}
            className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 text-sm
                       focus:outline-none focus:ring-1 focus:ring-orange-500 border border-zinc-700"
          />
        </div>

        {/* Duration */}
        <div>
          <label className="text-zinc-400 text-xs font-bold block mb-2">Tijd</label>
          <div className="flex gap-3">
            <div className="flex-1">
              <input
                type="number"
                placeholder="25"
                value={form.duration_min}
                onChange={e => onChange({ duration_min: e.target.value })}
                className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 text-sm
                           focus:outline-none focus:ring-1 focus:ring-orange-500 border border-zinc-700"
              />
              <p className="text-zinc-500 text-xs mt-1 text-center">minuten</p>
            </div>
            <div className="flex-1">
              <input
                type="number"
                placeholder="30"
                value={form.duration_sec}
                onChange={e => onChange({ duration_sec: e.target.value })}
                className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 text-sm
                           focus:outline-none focus:ring-1 focus:ring-orange-500 border border-zinc-700"
              />
              <p className="text-zinc-500 text-xs mt-1 text-center">seconden</p>
            </div>
          </div>
          {pace && (
            <p className="text-orange-400 text-xs mt-2 text-center font-bold">Tempo: {pace}</p>
          )}
        </div>

        {/* Heart rate */}
        <div>
          <label className="text-zinc-400 text-xs font-bold block mb-2">
            Gem. hartslag (optioneel)
          </label>
          <input
            type="number"
            placeholder="155"
            value={form.avg_heart_rate}
            onChange={e => onChange({ avg_heart_rate: e.target.value })}
            className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 text-sm
                       focus:outline-none focus:ring-1 focus:ring-orange-500 border border-zinc-700"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="text-zinc-400 text-xs font-bold block mb-2">
            Notities (optioneel)
          </label>
          <textarea
            placeholder="Hoe voelde het?"
            value={form.notes}
            onChange={e => onChange({ notes: e.target.value })}
            rows={2}
            className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 text-sm
                       focus:outline-none focus:ring-1 focus:ring-orange-500 border border-zinc-700 resize-none"
          />
        </div>

        <Button
          onClick={onSave}
          loading={saving}
          disabled={!form.distance_km}
          fullWidth
          size="lg"
        >
          💾 Opslaan
        </Button>
      </div>
    </div>
  )
}
