'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

interface WorkoutDoneScreenProps {
  firstName: string
  completedSets: number
  onReset: () => void
}

export function WorkoutDoneScreen({ firstName, completedSets, onReset }: WorkoutDoneScreenProps) {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 pb-24">
      <div className="text-center w-full max-w-sm">
        <div className="text-7xl mb-4" aria-hidden="true">🏆</div>
        <h1 className="text-white text-3xl font-black mb-2">Workout voltooid!</h1>
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
  )
}
