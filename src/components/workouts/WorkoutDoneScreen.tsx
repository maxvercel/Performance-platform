'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Confetti } from '@/components/ui/Confetti'

interface WorkoutDoneScreenProps {
  firstName: string
  completedSets: number
  onReset: () => void
  newPR?: boolean
}

export function WorkoutDoneScreen({ firstName, completedSets, onReset, newPR = false }: WorkoutDoneScreenProps) {
  const router = useRouter()
  const [showConfetti, setShowConfetti] = useState(newPR)

  return (
    <>
      <Confetti show={showConfetti} />
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 pb-24">
        <div className="text-center w-full max-w-sm">
          <div className="text-7xl mb-4" aria-hidden="true">{newPR ? '🎉' : '🏆'}</div>
          <h1 className="text-white text-3xl font-black mb-2">Workout voltooid!</h1>
          {newPR && (
            <p className="text-orange-400 text-sm font-bold mb-2">✨ Nieuw persoonlijk record! ✨</p>
          )}
          <p className="text-zinc-500 text-sm mb-1">Goed werk, {firstName}!</p>
          <p className="text-zinc-600 text-xs mb-8">{completedSets} sets voltooid</p>

        <div className="grid grid-cols-2 gap-3 mb-8">
          <button
            onClick={() => router.push('/portal/records')}
            className="bg-zinc-800 border border-zinc-700 text-white font-bold py-3 px-4 rounded-xl text-sm"
          >
            🏆 Mijn PRs
          </button>
          <button
            onClick={() => router.push('/portal/progress')}
            className="bg-zinc-800 border border-zinc-700 text-white font-bold py-3 px-4 rounded-xl text-sm"
          >
            📈 Progress
          </button>
        </div>

        <Button onClick={onReset} fullWidth size="lg">
          Terug naar overzicht
        </Button>
      </div>
    </div>
    </>
  )
}
