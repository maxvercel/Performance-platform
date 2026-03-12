'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <p className="text-red-500 text-5xl font-black mb-4">Oeps</p>
        <h1 className="text-white text-xl font-bold mb-2">Er ging iets mis</h1>
        <p className="text-zinc-500 text-sm mb-8">
          {error.message || 'Er is een onverwachte fout opgetreden. Probeer het opnieuw.'}
        </p>
        <button
          onClick={reset}
          className="inline-block bg-orange-500 text-white font-bold text-sm px-6 py-3 rounded-xl hover:bg-orange-600 transition"
        >
          Opnieuw proberen
        </button>
      </div>
    </div>
  )
}
