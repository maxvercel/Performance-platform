'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'

interface AddClientFormProps {
  onAdd: (email: string) => Promise<void>
}

export function AddClientForm({ onAdd }: AddClientFormProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  async function handle() {
    if (!email) return
    setLoading(true)
    await onAdd(email)
    setEmail('')
    setLoading(false)
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <h2 className="text-white font-bold mb-3">Client toevoegen</h2>
      <div className="flex gap-2">
        <input
          type="email"
          placeholder="emailadres van client"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handle()}
          aria-label="Email van client"
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm
                     placeholder-zinc-500 focus:outline-none focus:border-orange-500 transition"
        />
        <Button onClick={handle} loading={loading} disabled={!email} size="sm">
          + Toevoegen
        </Button>
      </div>
    </div>
  )
}
