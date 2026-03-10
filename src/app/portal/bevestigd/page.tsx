'use client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function BevestigdPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">

        <div className="w-20 h-20 bg-green-500/20 border-2 border-green-500 rounded-full 
                        flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">✓</span>
        </div>

        <h1 className="text-white text-2xl font-black mb-2">
          Account bevestigd!
        </h1>
        <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
          Welkom bij 9toFit! Je account is succesvol aangemaakt. 
          Je kunt nu inloggen en aan de slag.
        </p>

        <button
          onClick={() => router.push('/portal/login')}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold 
                     py-3 rounded-xl text-sm tracking-wide transition"
        >
          Inloggen →
        </button>

      </div>
    </div>
  )
}