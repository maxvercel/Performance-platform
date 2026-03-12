'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const supabase = createClient()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // Check of de gebruiker via een reset link is binnengekomen
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setIsReady(true)
      } else {
        setMessage('Ongeldige of verlopen reset link. Vraag een nieuwe aan.')
        setIsError(true)
      }
    })
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      setIsError(true)
      setMessage('Wachtwoord moet minimaal 6 tekens zijn.')
      return
    }
    if (password !== password2) {
      setIsError(true)
      setMessage('Wachtwoorden komen niet overeen.')
      return
    }

    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setIsError(true)
      setMessage(error.message)
    } else {
      setIsError(false)
      setMessage('Wachtwoord succesvol gewijzigd! Je wordt doorgestuurd...')
      setTimeout(() => router.push('/portal/dashboard'), 2000)
    }
    setLoading(false)
  }

  const inputClass = `w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3
    text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-orange-500
    transition`

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-white text-2xl font-black">Nieuw wachtwoord</h1>
          <p className="text-zinc-500 text-sm mt-2">Kies een nieuw wachtwoord voor je account.</p>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-xl text-sm ${
            isError ? 'bg-red-500/10 border border-red-500/30 text-red-400' : 'bg-green-500/10 border border-green-500/30 text-green-400'
          }`}>
            {message}
          </div>
        )}

        {isReady && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="password"
              placeholder="Nieuw wachtwoord"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className={inputClass}
              autoComplete="new-password"
              aria-label="Nieuw wachtwoord"
              minLength={6}
              required
            />
            <input
              type="password"
              placeholder="Herhaal wachtwoord"
              value={password2}
              onChange={e => setPassword2(e.target.value)}
              className={inputClass}
              autoComplete="new-password"
              aria-label="Herhaal wachtwoord"
              minLength={6}
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl hover:bg-orange-600 transition disabled:opacity-50"
            >
              {loading ? 'Bezig...' : 'Wachtwoord opslaan'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
