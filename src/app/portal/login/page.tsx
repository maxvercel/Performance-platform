'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { validateRegistration } from '@/lib/validation'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)

  // Login velden
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Register velden
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [birthdate, setBirthdate] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regPassword2, setRegPassword2] = useState('')

  async function handleLogin() {
    setLoading(true); setMessage('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setIsError(true); setMessage(error.message); setLoading(false); return }
    router.refresh()
    router.push('/portal/dashboard')
  }

  async function handleRegister() {
  setLoading(true); setMessage('')

  const validation = validateRegistration({
    firstName, lastName, email: regEmail, password: regPassword, password2: regPassword2,
  })
  if (!validation.valid) {
    setIsError(true); setMessage(validation.error!); setLoading(false); return
  }

  const { error } = await supabase.auth.signUp({
    email: regEmail,
    password: regPassword,
    options: {
      emailRedirectTo: `${location.origin}/portal/auth/callback`,
      data: {
        full_name: `${firstName} ${lastName}`,
        phone,
        birthdate,
      }
    }
  })

  if (error) {
    setIsError(true)
    setMessage(error.message)
    setLoading(false)
    return
  }

  // Wissel naar bevestigingsscherm
  setMode('confirm' as any)
  setLoading(false)
}

  async function handleReset() {
    setLoading(true); setMessage('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/portal/auth/callback?next=/portal/reset-password`
    })
    if (error) {
      console.error('Reset password error:', error)
      setIsError(true)
      setMessage(error.message === 'Error sending recovery email'
        ? 'E-mail kon niet worden verstuurd. Controleer of dit adres geregistreerd is.'
        : error.message)
    } else {
      setIsError(false)
      setMessage('✓ Reset link verstuurd — check je email (ook spam).')
    }
    setLoading(false)
  }

  const inputClass = `w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 
    text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-orange-500 
    transition`

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8 flex flex-col items-center">
          <img
            src="/logo-email.png"
            alt="9toFit Performance Coaching"
            width={240}
            height={120}
            className="object-contain"
          />
        </div>

        {/* Tabs */}
        {mode !== 'reset' && (
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1 mb-4">
            <button
              onClick={() => { setMode('login'); setMessage('') }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                mode === 'login' 
                  ? 'bg-orange-500 text-white' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Inloggen
            </button>
            <button
              onClick={() => { setMode('register'); setMessage('') }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                mode === 'register' 
                  ? 'bg-orange-500 text-white' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Account aanmaken
            </button>
          </div>
        )}

        {/* LOGIN FORM */}
        {mode === 'login' && (
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-3">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email"
              autoComplete="email"
              className={inputClass}
            />
            <input
              type="password"
              placeholder="Wachtwoord"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              aria-label="Wachtwoord"
              autoComplete="current-password"
              className={inputClass}
            />
            {message && (
              <p className={`text-xs ${isError ? 'text-red-400' : 'text-green-400'}`}>
                {message}
              </p>
            )}
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold 
                         py-3 rounded-xl text-sm tracking-wide transition disabled:opacity-50"
            >
              {loading ? 'Even wachten...' : 'Inloggen'}
            </button>
            <button
              onClick={() => { setMode('reset'); setMessage('') }}
              className="w-full text-zinc-500 text-xs hover:text-zinc-300 transition pt-1"
            >
              Wachtwoord vergeten?
            </button>
          </div>
        )}

        {/* REGISTER FORM */}
        {mode === 'register' && (
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Voornaam *"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={inputClass}
              />
              <input
                type="text"
                placeholder="Achternaam *"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={inputClass}
              />
            </div>
            <input
              type="email"
              placeholder="Email *"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              className={inputClass}
            />
            <input
              type="tel"
              placeholder="Telefoonnummer"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
            />
            <div>
              <label className="text-zinc-500 text-xs ml-1 mb-1 block">Geboortedatum</label>
              <input
                type="date"
                value={birthdate}
                onChange={(e) => setBirthdate(e.target.value)}
                className={inputClass + ' [color-scheme:dark]'}
              />
            </div>
            <input
              type="password"
              placeholder="Wachtwoord * (min. 8 tekens)"
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
              className={inputClass}
            />
            <input
              type="password"
              placeholder="Wachtwoord bevestigen *"
              value={regPassword2}
              onChange={(e) => setRegPassword2(e.target.value)}
              className={inputClass}
            />

            {/* Wachtwoord sterkte indicator */}
            {regPassword && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1,2,3,4].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-all ${
                      regPassword.length >= i * 3 
                        ? i <= 1 ? 'bg-red-500' 
                          : i <= 2 ? 'bg-orange-500' 
                          : i <= 3 ? 'bg-yellow-500' 
                          : 'bg-green-500'
                        : 'bg-zinc-700'
                    }`} />
                  ))}
                </div>
                <p className="text-zinc-600 text-xs">
                  {regPassword.length < 4 ? 'Te kort' 
                    : regPassword.length < 7 ? 'Zwak' 
                    : regPassword.length < 10 ? 'Redelijk' 
                    : 'Sterk ✓'}
                </p>
              </div>
            )}

            {message && (
              <p className={`text-xs ${isError ? 'text-red-400' : 'text-green-400'}`}>
                {message}
              </p>
            )}
            <button
              onClick={handleRegister}
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold 
                         py-3 rounded-xl text-sm tracking-wide transition disabled:opacity-50"
            >
              {loading ? 'Even wachten...' : 'Account aanmaken'}
            </button>
            <p className="text-zinc-600 text-xs text-center leading-relaxed">
              Na registratie ontvang je een bevestigingsmail.<br/>
              Klik op de link om je account te activeren.
            </p>
          </div>
        )}

{/* BEVESTIGING SCHERM */}
{(mode as any) === 'confirm' && (
  <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 text-center space-y-4">
    <div className="w-16 h-16 bg-green-500/20 border-2 border-green-500 rounded-full 
                    flex items-center justify-center mx-auto">
      <span className="text-3xl">✉️</span>
    </div>
    <h2 className="text-white font-black text-xl">Check je email!</h2>
    <p className="text-zinc-400 text-sm leading-relaxed">
      We hebben een bevestigingslink gestuurd naar<br/>
      <span className="text-orange-400 font-semibold">{regEmail}</span>
    </p>
    <p className="text-zinc-600 text-xs">
      Klik op de link in de email om je account te activeren. 
      Check ook je spam folder.
    </p>
    <button
      onClick={() => { setMode('login'); setMessage('') }}
      className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold 
                 py-3 rounded-xl text-sm transition"
    >
      Terug naar inloggen
    </button>
  </div>
)}

        {/* RESET FORM */}
        {mode === 'reset' && (
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-3">
            <div className="mb-2">
              <h2 className="text-white font-bold">Wachtwoord vergeten</h2>
              <p className="text-zinc-500 text-xs mt-1">
                Vul je email in en we sturen je een reset link.
              </p>
            </div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
            {message && (
              <p className={`text-xs ${isError ? 'text-red-400' : 'text-green-400'}`}>
                {message}
              </p>
            )}
            <button
              onClick={handleReset}
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold 
                         py-3 rounded-xl text-sm tracking-wide transition disabled:opacity-50"
            >
              {loading ? 'Even wachten...' : 'Reset link versturen'}
            </button>
            <button
              onClick={() => { setMode('login'); setMessage('') }}
              className="w-full text-zinc-500 text-xs hover:text-zinc-300 transition"
            >
              ← Terug naar inloggen
            </button>
          </div>
        )}

      </div>
    </div>
  )
}