'use client'
import { useState } from 'react'

type Props = {
  exerciseId: string
  exerciseName: string
  existingUrl?: string | null
}

export default function ExerciseImage({ exerciseId, exerciseName, existingUrl }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(existingUrl ?? null)
  const [loading, setLoading] = useState(false)
  const [show, setShow] = useState(false)

  async function loadImage() {
    if (imageUrl || loading) return
    setLoading(true)

    const res = await fetch('/api/exercise-illustration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exerciseId, exerciseName })
    })

    const data = await res.json()
    setImageUrl(data.url)
    setLoading(false)
  }

  function toggle() {
    if (!show) loadImage()
    setShow(!show)
  }

  return (
    <div>
      <button
        onClick={toggle}
        className={`text-xs px-2 py-1 rounded-lg transition ${
          show
            ? 'bg-orange-500 text-white'
            : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
        }`}
      >
        {loading ? '...' : '🖼️'}
      </button>

      {show && (
        <div className="mt-2">
          {loading ? (
            <div className="w-full h-40 bg-zinc-800 rounded-xl flex flex-col
                            items-center justify-center gap-2">
              <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent
                              rounded-full animate-spin" />
              <p className="text-zinc-500 text-xs">Illustratie genereren...</p>
              <p className="text-zinc-600 text-xs">~20 seconden</p>
            </div>
          ) : imageUrl ? (
            <div className="relative">
              <img
                src={imageUrl}
                alt={exerciseName}
                className="w-full rounded-xl object-cover"
                style={{ maxHeight: '220px' }}
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t
                              from-black/80 to-transparent rounded-b-xl px-3 py-2">
                <p className="text-white text-xs font-semibold">{exerciseName}</p>
              </div>
            </div>
          ) : (
            <div className="w-full h-32 bg-zinc-800 rounded-xl flex items-center justify-center">
              <p className="text-zinc-600 text-xs">Generatie mislukt — probeer opnieuw</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}