'use client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function BevestigdPage() {
  const router = useRouter()

  // Record referral signup if a ref code was stored during registration
  useEffect(() => {
    async function trackReferral() {
      const refCode = sessionStorage.getItem('9tofit_ref')
      if (!refCode) return

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      try {
        await fetch('/api/referral', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: refCode, newUserId: user.id }),
        })
        // Clean up so we don't track twice
        sessionStorage.removeItem('9tofit_ref')
      } catch (err) {
        console.error('Referral tracking error:', err)
      }
    }
    trackReferral()
  }, [])

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